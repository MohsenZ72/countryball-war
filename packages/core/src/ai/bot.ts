/**
 * Bot commander.
 *
 * One decision pass every `thinkEvery` seconds, in strict priority order:
 *
 *   1. survive  — reinforce any node an inbound column would take
 *   2. strike   — take the best-value target it can afford, pooling garrisons
 *                 whose columns would land close together
 *   3. invest   — upgrade an interior node when no strike is affordable
 *   4. escalate — spend a warhead on a garrison it could never storm
 *   5. commit   — last resort: go all-in from a node already at capacity,
 *                 because a full garrison produces nothing
 *
 * Two rules keep it from feeding its own territory to the enemy, which is what
 * the first tuning pass did (it lost every 1v1 it played):
 *
 *   - **reserve**: a node with an enemy within a short march keeps
 *     `reserveRatio` of its capacity at home.
 *   - **hold**: a contested target is only worth taking if the assault leaves
 *     `holdRatio` of that node's capacity standing afterwards.
 *
 * Randomness comes from the step index and the faction id, so the bot is a
 * pure function of world state and `determinism.test.ts` stays meaningful.
 */

import { BALANCE, capacityOf, defenceMulOf, upgradeCostOf, type Balance, type BotBalance } from '../config.js';
import { dist } from '../map/generate.js';
import { createRng } from '../rng.js';
import { marchDuration, sendableFrom } from '../sim/commands.js';
import type { Command, FactionId, TerritoryNode, World } from '../types.js';

export interface BotState {
  nextThinkAt: number;
}

export function createBotState(faction: FactionId, balance: Balance = BALANCE): BotState {
  // Stagger the first pass so bots on one map do not act in lockstep.
  return { nextThinkAt: faction * balance.dt * 7 };
}

/** Pooled columns must land inside this window to count as one assault. */
const ASSAULT_WINDOW = 1.1;
/** An enemy this many seconds away counts as "on the border". */
const BORDER_MARCH = 4;
/** A garrison at this share of capacity is wasting production by waiting. */
const CAPPED_AT = 0.95;
/** Never spend a warhead on a trivial garrison, however poor the bot is. */
const NUKE_FLOOR = 12;
/** A warhead needs this much headroom over what the bot could pool by hand. */
const NUKE_HEADROOM = 1.15;

export function thinkBot(
  world: World,
  factionId: FactionId,
  state: BotState,
  balance: Balance = BALANCE,
): Command[] {
  const faction = world.factions[factionId];
  if (!faction || faction.eliminatedAt !== null || world.outcome.state !== 'running') return [];
  if (world.time < state.nextThinkAt) return [];

  const profile = balance.bots[faction.skill];
  const step = Math.round(world.time / balance.dt);
  const rng = createRng((Math.imul(step, 2654435761) + Math.imul(factionId + 1, 40503)) >>> 0);
  state.nextThinkAt = world.time + profile.thinkEvery * rng.range(0.85, 1.15);

  const mine = world.nodes.filter((n) => n.owner === factionId && n.falloutFor <= 0);
  if (mine.length === 0) return [];
  const foreign = world.nodes.filter((n) => n.owner !== factionId && n.falloutFor <= 0);
  const inbound = tallyInbound(world, factionId);
  const view: View = {
    world,
    factionId,
    mine,
    foreign,
    profile,
    balance,
    inboundFriendly: inbound.friendly,
    inboundHostile: inbound.hostile,
  };

  const defence = defend(view);
  if (defence) return [defence];

  const commands: Command[] = [];
  const roll = rng.next();
  const strike = attack(view, roll);
  if (strike) commands.push(strike);

  if (!strike || rng.next() < profile.buildBias) {
    const invest = upgrade(view);
    if (invest) commands.push(invest);
  }

  if (faction.charges >= balance.nuke.cost && rng.next() < profile.nukeWillingness) {
    const launch = escalate(view);
    if (launch) commands.push(launch);
  }

  // Nothing affordable and nothing to build: a capped garrison must move.
  if (commands.length === 0) {
    const allIn = attack(view, roll, { ignoreReserve: true, ignoreHold: true, ratio: 1 });
    if (allIn && hasCappedNode(view)) commands.push(allIn);
  }

  return commands;
}

interface View {
  readonly world: World;
  readonly factionId: FactionId;
  readonly mine: readonly TerritoryNode[];
  readonly foreign: readonly TerritoryNode[];
  readonly profile: BotBalance;
  readonly balance: Balance;
  /** Own troops already marching on each node id. */
  readonly inboundFriendly: ReadonlyMap<number, number>;
  /** Enemy troops already marching on each node id. */
  readonly inboundHostile: ReadonlyMap<number, number>;
}

/**
 * Columns already in the air, tallied per destination.
 *
 * Without this a bot that thinks twice a second re-sends to the same target on
 * every pass, pouring three or four columns into one node while the rest of
 * its front sits empty. It is the single most important thing the bot knows:
 * in testing, leaving it out made a FASTER-thinking bot strictly worse than a
 * slow one. See ADR-0007.
 */
function tallyInbound(world: World, factionId: FactionId): {
  friendly: Map<number, number>;
  hostile: Map<number, number>;
} {
  const friendly = new Map<number, number>();
  const hostile = new Map<number, number>();
  for (const army of world.armies) {
    const bucket = army.owner === factionId ? friendly : hostile;
    bucket.set(army.to, (bucket.get(army.to) ?? 0) + army.count);
  }
  return { friendly, hostile };
}

/** Troops a node may send without dropping below its defensive reserve. */
function spareOf(view: View, node: TerritoryNode, ratio: number, ignoreReserve: boolean): number {
  const byRatio = sendableFrom(node.troops, ratio, view.balance);
  if (ignoreReserve) return byRatio;
  // A capital always holds a reserve, however quiet the map looks. Without
  // this, a bot emptied its seat in the opening seconds and a player could
  // simply walk in — level one was being won in eleven seconds.
  if (!node.capital && !onBorder(view, node)) return byRatio;
  const share = node.capital
    ? Math.max(view.profile.reserveRatio, view.balance.capitalReserveFloor)
    : view.profile.reserveRatio;
  const reserve = capacityOf(node.level, node.kind, view.balance) * share;
  const spare = Math.floor(node.troops - reserve - view.balance.garrisonFloor);
  return Math.max(0, Math.min(byRatio, spare));
}

function onBorder(view: View, node: TerritoryNode): boolean {
  return view.foreign.some(
    (f) => marchDuration(dist(node.pos, f.pos), view.balance) <= BORDER_MARCH,
  );
}

function hasCappedNode(view: View): boolean {
  return view.mine.some(
    (n) => n.troops >= capacityOf(n.level, n.kind, view.balance) * CAPPED_AT,
  );
}

/** Reinforces the most endangered node from the closest garrison that can help. */
function defend(view: View): Command | null {
  const { factionId, mine, balance } = view;
  let worst: { node: TerritoryNode; shortfall: number } | null = null;
  for (const node of mine) {
    const inbound = view.inboundHostile.get(node.id) ?? 0;
    if (inbound === 0) continue;
    const relief = view.inboundFriendly.get(node.id) ?? 0;
    const held = (node.troops + relief) * defenceMulOf(node.kind, node.capital, balance);
    const shortfall = inbound - held;
    if (shortfall > 0 && (worst === null || shortfall > worst.shortfall)) worst = { node, shortfall };
  }
  if (!worst) return null;

  const endangered = worst.node;
  const need = worst.shortfall / defenceMulOf(endangered.kind, endangered.capital, balance);
  const helper = mine
    .filter((n) => n.id !== endangered.id && sendableFrom(n.troops, 0.65, balance) >= need)
    .sort((a, b) => dist(a.pos, endangered.pos) - dist(b.pos, endangered.pos))[0];
  if (!helper) return null;
  return { kind: 'send', faction: factionId, from: [helper.id], to: endangered.id, ratio: 0.65 };
}

interface AttackOptions {
  readonly ignoreReserve?: boolean;
  readonly ignoreHold?: boolean;
  readonly ratio?: number;
}

function attack(view: View, roll: number, options: AttackOptions = {}): Command | null {
  const { factionId, mine, foreign, profile, balance } = view;
  const ratio = options.ratio ?? clamp(profile.commitRatio, 0.3, 1);
  const rival = strongestRival(view);
  let best: { from: number[]; to: number; score: number } | null = null;

  for (const target of foreign) {
    const defence = target.troops * defenceMulOf(target.kind, target.capital, balance);
    // A neutral garrison never grows and never reinforces, so exact arithmetic
    // is enough. Only a held node deserves a safety margin and a hold reserve.
    const gross =
      target.owner === null
        ? defence + 1
        : defence * profile.safetyMargin +
          (options.ignoreHold
            ? 0
            : capacityOf(target.level, target.kind, balance) * profile.holdRatio);
    // Whatever is already marching there is part of the assault.
    const need = gross - (view.inboundFriendly.get(target.id) ?? 0);
    if (need <= 0) continue;

    const sources = mine
      .map((node) => ({
        node,
        count: spareOf(view, node, ratio, options.ignoreReserve ?? false),
        eta: marchDuration(dist(node.pos, target.pos), balance),
      }))
      .filter((s) => s.count >= 1)
      .sort((a, b) => a.eta - b.eta);
    if (sources.length === 0) continue;

    const pooled = poolSources(sources, need);
    if (!pooled) continue;

    const value = targetValue(target, rival);
    const score = value / (1 + pooled.eta) - pooled.committed * 0.012 + roll * 0.4;
    if (best === null || score > best.score) best = { from: pooled.ids, to: target.id, score };
  }

  if (!best) return null;
  return { kind: 'send', faction: factionId, from: best.from, to: best.to, ratio };
}

/** Smallest set of garrisons whose columns arrive together and beat `need`. */
function poolSources(
  sources: readonly { node: TerritoryNode; count: number; eta: number }[],
  need: number,
): { ids: number[]; eta: number; committed: number } | null {
  for (let anchor = 0; anchor < sources.length; anchor++) {
    const base = sources[anchor];
    if (!base) continue;
    const ids: number[] = [];
    let committed = 0;
    let eta = base.eta;
    for (let i = anchor; i < sources.length; i++) {
      const candidate = sources[i];
      if (!candidate || candidate.eta - base.eta > ASSAULT_WINDOW) break;
      ids.push(candidate.node.id);
      committed += candidate.count;
      eta = Math.max(eta, candidate.eta);
      if (committed > need) return { ids, eta, committed };
    }
  }
  return null;
}

function targetValue(target: TerritoryNode, rival: FactionId | null): number {
  let value = 10;
  if (target.capital) value += 7;
  if (target.kind === 'factory') value += 9;
  else if (target.kind === 'fort') value += 4;
  // Neutral garrisons never regrow, so taking them is pure tempo.
  if (target.owner === null) value += 9;
  if (rival !== null && target.owner === rival) value += 6;
  value += (target.level - 1) * 3;
  return value;
}

function upgrade(view: View): Command | null {
  const { factionId, mine, foreign, balance, profile } = view;
  let best: { node: TerritoryNode; safety: number } | null = null;
  for (const node of mine) {
    const cost = upgradeCostOf(node.level, node.kind, balance);
    if (cost === null) continue;
    const reserveShare = node.capital
      ? Math.max(profile.reserveRatio, balance.capitalReserveFloor)
      : profile.reserveRatio;
    const reserve =
      node.capital || onBorder(view, node)
        ? capacityOf(node.level, node.kind, balance) * reserveShare
        : balance.garrisonFloor;
    if (node.troops < cost + reserve) continue;
    const safety = foreign.length === 0 ? Infinity : Math.min(...foreign.map((f) => dist(node.pos, f.pos)));
    if (best === null || safety > best.safety) best = { node, safety };
  }
  if (!best) return null;
  return { kind: 'upgrade', faction: factionId, node: best.node.id };
}

function escalate(view: View): Command | null {
  const { factionId, mine, foreign, balance } = view;
  // Everything the bot could throw at one place if it emptied every garrison.
  const bestPool = mine.reduce((sum, n) => sum + sendableFrom(n.troops, 1, balance), 0);
  const targets = foreign
    .filter((n) => n.owner !== null)
    .map((n) => ({ node: n, defence: n.troops * defenceMulOf(n.kind, n.capital, balance) }))
    .filter((t) => t.defence >= NUKE_FLOOR && t.defence * NUKE_HEADROOM > bestPool)
    .sort((a, b) => b.defence - a.defence);
  for (const target of targets) {
    const silo = mine.find((n) => dist(n.pos, target.node.pos) >= balance.nuke.minRange);
    if (silo) return { kind: 'nuke', faction: factionId, from: silo.id, to: target.node.id };
  }
  return null;
}

function strongestRival(view: View): FactionId | null {
  const { world, factionId } = view;
  const owned = new Int32Array(world.factions.length);
  for (const node of world.nodes) {
    if (node.owner !== null) owned[node.owner] = (owned[node.owner] ?? 0) + 1;
  }
  let best: FactionId | null = null;
  let bestCount = -1;
  for (const faction of world.factions) {
    if (faction.id === factionId || faction.eliminatedAt !== null) continue;
    const count = owned[faction.id] ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = faction.id;
    }
  }
  return best;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

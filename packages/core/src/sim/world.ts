/**
 * The simulation itself: fixed-step, deterministic, DOM-free.
 *
 * `stepWorld` is the single entry point. It applies the commands handed to it,
 * advances production, moves armies and missiles, resolves arrivals and then
 * re-evaluates the match outcome, in that order. `world.events` holds only the
 * events produced by the most recent step, so a renderer can drive effects
 * without diffing state.
 */

import { BALANCE, capacityOf, defenceMulOf, rateOf, type Balance } from '../config.js';
import { dist, generateMap, type MapSpec } from '../map/generate.js';
import { createRng } from '../rng.js';
import type {
  Army,
  Command,
  Faction,
  FactionId,
  Missile,
  NodeLevel,
  SimEvent,
  TerritoryNode,
  World,
} from '../types.js';
import { applyCommand } from './commands.js';

export interface FactionSpec {
  readonly name: string;
  readonly flag: string;
  readonly control: 'human' | 'bot';
  readonly skill?: Faction['skill'];
}

export interface WorldInit {
  readonly map: MapSpec;
  readonly factions: readonly FactionSpec[];
  readonly timeLimit?: number;
}

export function createWorld(init: WorldInit, balance: Balance = BALANCE): World {
  if (init.factions.length !== init.map.factions) {
    throw new Error(
      `faction count mismatch: map wants ${init.map.factions}, got ${init.factions.length} specs`,
    );
  }
  const generated = generateMap(init.map, balance);
  const factions: Faction[] = init.factions.map((spec, id) => ({
    id,
    name: spec.name,
    flag: spec.flag,
    charges: 0,
    chargeProgress: 0,
    control: spec.control,
    skill: spec.skill ?? 'steady',
    eliminatedAt: null,
  }));
  return {
    bounds: generated.bounds,
    nodes: generated.nodes,
    factions,
    armies: [],
    missiles: [],
    time: 0,
    nextEntityId: 1,
    rngState: createRng(init.map.seed ^ 0x9e3779b9).state(),
    events: [],
    outcome: { state: 'running' },
    timeLimit: init.timeLimit ?? balance.timeLimit,
  };
}

/** Advances the world by one fixed step after applying `commands` in order. */
export function stepWorld(
  world: World,
  commands: readonly Command[] = [],
  balance: Balance = BALANCE,
): readonly SimEvent[] {
  world.events = [];
  if (world.outcome.state !== 'running') return world.events;

  for (const command of commands) applyCommand(world, command, balance);

  const dt = balance.dt;
  world.time += dt;

  advanceNodes(world, dt, balance);
  advanceCharges(world, dt, balance);
  advanceMissiles(world, dt, balance);
  advanceArmies(world, dt, balance);
  updateOutcome(world);

  return world.events;
}

function advanceNodes(world: World, dt: number, balance: Balance): void {
  for (const node of world.nodes) {
    node.heldFor += dt;
    if (node.falloutFor > 0) {
      node.falloutFor = Math.max(0, node.falloutFor - dt);
      continue;
    }
    if (node.owner === null) continue;
    const cap = capacityOf(node.level, node.kind, balance);
    if (node.troops < cap) {
      node.troops = Math.min(cap, node.troops + rateOf(node.level, node.kind, balance) * dt);
    } else if (node.troops > cap) {
      node.troops = Math.max(cap, node.troops - balance.overfillDecay * dt);
    }
  }
}

function advanceCharges(world: World, dt: number, balance: Balance): void {
  const gain = new Float64Array(world.factions.length);
  for (const node of world.nodes) {
    if (node.owner === null || node.falloutFor > 0) continue;
    gain[node.owner] = (gain[node.owner] ?? 0) + balance.kinds[node.kind].chargeRate * dt;
  }
  for (const faction of world.factions) {
    if (faction.eliminatedAt !== null) continue;
    faction.chargeProgress += gain[faction.id] ?? 0;
    while (faction.chargeProgress >= 1) {
      if (faction.charges >= balance.nuke.maxCharges) {
        faction.chargeProgress = 0.999;
        break;
      }
      faction.charges += 1;
      faction.chargeProgress -= 1;
    }
  }
}

function advanceMissiles(world: World, dt: number, balance: Balance): void {
  if (world.missiles.length === 0) return;
  const landed: Missile[] = [];
  const flying: Missile[] = [];
  for (const missile of world.missiles) {
    missile.progress += dt / missile.duration;
    if (missile.progress >= 1) landed.push(missile);
    else flying.push(missile);
  }
  world.missiles = flying;
  for (const missile of landed) {
    const node = world.nodes[missile.to];
    if (!node) continue;
    node.troops = 0;
    node.owner = null;
    node.level = Math.max(1, node.level - balance.nuke.levelLoss) as NodeLevel;
    node.falloutFor = balance.nuke.falloutTime;
    node.heldFor = 0;
    world.events.push({ kind: 'nuke-hit', node: node.id, owner: missile.owner, at: world.time });
  }
}

function advanceArmies(world: World, dt: number, balance: Balance): void {
  if (world.armies.length === 0) return;
  const arrived: Army[] = [];
  const marching: Army[] = [];
  for (const army of world.armies) {
    army.progress += dt / army.duration;
    if (army.progress >= 1) arrived.push(army);
    else marching.push(army);
  }
  world.armies = marching;
  for (const army of arrived) resolveArrival(world, army, balance);
}

/** Resolves a column reaching its destination. Exported for focused tests. */
export function resolveArrival(world: World, army: Army, balance: Balance = BALANCE): void {
  const node = world.nodes[army.to];
  if (!node) return;

  if (node.owner === army.owner) {
    node.troops += army.count;
    world.events.push({ kind: 'reinforced', node: node.id, by: army.owner, count: army.count, at: world.time });
    return;
  }

  // A node still in fallout cannot change hands; the column is spent.
  if (node.falloutFor > 0) {
    world.events.push({ kind: 'repelled', node: node.id, by: node.owner, attacker: army.owner, at: world.time });
    return;
  }

  const defenceMul = defenceMulOf(node.kind, node.capital, balance);
  const defence = node.troops * defenceMul;
  if (army.count > defence) {
    const previous = node.owner;
    node.owner = army.owner;
    node.troops = (army.count - defence) / defenceMul;
    node.heldFor = 0;
    world.events.push({ kind: 'captured', node: node.id, by: army.owner, from: previous, at: world.time });
  } else {
    node.troops = (defence - army.count) / defenceMul;
    world.events.push({ kind: 'repelled', node: node.id, by: node.owner, attacker: army.owner, at: world.time });
  }
}

function updateOutcome(world: World): void {
  const owned = new Int32Array(world.factions.length);
  for (const node of world.nodes) {
    if (node.owner !== null) owned[node.owner] = (owned[node.owner] ?? 0) + 1;
  }
  const inFlight = new Int32Array(world.factions.length);
  for (const army of world.armies) inFlight[army.owner] = (inFlight[army.owner] ?? 0) + 1;

  for (const faction of world.factions) {
    if (faction.eliminatedAt !== null) continue;
    if ((owned[faction.id] ?? 0) === 0 && (inFlight[faction.id] ?? 0) === 0) {
      faction.eliminatedAt = world.time;
      world.events.push({ kind: 'eliminated', faction: faction.id, at: world.time });
    }
  }

  const alive = world.factions.filter((f) => f.eliminatedAt === null);
  if (alive.length === 1 && alive[0]) {
    world.outcome = { state: 'won', faction: alive[0].id };
    return;
  }
  if (alive.length === 0) {
    world.outcome = { state: 'draw', reason: 'time' };
    return;
  }
  if (world.time >= world.timeLimit) {
    world.outcome = decideOnTerritory(world, owned);
  }
}

/** At the time limit the biggest empire wins; an exact tie is a draw. */
function decideOnTerritory(world: World, owned: Int32Array): World['outcome'] {
  let best: FactionId | null = null;
  let bestCount = -1;
  let tied = false;
  for (const faction of world.factions) {
    if (faction.eliminatedAt !== null) continue;
    const count = owned[faction.id] ?? 0;
    if (count > bestCount) {
      bestCount = count;
      best = faction.id;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }
  if (best === null || tied) return { state: 'draw', reason: 'time' };
  return { state: 'won', faction: best };
}

/** Convenience read model for the HUD and for bots. */
export interface FactionStanding {
  readonly faction: FactionId;
  readonly nodes: number;
  readonly troops: number;
  readonly production: number;
}

export function standings(world: World, balance: Balance = BALANCE): FactionStanding[] {
  const nodes = new Int32Array(world.factions.length);
  const troops = new Float64Array(world.factions.length);
  const production = new Float64Array(world.factions.length);
  for (const node of world.nodes) {
    if (node.owner === null) continue;
    nodes[node.owner] = (nodes[node.owner] ?? 0) + 1;
    troops[node.owner] = (troops[node.owner] ?? 0) + node.troops;
    if (node.falloutFor <= 0) {
      production[node.owner] = (production[node.owner] ?? 0) + rateOf(node.level, node.kind, balance);
    }
  }
  for (const army of world.armies) troops[army.owner] = (troops[army.owner] ?? 0) + army.count;
  return world.factions.map((f) => ({
    faction: f.id,
    nodes: nodes[f.id] ?? 0,
    troops: troops[f.id] ?? 0,
    production: production[f.id] ?? 0,
  }));
}

export function nodesOf(world: World, faction: FactionId): TerritoryNode[] {
  return world.nodes.filter((n) => n.owner === faction);
}

export function distanceBetween(world: World, a: number, b: number): number {
  const from = world.nodes[a];
  const to = world.nodes[b];
  if (!from || !to) return Infinity;
  return dist(from.pos, to.pos);
}

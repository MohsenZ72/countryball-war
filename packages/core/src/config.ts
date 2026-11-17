/**
 * Every balance number in the game lives here.
 *
 * Nothing else in the codebase may hard-code a troop count, a rate or a cost.
 * `docs/02-game-design.md` documents the intent behind each group, and
 * `packages/core/tests/balance.test.ts` guards the invariants that make the
 * numbers playable (for example: a level-3 node must out-produce a level-1 one).
 *
 * These values are a first pass, derived from genre convention and tuned by
 * headless bot-vs-bot matches (`npm run sim`). They are not measured from any
 * other game's binary. See `docs/08-legal-and-ip.md`.
 */

import type { BotSkill, NodeKind } from './types.js';

export interface LevelBalance {
  /** Soft troop ceiling. Production stops here; reinforcements may overfill. */
  readonly capacity: number;
  /** Troops produced per second while owned and not in fallout. */
  readonly rate: number;
  /**
   * Troops spent to reach the NEXT level, as a share of THIS level's capacity
   * for that node kind. `null` on the last level.
   *
   * It is a ratio, not an absolute, for one reason: an absolute cost that
   * exceeds a small node's capacity makes the upgrade unreachable forever.
   * A fort holds 14 troops at level 1, so a flat cost of 25 would lock forts
   * out of the build path entirely. See ADR-0006.
   */
  readonly upgradeCostRatio: number | null;
}

export interface KindBalance {
  readonly capacityMul: number;
  readonly rateMul: number;
  /** Defenders count as `troops * defenceMul` when resolving an attack. */
  readonly defenceMul: number;
  /** Nuclear charge produced per second by each owned node of this kind. */
  readonly chargeRate: number;
}

export interface BotBalance {
  /** Seconds between decisions. Lower is sharper. */
  readonly thinkEvery: number;
  /**
   * Required attacker:defender ratio before a bot assaults a HELD node.
   * Higher is better play, not more timid: a failed assault loses the whole
   * column, so skimping on the margin is how a bot bleeds itself dry.
   * Neutral garrisons are static and need no margin at all.
   */
  readonly safetyMargin: number;
  /**
   * Share of one garrison a single order may move. Lower is better play: the
   * bot pools the cost across several nodes instead of emptying one.
   */
  readonly commitRatio: number;
  /** Chance per decision to spend a charge when a juicy target exists. */
  readonly nukeWillingness: number;
  /** Chance per decision to invest in an upgrade instead of attacking. */
  readonly buildBias: number;
  /**
   * Share of a node's capacity kept home when an enemy is within a short
   * march. HIGHER IS BETTER PLAY, and it is the strongest skill axis in the
   * game: a bot that empties its border garrisons to 1 troop hands them
   * straight back. Measured 0.00 -> 33% win rate, 0.34 -> 88%.
   */
  readonly reserveRatio: number;
  /**
   * Share of the TARGET's capacity the bot insists on having left standing
   * after taking a contested node — "do not take what you cannot hold".
   *
   * LOWER IS BETTER PLAY. The rule sounds prudent and measures badly: it makes
   * a bot decline free territory. Weak profiles carry a high value on purpose.
   */
  readonly holdRatio: number;
}

export interface Balance {
  /** Fixed simulation step, in seconds. 30 Hz. */
  readonly dt: number;
  readonly levels: readonly [LevelBalance, LevelBalance, LevelBalance];
  readonly kinds: Readonly<Record<NodeKind, KindBalance>>;
  /** Troops a neutral node starts with, by map difficulty band. */
  readonly neutralGarrison: { readonly min: number; readonly max: number };
  /** Troops each faction's capital starts with. */
  readonly startingTroops: number;
  /**
   * Level every capital starts at.
   *
   * Capitals start developed so that no faction can be rushed out of the game
   * in the first minute. With level-1 capitals, 1v1 matches were decided
   * before either side had expanded. See ADR-0007.
   */
  readonly capitalLevel: 1 | 2 | 3;
  /**
   * Extra defence for a capital, on top of its node kind.
   *
   * Without it, a bot that out-expanded its rival could walk into the rival's
   * seat before the first minute was out; 1v1 matches were averaging 42
   * seconds. Capitals have to be worth besieging.
   */
  readonly capitalDefenceMul: number;
  /**
   * Share of its capital's capacity every bot keeps at home, whatever its
   * skill says.
   *
   * Abandoning your own seat is not a playstyle, it is a blunder, and the
   * weakest profile (`reserveRatio` 0) committed it every match, walking its
   * whole seat out of the door in the opening seconds.
   *
   * Kept deliberately low. A floor high enough to stop a one-garrison rush
   * outright (0.6) also stopped the best profile from spending its capital
   * and inverted the skill ladder — `ruthless` went from 22-2 against
   * `sharp` to 9-15. Rushing a careless opponent's seat stays a real
   * strategy; what is ruled out is a capital standing literally empty.
   */
  readonly capitalReserveFloor: number;
  /**
   * Map units travelled per second by a marching column.
   *
   * Tuned by playing, not by theory: at 150 a cross-map move took six seconds
   * and the opening of a match felt dead while the player waited.
   */
  readonly marchSpeed: number;
  /** Clamp so very short and very long marches stay readable. */
  readonly marchDuration: { readonly min: number; readonly max: number };
  /** Troops above capacity bleed off at this rate per second. */
  readonly overfillDecay: number;
  /** Fraction of a garrison a `send` command moves, by player-selected step. */
  readonly sendRatios: readonly [number, number, number];
  /** A send always leaves at least this many troops behind. */
  readonly garrisonFloor: number;
  readonly nuke: {
    /** Charges spent per launch. */
    readonly cost: number;
    /** Seconds of flight. The target is visible and can be reinforced. */
    readonly flightTime: number;
    /** Seconds the struck node produces nothing and cannot be captured. */
    readonly falloutTime: number;
    /** Levels knocked off the struck node. */
    readonly levelLoss: number;
    /** Charges a faction may bank. */
    readonly maxCharges: number;
    /** Minimum map distance; stops point-blank cheese. */
    readonly minRange: number;
  };
  readonly bots: Readonly<Record<BotSkill, BotBalance>>;
  /** Hard match length in seconds. Reaching it is a draw. */
  readonly timeLimit: number;
}

export const BALANCE: Balance = {
  dt: 1 / 30,
  levels: [
    { capacity: 20, rate: 0.5, upgradeCostRatio: 0.6 },
    { capacity: 35, rate: 0.9, upgradeCostRatio: 0.75 },
    { capacity: 60, rate: 1.5, upgradeCostRatio: null },
  ],
  kinds: {
    city: { capacityMul: 1, rateMul: 1, defenceMul: 1, chargeRate: 0 },
    fort: { capacityMul: 0.7, rateMul: 0.7, defenceMul: 1.6, chargeRate: 0 },
    factory: { capacityMul: 1.3, rateMul: 1.35, defenceMul: 0.85, chargeRate: 1 / 45 },
  },
  neutralGarrison: { min: 6, max: 26 },
  startingTroops: 22,
  capitalLevel: 2,
  capitalDefenceMul: 1.5,
  capitalReserveFloor: 0.25,
  marchSpeed: 190,
  marchDuration: { min: 0.7, max: 4.5 },
  overfillDecay: 0.6,
  sendRatios: [0.25, 0.5, 1],
  garrisonFloor: 1,
  nuke: {
    cost: 1,
    flightTime: 3,
    falloutTime: 4,
    levelLoss: 1,
    maxCharges: 3,
    minRange: 140,
  },
  bots: {
    // The ladder was tuned by coordinate descent against a fixed opponent
    // (40 seeds per point, 14-node maps) rather than by intuition. What the
    // measurements actually said:
    //
    //   reserveRatio  DECIDES GAMES. 0.00 -> 33% win rate, 0.34 -> 88%.
    //                 Keeping a border garrison stocked beats spending it.
    //   holdRatio     Actively harmful, and the harm is large: 0.00 -> 97%,
    //                 0.40 -> 47%. Refusing a capture you cannot "hold" just
    //                 declines free territory. Weak bots are given a high
    //                 value here precisely because it plays badly.
    //   commitRatio   Moderate and noisy; 0.70-0.85 all play well.
    //   safetyMargin  Nearly flat between 1.02 and 1.60.
    //   thinkEvery    Flat once in-flight columns are counted (see ADR-0007).
    //   buildBias     Flat for a bot at every value from 0 to 0.7 — bots spend
    //                 their troops expanding either way. It still matters for
    //                 a human, who can hold a node and bank the production.
    //
    // So skill runs mainly on reserves and on not refusing free ground. Re-run
    // `npm run sim` after any change here.
    calm: {
      thinkEvery: 2.1,
      safetyMargin: 1.6,
      commitRatio: 0.45,
      nukeWillingness: 0.05,
      buildBias: 0.1,
      reserveRatio: 0,
      holdRatio: 0.4,
    },
    steady: {
      thinkEvery: 1.4,
      safetyMargin: 1.45,
      commitRatio: 0.6,
      nukeWillingness: 0.25,
      buildBias: 0.2,
      reserveRatio: 0.12,
      holdRatio: 0.26,
    },
    sharp: {
      thinkEvery: 0.85,
      safetyMargin: 1.32,
      commitRatio: 0.72,
      nukeWillingness: 0.45,
      buildBias: 0.28,
      reserveRatio: 0.24,
      holdRatio: 0.13,
    },
    ruthless: {
      thinkEvery: 0.5,
      safetyMargin: 1.22,
      commitRatio: 0.82,
      nukeWillingness: 0.7,
      buildBias: 0.32,
      reserveRatio: 0.34,
      holdRatio: 0,
    },
  },
  timeLimit: 600,
};

/** Effective troop ceiling of a node. */
export function capacityOf(level: number, kind: NodeKind, balance: Balance = BALANCE): number {
  const lvl = balance.levels[Math.min(level, balance.levels.length) - 1] ?? balance.levels[0];
  return lvl.capacity * balance.kinds[kind].capacityMul;
}

/** Effective troops produced per second by a node. */
export function rateOf(level: number, kind: NodeKind, balance: Balance = BALANCE): number {
  const lvl = balance.levels[Math.min(level, balance.levels.length) - 1] ?? balance.levels[0];
  return lvl.rate * balance.kinds[kind].rateMul;
}

/**
 * Total defence multiplier applied to a node's garrison: its kind, plus the
 * capital bonus when it is one. The single source of truth for the
 * simulation and for every bot estimate — they must never disagree, or the
 * bot will commit to assaults it cannot win.
 */
export function defenceMulOf(
  kind: NodeKind,
  capital: boolean,
  balance: Balance = BALANCE,
): number {
  return balance.kinds[kind].defenceMul * (capital ? balance.capitalDefenceMul : 1);
}

/**
 * Troops needed to upgrade, or `null` when already at the top level.
 *
 * Always strictly less than the node's own capacity, so every node kind can
 * reach every level. `balance.test.ts` guards that property.
 */
export function upgradeCostOf(level: number, kind: NodeKind, balance: Balance = BALANCE): number | null {
  const lvl = balance.levels[Math.min(level, balance.levels.length) - 1] ?? balance.levels[0];
  if (lvl.upgradeCostRatio === null) return null;
  return Math.round(capacityOf(level, kind, balance) * lvl.upgradeCostRatio);
}

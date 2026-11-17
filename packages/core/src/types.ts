/**
 * Core domain types for the territory-capture simulation.
 *
 * The simulation is deterministic: given the same `WorldInit` and the same
 * ordered command stream, `stepWorld` always produces an identical `World`.
 * Nothing in this package may read `Math.random`, `Date.now` or any DOM API.
 */

/** Index into `World.factions`. Faction 0 is always the human player. */
export type FactionId = number;

/** Index into `World.nodes`. Stable for the lifetime of a world. */
export type NodeId = number;

/** `null` means the node is unowned (neutral garrison). */
export type Owner = FactionId | null;

export type NodeKind = 'city' | 'fort' | 'factory';

/** 1-based. `BALANCE.levels` holds one entry per level. */
export type NodeLevel = 1 | 2 | 3;

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface TerritoryNode {
  readonly id: NodeId;
  readonly pos: Vec2;
  readonly kind: NodeKind;
  /**
   * A faction's starting seat. Fortified terrain: it keeps its defence bonus
   * for whoever holds it, which makes capitals the real objectives on the map
   * rather than nodes to be sniped in the opening minute.
   */
  readonly capital: boolean;
  owner: Owner;
  /** Fractional troop count. Rendered floored; combat uses the exact value. */
  troops: number;
  level: NodeLevel;
  /** Seconds remaining of post-strike fallout. Blocks production while > 0. */
  falloutFor: number;
  /** Seconds since this node last changed hands. Used by bot threat scoring. */
  heldFor: number;
}

export interface Army {
  readonly id: number;
  readonly owner: FactionId;
  readonly from: NodeId;
  readonly to: NodeId;
  /** Troops carried. Fixed for the whole flight. */
  readonly count: number;
  /** 0 at launch, 1 on arrival. */
  progress: number;
  /** Seconds the whole flight takes, derived from distance at launch. */
  readonly duration: number;
}

export interface Missile {
  readonly id: number;
  readonly owner: FactionId;
  readonly from: NodeId;
  readonly to: NodeId;
  progress: number;
  readonly duration: number;
}

export interface Faction {
  readonly id: FactionId;
  /** Display name, e.g. "Brightland". Cosmetic only. */
  readonly name: string;
  /** Key into the client-side flag table. Cosmetic only. */
  readonly flag: string;
  /** Whole nuclear charges available to spend. */
  charges: number;
  /** Fractional progress toward the next charge, in [0, 1). */
  chargeProgress: number;
  readonly control: 'human' | 'bot';
  /** Only meaningful when `control === 'bot'`. */
  readonly skill: BotSkill;
  /** Set once the faction loses its last node. */
  eliminatedAt: number | null;
}

export type BotSkill = 'calm' | 'steady' | 'sharp' | 'ruthless';

export type Command =
  | { readonly kind: 'send'; readonly faction: FactionId; readonly from: readonly NodeId[]; readonly to: NodeId; readonly ratio: number }
  | { readonly kind: 'upgrade'; readonly faction: FactionId; readonly node: NodeId }
  | { readonly kind: 'nuke'; readonly faction: FactionId; readonly from: NodeId; readonly to: NodeId };

export type SimEvent =
  | { readonly kind: 'captured'; readonly node: NodeId; readonly by: FactionId; readonly from: Owner; readonly at: number }
  | { readonly kind: 'reinforced'; readonly node: NodeId; readonly by: FactionId; readonly count: number; readonly at: number }
  | { readonly kind: 'repelled'; readonly node: NodeId; readonly by: Owner; readonly attacker: FactionId; readonly at: number }
  | { readonly kind: 'launched'; readonly army: number; readonly owner: FactionId; readonly at: number }
  | { readonly kind: 'nuke-launched'; readonly owner: FactionId; readonly to: NodeId; readonly at: number }
  | { readonly kind: 'nuke-hit'; readonly node: NodeId; readonly owner: FactionId; readonly at: number }
  | { readonly kind: 'upgraded'; readonly node: NodeId; readonly to: NodeLevel; readonly at: number }
  | { readonly kind: 'eliminated'; readonly faction: FactionId; readonly at: number }
  | { readonly kind: 'rejected'; readonly reason: string; readonly at: number };

export type MatchOutcome =
  | { readonly state: 'running' }
  | { readonly state: 'won'; readonly faction: FactionId }
  | { readonly state: 'draw'; readonly reason: 'time' };

export interface World {
  readonly bounds: Vec2;
  readonly nodes: TerritoryNode[];
  readonly factions: Faction[];
  armies: Army[];
  missiles: Missile[];
  /** Seconds of simulated time elapsed. Advances in fixed steps. */
  time: number;
  /** Monotonic id source for armies and missiles. */
  nextEntityId: number;
  /** Deterministic RNG state (mulberry32). */
  rngState: number;
  /** Events produced by the most recent `stepWorld` call only. */
  events: SimEvent[];
  outcome: MatchOutcome;
  /** Hard stop so headless matches always terminate. */
  readonly timeLimit: number;
}

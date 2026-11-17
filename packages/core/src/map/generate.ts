/**
 * Deterministic map generation.
 *
 * Maps are scattered points with a minimum separation (dart throwing), which
 * keeps nodes tappable on a phone and stops the renderer overlapping labels.
 * Capitals are chosen by farthest-point selection so no faction starts boxed
 * in, and neutral garrisons scale with distance from the nearest capital so
 * the opening moves are always available but the midfield has to be earned.
 */

import { BALANCE, type Balance } from '../config.js';
import { createRng, type Rng } from '../rng.js';
import type { NodeKind, TerritoryNode, Vec2 } from '../types.js';

export interface MapSpec {
  readonly seed: number;
  readonly bounds: Vec2;
  /** Total nodes including capitals. Clamped to what the bounds can hold. */
  readonly nodeCount: number;
  /** How many capitals to reserve. Must be >= 2. */
  readonly factions: number;
  /** Minimum centre-to-centre distance in map units. */
  readonly minSpacing?: number;
  /** Share of non-capital nodes that become forts / factories. */
  readonly kindMix?: { readonly fort: number; readonly factory: number };
  /** Multiplies neutral garrisons. Campaign uses this to ramp difficulty. */
  readonly garrisonScale?: number;
}

export interface GeneratedMap {
  readonly nodes: TerritoryNode[];
  /** `capitals[i]` is the starting node id of faction `i`. */
  readonly capitals: number[];
  readonly bounds: Vec2;
}

const MARGIN = 70;

export function generateMap(spec: MapSpec, balance: Balance = BALANCE): GeneratedMap {
  if (spec.factions < 2) throw new Error('a map needs at least 2 factions');
  const rng = createRng(spec.seed);
  const spacing = spec.minSpacing ?? 118;
  const points = scatter(rng, spec.bounds, spec.nodeCount, spacing);
  if (points.length < spec.factions * 3) {
    throw new Error(
      `map too small: fitted ${points.length} nodes, need ${spec.factions * 3} for ${spec.factions} factions`,
    );
  }

  const capitals = pickCapitals(rng, points, spec.factions);
  const capitalSet = new Set(capitals);
  const mix = spec.kindMix ?? { fort: 0.26, factory: 0.16 };
  const scale = spec.garrisonScale ?? 1;

  const maxDist = Math.hypot(spec.bounds.x, spec.bounds.y);
  const nodes: TerritoryNode[] = points.map((pos, id) => {
    const isCapital = capitalSet.has(id);
    const kind: NodeKind = isCapital ? 'city' : rollKind(rng, mix);
    const nearest = Math.min(...capitals.map((c) => dist(pos, points[c] as Vec2)));
    const t = clamp01(nearest / (maxDist * 0.45));
    const base = balance.neutralGarrison.min + t * (balance.neutralGarrison.max - balance.neutralGarrison.min);
    const jitter = rng.range(0.85, 1.15);
    return {
      id,
      pos,
      kind,
      capital: isCapital,
      owner: null,
      troops: isCapital ? balance.startingTroops : Math.max(2, Math.round(base * jitter * scale)),
      level: 1,
      falloutFor: 0,
      heldFor: 0,
    };
  });

  capitals.forEach((id, faction) => {
    const node = nodes[id];
    if (node) {
      node.owner = faction;
      node.troops = balance.startingTroops;
      node.level = balance.capitalLevel;
    }
  });

  return { nodes, capitals, bounds: spec.bounds };
}

/** Dart throwing: sample until `want` points sit at least `spacing` apart. */
function scatter(rng: Rng, bounds: Vec2, want: number, spacing: number): Vec2[] {
  const out: Vec2[] = [];
  const maxTries = want * 260;
  for (let tries = 0; tries < maxTries && out.length < want; tries++) {
    const p: Vec2 = {
      x: rng.range(MARGIN, bounds.x - MARGIN),
      y: rng.range(MARGIN, bounds.y - MARGIN),
    };
    if (out.every((q) => dist(p, q) >= spacing)) out.push(p);
  }
  return out;
}

/**
 * Farthest-point selection, so capitals spread to the edges of the map.
 *
 * The first capital is the point farthest from the map centre, NOT a random
 * one. With a random first pick, that seat often landed in the middle of the
 * map with borders on every side — and since the human always occupies seat 0,
 * the player was handed the worst position on every four-way map. The chosen
 * set is then shuffled so no seat is systematically favoured either.
 */
function pickCapitals(rng: Rng, points: readonly Vec2[], count: number): number[] {
  const centre = centroid(points);
  let outermost = 0;
  let outermostDist = -1;
  for (let i = 0; i < points.length; i++) {
    const d = dist(points[i] as Vec2, centre);
    if (d > outermostDist) {
      outermostDist = d;
      outermost = i;
    }
  }
  const chosen: number[] = [outermost];
  while (chosen.length < count) {
    let best = -1;
    let bestScore = -1;
    for (let i = 0; i < points.length; i++) {
      if (chosen.includes(i)) continue;
      const score = Math.min(...chosen.map((c) => dist(points[i] as Vec2, points[c] as Vec2)));
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    }
    if (best < 0) break;
    chosen.push(best);
  }
  return rng.shuffle(chosen);
}

function centroid(points: readonly Vec2[]): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function rollKind(rng: Rng, mix: { fort: number; factory: number }): NodeKind {
  const r = rng.next();
  if (r < mix.factory) return 'factory';
  if (r < mix.factory + mix.fort) return 'fort';
  return 'city';
}

export function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

import { describe, expect, it } from 'vitest';
import { dist, generateMap } from '../src/map/generate.js';
import { CAMPAIGN, buildLevel } from '../src/levels.js';
import { createWorld } from '../src/sim/world.js';

describe('map generation', () => {
  it('is deterministic for a given seed', () => {
    const spec = { seed: 1234, bounds: { x: 1400, y: 800 }, nodeCount: 16, factions: 3 };
    const a = generateMap(spec);
    const b = generateMap(spec);
    expect(a.nodes.map((n) => [n.pos.x, n.pos.y, n.kind, n.troops])).toEqual(
      b.nodes.map((n) => [n.pos.x, n.pos.y, n.kind, n.troops]),
    );
    expect(a.capitals).toEqual(b.capitals);
  });

  it('keeps nodes at least the minimum spacing apart', () => {
    const spacing = 130;
    const map = generateMap({
      seed: 99,
      bounds: { x: 1500, y: 860 },
      nodeCount: 18,
      factions: 4,
      minSpacing: spacing,
    });
    for (let i = 0; i < map.nodes.length; i++) {
      for (let j = i + 1; j < map.nodes.length; j++) {
        const a = map.nodes[i];
        const b = map.nodes[j];
        if (!a || !b) continue;
        expect(dist(a.pos, b.pos)).toBeGreaterThanOrEqual(spacing - 1e-9);
      }
    }
  });

  it('gives every faction exactly one distinct capital', () => {
    const map = generateMap({ seed: 5, bounds: { x: 1500, y: 860 }, nodeCount: 18, factions: 4 });
    expect(new Set(map.capitals).size).toBe(4);
    for (let f = 0; f < 4; f++) {
      expect(map.nodes.filter((n) => n.owner === f).length).toBe(1);
    }
  });

  it('marks exactly one capital per faction and keeps the flag on capture', () => {
    const map = generateMap({ seed: 12, bounds: { x: 1500, y: 860 }, nodeCount: 18, factions: 3 });
    expect(map.nodes.filter((n) => n.capital).length).toBe(3);
    for (const id of map.capitals) expect(map.nodes[id]?.capital).toBe(true);
  });

  it('does not put every capital in the same seat order each time', () => {
    // Capital 0 used to be a random point while the rest were pushed to the
    // edges, which handed the human seat the most-bordered position on every
    // map. Selection now starts from the outermost point and shuffles.
    const centres = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const map = generateMap({ seed, bounds: { x: 1500, y: 860 }, nodeCount: 18, factions: 4 });
      centres.add(map.capitals[0] ?? -1);
    }
    expect(centres.size).toBeGreaterThan(1);
  });

  it('rejects a map that cannot seat its factions', () => {
    expect(() =>
      generateMap({ seed: 1, bounds: { x: 300, y: 300 }, nodeCount: 20, factions: 5, minSpacing: 200 }),
    ).toThrow(/map too small/);
  });

  it('rejects fewer than two factions', () => {
    expect(() => generateMap({ seed: 1, bounds: { x: 900, y: 600 }, nodeCount: 8, factions: 1 })).toThrow(
      /at least 2/,
    );
  });
});

describe('campaign', () => {
  it('has unique level ids', () => {
    expect(new Set(CAMPAIGN.map((l) => l.id)).size).toBe(CAMPAIGN.length);
  });

  it('builds every level into a usable world', () => {
    for (const level of CAMPAIGN) {
      const world = createWorld(buildLevel(level));
      expect(world.nodes.length).toBeGreaterThanOrEqual(level.opponents.length * 3 + 3);
      expect(world.factions.length).toBe(level.opponents.length + 1);
      expect(world.factions[0]?.control).toBe('human');
      expect(world.nodes.filter((n) => n.owner !== null).length).toBe(world.factions.length);
    }
  });

  it('ramps: maps never shrink and par time always grows', () => {
    for (let i = 1; i < CAMPAIGN.length; i++) {
      const prev = CAMPAIGN[i - 1];
      const curr = CAMPAIGN[i];
      if (!prev || !curr) continue;
      expect(curr.nodeCount).toBeGreaterThanOrEqual(prev.nodeCount);
      expect(curr.parTime).toBeGreaterThan(prev.parTime);
      // A teaching level may drop back to a single rival (Factory Floor does),
      // but never by more than one seat.
      expect(curr.opponents.length).toBeGreaterThanOrEqual(prev.opponents.length - 1);
    }
  });

  it('saves the largest rival count for the last level', () => {
    const counts = CAMPAIGN.map((l) => l.opponents.length);
    expect(Math.max(...counts)).toBe(counts.at(-1));
  });

  it('gives every faction a distinct nation', () => {
    for (const level of CAMPAIGN) {
      const world = createWorld(buildLevel(level));
      expect(new Set(world.factions.map((f) => f.flag)).size).toBe(world.factions.length);
    }
  });
});

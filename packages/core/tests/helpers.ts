import { BALANCE } from '../src/config.js';
import { createWorld, type WorldInit } from '../src/sim/world.js';
import type { Command, World } from '../src/types.js';
import { stepWorld } from '../src/sim/world.js';

/** A tiny, fully controlled world: 4 nodes, 2 factions, no bots involved. */
export function tinyWorld(overrides: Partial<WorldInit> = {}): World {
  const init: WorldInit = {
    map: { seed: 7, bounds: { x: 900, y: 600 }, nodeCount: 6, factions: 2, minSpacing: 170 },
    factions: [
      { name: 'Player', flag: 'brightland', control: 'human' },
      { name: 'Rival', flag: 'crimsonia', control: 'human' },
    ],
    ...overrides,
  };
  return createWorld(init);
}

/** Steps the world for `seconds`, optionally injecting commands on the first step. */
export function run(world: World, seconds: number, commands: readonly Command[] = []): void {
  const steps = Math.round(seconds / BALANCE.dt);
  for (let i = 0; i < steps; i++) stepWorld(world, i === 0 ? commands : []);
}

/** First node owned by `faction`, or throws — tests should fail loudly. */
export function ownedBy(world: World, faction: number) {
  const node = world.nodes.find((n) => n.owner === faction);
  if (!node) throw new Error(`faction ${faction} owns nothing`);
  return node;
}

export function neutral(world: World) {
  const node = world.nodes.find((n) => n.owner === null);
  if (!node) throw new Error('no neutral node on this map');
  return node;
}

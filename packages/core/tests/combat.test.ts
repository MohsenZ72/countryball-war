import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config.js';
import { sendableFrom } from '../src/sim/commands.js';
import { resolveArrival } from '../src/sim/world.js';
import type { Army } from '../src/types.js';
import { neutral, ownedBy, run, tinyWorld } from './helpers.js';

function army(partial: Partial<Army> & Pick<Army, 'owner' | 'from' | 'to' | 'count'>): Army {
  return { id: 1, progress: 1, duration: 1, ...partial };
}

describe('arrival resolution', () => {
  it('reinforces a friendly node and allows overfill', () => {
    const world = tinyWorld();
    const node = ownedBy(world, 0);
    node.troops = 10;
    resolveArrival(world, army({ owner: 0, from: node.id, to: node.id, count: 80 }));
    expect(node.troops).toBe(90);
    expect(world.events.at(-1)?.kind).toBe('reinforced');
  });

  it('captures when the column beats the effective defence', () => {
    const world = tinyWorld();
    const node = neutral(world);
    node.troops = 10;
    const defence = 10 * BALANCE.kinds[node.kind].defenceMul;
    resolveArrival(world, army({ owner: 0, from: 0, to: node.id, count: Math.ceil(defence) + 5 }));
    expect(node.owner).toBe(0);
    expect(node.troops).toBeGreaterThan(0);
    expect(world.events.at(-1)?.kind).toBe('captured');
  });

  it('is repelled when the column falls short, losing troops one for one', () => {
    const world = tinyWorld();
    const node = neutral(world);
    node.kind = 'city' as typeof node.kind;
    node.troops = 20;
    resolveArrival(world, army({ owner: 0, from: 0, to: node.id, count: 8 }));
    expect(node.owner).toBeNull();
    expect(node.troops).toBeCloseTo(12, 5);
    expect(world.events.at(-1)?.kind).toBe('repelled');
  });

  it('makes a fort cost more to take than a city with the same garrison', () => {
    const world = tinyWorld();
    const city = neutral(world);
    city.kind = 'city' as typeof city.kind;
    city.troops = 20;
    const fort = world.nodes.find((n) => n.owner === null && n.id !== city.id);
    if (!fort) throw new Error('need a second neutral node');
    fort.kind = 'fort' as typeof fort.kind;
    fort.troops = 20;

    resolveArrival(world, army({ owner: 0, from: 0, to: city.id, count: 22 }));
    resolveArrival(world, army({ owner: 0, from: 0, to: fort.id, count: 22 }));
    expect(city.owner).toBe(0);
    expect(fort.owner).toBeNull();
  });

  it('makes a capital harder to take than the same node unfortified', () => {
    const world = tinyWorld();
    const capital = world.nodes.find((n) => n.capital && n.owner === 1);
    const plain = world.nodes.find((n) => !n.capital && n.owner === null);
    if (!capital || !plain) throw new Error('need a rival capital and a plain node');
    plain.kind = capital.kind;
    plain.troops = 20;
    capital.troops = 20;
    const column = Math.ceil(20 * BALANCE.kinds[capital.kind].defenceMul) + 1;
    resolveArrival(world, army({ owner: 0, from: 0, to: plain.id, count: column }));
    resolveArrival(world, army({ owner: 0, from: 0, to: capital.id, count: column }));
    expect(plain.owner).toBe(0);
    expect(capital.owner).toBe(1);
  });

  it('cannot take a node that is still in fallout', () => {
    const world = tinyWorld();
    const node = neutral(world);
    node.troops = 0;
    node.falloutFor = 2;
    resolveArrival(world, army({ owner: 0, from: 0, to: node.id, count: 50 }));
    expect(node.owner).toBeNull();
    expect(world.events.at(-1)?.kind).toBe('repelled');
  });
});

describe('send sizing', () => {
  it('always leaves the garrison floor behind', () => {
    expect(sendableFrom(10, 1)).toBe(9);
    expect(sendableFrom(10, 0.5)).toBe(5);
    expect(sendableFrom(1, 1)).toBe(0);
    expect(sendableFrom(0, 1)).toBe(0);
  });

  it('moves troops out of the source the moment the order is given', () => {
    const world = tinyWorld();
    const source = ownedBy(world, 0);
    source.troops = 20;
    const target = neutral(world);
    run(world, 0.05, [{ kind: 'send', faction: 0, from: [source.id], to: target.id, ratio: 0.5 }]);
    expect(source.troops).toBeLessThan(12);
    expect(world.armies.length).toBe(1);
    expect(world.armies[0]?.count).toBe(10);
  });
});

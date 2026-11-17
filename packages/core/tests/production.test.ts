import { describe, expect, it } from 'vitest';
import { BALANCE, capacityOf, rateOf } from '../src/config.js';
import { stepWorld } from '../src/sim/world.js';
import { neutral, ownedBy, run, tinyWorld } from './helpers.js';

describe('production', () => {
  it('grows an owned garrison at the level rate', () => {
    const world = tinyWorld();
    const node = ownedBy(world, 0);
    const before = node.troops;
    run(world, 10);
    const expected = before + rateOf(node.level, node.kind) * 10;
    expect(node.troops).toBeCloseTo(Math.min(expected, capacityOf(node.level, node.kind)), 5);
  });

  it('stops at the node capacity', () => {
    const world = tinyWorld();
    const node = ownedBy(world, 0);
    run(world, 400);
    expect(node.troops).toBeCloseTo(capacityOf(node.level, node.kind), 5);
  });

  it('leaves neutral garrisons untouched', () => {
    const world = tinyWorld();
    const node = neutral(world);
    const before = node.troops;
    run(world, 60);
    expect(node.troops).toBe(before);
  });

  it('bleeds overfilled garrisons back down to capacity', () => {
    const world = tinyWorld();
    const node = ownedBy(world, 0);
    const cap = capacityOf(node.level, node.kind);
    node.troops = cap + 10;
    run(world, 5);
    expect(node.troops).toBeCloseTo(cap + 10 - BALANCE.overfillDecay * 5, 5);
    run(world, 60);
    expect(node.troops).toBeCloseTo(cap, 5);
  });

  it('produces nothing while a node is in fallout', () => {
    const world = tinyWorld();
    const node = ownedBy(world, 0);
    node.falloutFor = 3;
    const before = node.troops;
    stepWorld(world);
    expect(node.troops).toBe(before);
    expect(node.falloutFor).toBeCloseTo(3 - BALANCE.dt, 5);
  });
});

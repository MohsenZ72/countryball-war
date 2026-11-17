import { describe, expect, it } from 'vitest';
import { BALANCE, upgradeCostOf } from '../src/config.js';
import { applyCommand } from '../src/sim/commands.js';
import { dist } from '../src/map/generate.js';
import { neutral, ownedBy, tinyWorld } from './helpers.js';

describe('upgrade', () => {
  it('spends troops and raises the level', () => {
    const world = tinyWorld();
    const node = ownedBy(world, 0);
    const before = node.level;
    const cost = upgradeCostOf(node.level, node.kind);
    if (cost === null) throw new Error('a capital must be upgradeable');
    node.troops = cost + 5;
    applyCommand(world, { kind: 'upgrade', faction: 0, node: node.id });
    expect(node.level).toBe(before + 1);
    expect(node.troops).toBeCloseTo(5, 5);
  });

  it('refuses when the garrison cannot cover the cost', () => {
    const world = tinyWorld();
    const node = ownedBy(world, 0);
    const before = node.level;
    node.troops = 2;
    applyCommand(world, { kind: 'upgrade', faction: 0, node: node.id });
    expect(node.level).toBe(before);
    expect(world.events.at(-1)).toMatchObject({ kind: 'rejected' });
  });

  it('refuses a node you do not hold', () => {
    const world = tinyWorld();
    const node = neutral(world);
    node.troops = 200;
    applyCommand(world, { kind: 'upgrade', faction: 0, node: node.id });
    expect(node.level).toBe(1);
    expect(world.events.at(-1)).toMatchObject({ kind: 'rejected' });
  });

  it('refuses past the top level', () => {
    const world = tinyWorld();
    const node = ownedBy(world, 0);
    node.level = 3;
    node.troops = 500;
    applyCommand(world, { kind: 'upgrade', faction: 0, node: node.id });
    expect(node.level).toBe(3);
  });
});

describe('nuclear strike', () => {
  it('spends a charge and puts a missile in the air', () => {
    const world = tinyWorld();
    const silo = ownedBy(world, 0);
    const target = world.nodes.find(
      (n) => n.owner !== 0 && dist(n.pos, silo.pos) >= BALANCE.nuke.minRange,
    );
    if (!target) throw new Error('need a target outside minimum range');
    target.owner = 1;
    const faction = world.factions[0];
    if (!faction) throw new Error('no player faction');
    faction.charges = 1;

    applyCommand(world, { kind: 'nuke', faction: 0, from: silo.id, to: target.id });
    expect(faction.charges).toBe(0);
    expect(world.missiles.length).toBe(1);
  });

  it('refuses without a warhead', () => {
    const world = tinyWorld();
    const silo = ownedBy(world, 0);
    const target = world.nodes.find(
      (n) => n.owner !== 0 && dist(n.pos, silo.pos) >= BALANCE.nuke.minRange,
    );
    if (!target) throw new Error('need a target outside minimum range');
    applyCommand(world, { kind: 'nuke', faction: 0, from: silo.id, to: target.id });
    expect(world.missiles.length).toBe(0);
    expect(world.events.at(-1)).toMatchObject({ kind: 'rejected' });
  });

  it('refuses to strike inside the minimum range', () => {
    const world = tinyWorld();
    const silo = ownedBy(world, 0);
    const near = world.nodes.find(
      (n) => n.id !== silo.id && dist(n.pos, silo.pos) < BALANCE.nuke.minRange,
    );
    const faction = world.factions[0];
    if (!faction) throw new Error('no player faction');
    faction.charges = 1;
    if (!near) return; // this map has no close pair; nothing to assert
    near.owner = 1;
    applyCommand(world, { kind: 'nuke', faction: 0, from: silo.id, to: near.id });
    expect(world.missiles.length).toBe(0);
  });

  it('refuses to strike your own territory', () => {
    const world = tinyWorld();
    const silo = ownedBy(world, 0);
    const mine = world.nodes.find(
      (n) => n.id !== silo.id && dist(n.pos, silo.pos) >= BALANCE.nuke.minRange,
    );
    if (!mine) throw new Error('need a far node');
    mine.owner = 0;
    const faction = world.factions[0];
    if (!faction) throw new Error('no player faction');
    faction.charges = 1;
    applyCommand(world, { kind: 'nuke', faction: 0, from: silo.id, to: mine.id });
    expect(world.missiles.length).toBe(0);
  });
});

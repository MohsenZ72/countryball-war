import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config.js';
import { dist } from '../src/map/generate.js';
import { applyCommand, stepWorld } from '../src/index.js';
import { ownedBy, run, tinyWorld } from './helpers.js';

describe('warhead impact', () => {
  it('wipes the garrison, frees the territory and leaves fallout', () => {
    const world = tinyWorld();
    const silo = ownedBy(world, 0);
    const target = world.nodes.find(
      (n) => n.owner !== 0 && dist(n.pos, silo.pos) >= BALANCE.nuke.minRange,
    );
    if (!target) throw new Error('need a far target');
    target.owner = 1;
    target.troops = 50;
    target.level = 3;
    const faction = world.factions[0];
    if (!faction) throw new Error('no player faction');
    faction.charges = 1;

    applyCommand(world, { kind: 'nuke', faction: 0, from: silo.id, to: target.id });
    run(world, BALANCE.nuke.flightTime + BALANCE.dt);

    expect(target.troops).toBe(0);
    expect(target.owner).toBeNull();
    expect(target.level).toBe(3 - BALANCE.nuke.levelLoss);
    expect(target.falloutFor).toBeGreaterThan(0);
  });

  it('lets the territory be walked into once the fallout clears', () => {
    const world = tinyWorld();
    const target = world.nodes.find((n) => n.owner === null);
    if (!target) throw new Error('need a neutral node');
    target.troops = 0;
    target.falloutFor = BALANCE.nuke.falloutTime;
    run(world, BALANCE.nuke.falloutTime + 0.1);
    expect(target.falloutFor).toBe(0);

    const source = ownedBy(world, 0);
    source.troops = 20;
    stepWorld(world, [{ kind: 'send', faction: 0, from: [source.id], to: target.id, ratio: 1 }]);
    run(world, 8);
    expect(target.owner).toBe(0);
  });

  it('caps banked charges', () => {
    const world = tinyWorld();
    const faction = world.factions[0];
    if (!faction) throw new Error('no player faction');
    // Leave the rival one node, or the match ends before any charge accrues.
    world.nodes.forEach((node, i) => {
      node.owner = i === world.nodes.length - 1 ? 1 : 0;
      node.kind = 'factory' as typeof node.kind;
    });
    // Stay inside the match time limit, or the territory lead ends the match
    // before the last charge is banked.
    const needed = BALANCE.nuke.maxCharges / BALANCE.kinds.factory.chargeRate;
    expect(needed).toBeLessThan(BALANCE.timeLimit);
    run(world, needed + 5);
    expect(world.outcome.state).toBe('running');
    expect(faction.charges).toBe(BALANCE.nuke.maxCharges);
  });

  it('arms a warhead at the documented rate', () => {
    const world = tinyWorld();
    const faction = world.factions[0];
    if (!faction) throw new Error('no player faction');
    world.nodes.forEach((node, i) => {
      node.owner = i === world.nodes.length - 1 ? 1 : 0;
      node.kind = i === world.nodes.length - 1 ? node.kind : ('city' as typeof node.kind);
    });
    const silo = world.nodes[0];
    if (!silo) throw new Error('empty map');
    silo.kind = 'factory' as typeof silo.kind;
    const secondsPerCharge = 1 / BALANCE.kinds.factory.chargeRate;
    run(world, secondsPerCharge - 1);
    expect(faction.charges).toBe(0);
    run(world, 2);
    expect(faction.charges).toBe(1);
  });
});

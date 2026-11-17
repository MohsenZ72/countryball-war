import { describe, expect, it } from 'vitest';
import { BALANCE, capacityOf, defenceMulOf, rateOf, upgradeCostOf } from '../src/config.js';
import type { NodeKind } from '../src/types.js';

const KINDS: readonly NodeKind[] = ['city', 'fort', 'factory'];

describe('balance invariants', () => {
  it('rewards upgrading with both capacity and rate', () => {
    for (let level = 1; level < BALANCE.levels.length; level++) {
      expect(capacityOf(level + 1, 'city')).toBeGreaterThan(capacityOf(level, 'city'));
      expect(rateOf(level + 1, 'city')).toBeGreaterThan(rateOf(level, 'city'));
    }
  });

  it('makes each upgrade cost more than the last', () => {
    for (const kind of KINDS) {
      let previous = 0;
      for (let level = 1; level <= BALANCE.levels.length; level++) {
        const cost = upgradeCostOf(level, kind);
        if (cost === null) {
          expect(level).toBe(BALANCE.levels.length);
          continue;
        }
        expect(cost).toBeGreaterThan(previous);
        previous = cost;
      }
    }
  });

  it('keeps every upgrade reachable from the node that pays for it', () => {
    // Regression guard. A flat cost of 25 troops was unreachable for a level-1
    // city (capacity 20) and for every fort, which silently removed the whole
    // build path from the game. See ADR-0006.
    for (const kind of KINDS) {
      for (let level = 1; level <= BALANCE.levels.length; level++) {
        const cost = upgradeCostOf(level, kind);
        if (cost === null) continue;
        expect(cost + BALANCE.garrisonFloor).toBeLessThan(capacityOf(level, kind));
      }
    }
  });

  it('pays back an upgrade within a sensible window', () => {
    // A level-1 node must earn back its upgrade in under two minutes of
    // holding, otherwise investing is never the right move.
    for (const kind of KINDS) {
      const cost = upgradeCostOf(1, kind);
      if (cost === null) throw new Error('level 1 must be upgradeable');
      const gain = rateOf(2, kind) - rateOf(1, kind);
      expect(gain).toBeGreaterThan(0);
      expect(cost / gain).toBeLessThan(120);
    }
  });

  it('gives each node kind a distinct role', () => {
    const { city, fort, factory } = BALANCE.kinds;
    expect(fort.defenceMul).toBeGreaterThan(city.defenceMul);
    expect(factory.defenceMul).toBeLessThan(city.defenceMul);
    expect(factory.rateMul).toBeGreaterThan(city.rateMul);
    expect(fort.rateMul).toBeLessThan(city.rateMul);
    expect(factory.chargeRate).toBeGreaterThan(0);
    expect(city.chargeRate).toBe(0);
    expect(fort.chargeRate).toBe(0);
  });

  it('keeps a warhead slower to arm than a garrison is to rebuild', () => {
    // Warheads must be an occasional swing, not the main economy.
    const secondsPerCharge = 1 / BALANCE.kinds.factory.chargeRate;
    expect(secondsPerCharge).toBeGreaterThan(capacityOf(1, 'city') / rateOf(1, 'city'));
  });

  it('orders bot skills from calm to ruthless on every axis', () => {
    const order = ['calm', 'steady', 'sharp', 'ruthless'] as const;
    for (let i = 1; i < order.length; i++) {
      const prev = BALANCE.bots[order[i - 1]];
      const curr = BALANCE.bots[order[i]];
      // Better commanders react faster, commit a larger share per order,
      // hold a real reserve on the border, refuse less free ground, and are
      // readier to spend a warhead.
      expect(curr.thinkEvery).toBeLessThan(prev.thinkEvery);
      expect(curr.commitRatio).toBeGreaterThan(prev.commitRatio);
      // Reserves up, hold-back down: both directions are measured, not
      // assumed. See the comment block on BALANCE.bots.
      expect(curr.reserveRatio).toBeGreaterThan(prev.reserveRatio);
      expect(curr.holdRatio).toBeLessThan(prev.holdRatio);
      expect(curr.safetyMargin).toBeLessThan(prev.safetyMargin);
      expect(curr.nukeWillingness).toBeGreaterThan(prev.nukeWillingness);
    }
  });

  it('keeps every assault margin above break-even', () => {
    // A margin below 1 would mean committing to assaults that cannot win.
    for (const profile of Object.values(BALANCE.bots)) {
      expect(profile.safetyMargin).toBeGreaterThan(1);
      expect(profile.commitRatio).toBeGreaterThan(0);
      expect(profile.commitRatio).toBeLessThanOrEqual(1);
    }
  });

  it('fortifies capitals', () => {
    expect(BALANCE.capitalDefenceMul).toBeGreaterThan(1);
    expect(defenceMulOf('city', true)).toBeGreaterThan(defenceMulOf('city', false));
    // A capital must still be takeable by a determined assault, not a wall.
    expect(defenceMulOf('fort', true)).toBeLessThan(3);
  });

  it('steps at 30 Hz', () => {
    expect(1 / BALANCE.dt).toBeCloseTo(30, 10);
  });
});

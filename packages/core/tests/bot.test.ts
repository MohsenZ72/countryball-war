import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config.js';
import { buildLevel, CAMPAIGN, buildSkirmish } from '../src/levels.js';
import { createMatch, runHeadless, stepMatch } from '../src/match.js';
import type { FactionSpec } from '../src/sim/world.js';

/** Replaces the human seat with a bot so a level can be run headless. */
function allBots(init: ReturnType<typeof buildLevel>, skill: FactionSpec['skill'] = 'sharp') {
  return {
    ...init,
    factions: init.factions.map((f, i) =>
      i === 0 ? { ...f, control: 'bot' as const, skill } : f,
    ),
  };
}

describe('bot commanders', () => {
  it('expands out of its capital within the first minute', () => {
    const match = createMatch(allBots(buildLevel(CAMPAIGN[0]!)));
    for (let i = 0; i < 60 / BALANCE.dt; i++) stepMatch(match);
    const owned = match.world.nodes.filter((n) => n.owner === 0).length;
    expect(owned).toBeGreaterThan(1);
  });

  it('finishes every campaign level inside the time limit', () => {
    for (const level of CAMPAIGN) {
      const result = runHeadless(allBots(buildLevel(level)));
      expect(result.outcome.state).not.toBe('running');
      expect(result.time).toBeLessThanOrEqual(BALANCE.timeLimit + BALANCE.dt);
      expect(result.captures).toBeGreaterThan(0);
    }
  });

  it('never leaves a stuck match running forever', () => {
    const result = runHeadless(buildSkirmish({ seed: 31337, opponents: ['calm', 'calm', 'calm'], allBots: true }));
    expect(result.steps).toBeLessThanOrEqual(BALANCE.timeLimit / BALANCE.dt + 2);
  });

  it('gives the stronger skill the better record over many seeds', () => {
    let ruthless = 0;
    let calm = 0;
    for (let seed = 1; seed <= 16; seed++) {
      const init = buildSkirmish({ seed: seed * 977, opponents: ['calm'], nodeCount: 12, allBots: true });
      const tuned = {
        ...init,
        factions: init.factions.map((f, i) =>
          i === 0 ? { ...f, control: 'bot' as const, skill: 'ruthless' as const } : f,
        ),
      };
      const result = runHeadless(tuned);
      if (result.outcome.state === 'won') {
        if (result.outcome.faction === 0) ruthless++;
        else calm++;
      }
    }
    expect(ruthless + calm).toBeGreaterThan(8);
    expect(ruthless).toBeGreaterThan(calm);
  });

  it('uses warheads on factory-heavy maps', () => {
    // Warheads are situational by design: a bot only spends one on a garrison
    // it could not storm by hand. Assert across seeds, not on a single match.
    let nukes = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const init = buildSkirmish({
        seed: seed * 8181,
        opponents: ['ruthless', 'ruthless'],
        nodeCount: 16,
        allBots: true,
      });
      nukes += runHeadless({
        ...init,
        map: { ...init.map, kindMix: { fort: 0.18, factory: 0.42 } },
        factions: init.factions.map((f, i) => (i === 0 ? { ...f, skill: 'ruthless' as const } : f)),
      }).nukes;
    }
    expect(nukes).toBeGreaterThan(0);
  });

  it('keeps a transitive skill ladder', () => {
    // ruthless beats sharp beats steady beats calm, measured not asserted.
    const pairs = [
      ['ruthless', 'sharp'],
      ['sharp', 'steady'],
      ['steady', 'calm'],
    ] as const;
    for (const [strong, weak] of pairs) {
      let strongWins = 0;
      let weakWins = 0;
      for (let seed = 1; seed <= 16; seed++) {
        const init = buildSkirmish({ seed: seed * 7919, opponents: [weak], nodeCount: 14, allBots: true });
        const result = runHeadless({
          ...init,
          factions: init.factions.map((f, i) => (i === 0 ? { ...f, skill: strong } : f)),
        });
        if (result.outcome.state === 'won') {
          if (result.outcome.faction === 0) strongWins++;
          else weakWins++;
        }
      }
      expect(strongWins, `${strong} should beat ${weak}`).toBeGreaterThan(weakWins);
    }
  });
});

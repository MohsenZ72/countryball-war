import { describe, expect, it } from 'vitest';
import { buildSkirmish } from '../src/levels.js';
import { runHeadless } from '../src/match.js';
import { createMatch, stepMatch } from '../src/match.js';
import type { World } from '../src/types.js';

function fingerprint(world: World): string {
  return [
    world.time.toFixed(4),
    world.nodes.map((n) => `${n.owner ?? 'x'}:${n.troops.toFixed(4)}:${n.level}`).join('|'),
    world.armies.map((a) => `${a.owner}:${a.count}:${a.progress.toFixed(4)}`).join('|'),
    world.factions.map((f) => `${f.charges}:${f.chargeProgress.toFixed(4)}`).join('|'),
  ].join('#');
}

describe('determinism', () => {
  it('produces an identical world from the same seed', () => {
    const init = buildSkirmish({ seed: 4242, opponents: ['sharp', 'steady', 'calm'], allBots: true });
    const a = createMatch(init);
    const b = createMatch(init);
    for (let i = 0; i < 3000; i++) {
      stepMatch(a);
      stepMatch(b);
    }
    expect(fingerprint(a.world)).toBe(fingerprint(b.world));
  });

  it('diverges for different seeds', () => {
    const a = runHeadless(buildSkirmish({ seed: 1, opponents: ['sharp', 'sharp'], allBots: true }));
    const b = runHeadless(buildSkirmish({ seed: 2, opponents: ['sharp', 'sharp'], allBots: true }));
    expect(a.captures).not.toBe(b.captures);
  });
});

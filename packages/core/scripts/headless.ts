/**
 * Balance harness: `npm run sim`.
 *
 * Runs bot-vs-bot matches across many seeds and prints how the skills fare,
 * how long matches last and how often warheads fly. Use it to check a balance
 * change before touching the client.
 */

import { BALANCE } from '../src/config.js';
import { buildSkirmish } from '../src/levels.js';
import { runHeadless } from '../src/match.js';
import type { BotSkill } from '../src/types.js';

const SEEDS = Number(process.env.SIM_SEEDS ?? 24);
const MATCHUPS: readonly (readonly BotSkill[])[] = [
  ['calm', 'calm'],
  ['steady', 'calm'],
  ['sharp', 'steady'],
  ['ruthless', 'sharp'],
  ['ruthless', 'sharp', 'steady', 'calm'],
];

for (const matchup of MATCHUPS) {
  const wins = new Map<number, number>();
  let draws = 0;
  let totalTime = 0;
  let totalCaptures = 0;
  let totalNukes = 0;

  for (let seed = 1; seed <= SEEDS; seed++) {
    const opponents = matchup.slice(1);
    const init = buildSkirmish({ seed: seed * 7919, opponents, allBots: true });
    const first = matchup[0] ?? 'steady';
    const result = runHeadless({
      ...init,
      factions: init.factions.map((f, i) => (i === 0 ? { ...f, skill: first } : f)),
    });
    if (result.outcome.state === 'won') {
      wins.set(result.outcome.faction, (wins.get(result.outcome.faction) ?? 0) + 1);
    } else {
      draws++;
    }
    totalTime += result.time;
    totalCaptures += result.captures;
    totalNukes += result.nukes;
  }

  const record = matchup
    .map((skill, i) => `${skill} ${wins.get(i) ?? 0}`)
    .join('  ');
  console.log(
    [
      matchup.join(' vs ').padEnd(38),
      record.padEnd(44),
      `draws ${String(draws).padStart(2)}`,
      `avg ${(totalTime / SEEDS).toFixed(0)}s`,
      `captures ${(totalCaptures / SEEDS).toFixed(1)}`,
      `nukes ${(totalNukes / SEEDS).toFixed(1)}`,
    ].join('  '),
  );
}
console.log(`\n${SEEDS} seeds per matchup, ${BALANCE.timeLimit}s time limit, ${1 / BALANCE.dt} Hz`);

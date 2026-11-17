/**
 * Match driver: binds bot commanders to a world and advances both together.
 *
 * The client calls `stepMatch` once per fixed step with whatever the player
 * queued; the headless runner calls the same function with an empty queue.
 * Both therefore exercise identical code, which is why a balance change can be
 * checked by `npm run sim` before anyone opens a browser.
 */

import { createBotState, thinkBot, type BotState } from './ai/bot.js';
import { BALANCE, type Balance } from './config.js';
import { createWorld, standings, stepWorld, type WorldInit } from './sim/world.js';
import type { Command, FactionId, SimEvent, World } from './types.js';

export interface Match {
  readonly world: World;
  readonly bots: Map<FactionId, BotState>;
  readonly balance: Balance;
}

export function createMatch(init: WorldInit, balance: Balance = BALANCE): Match {
  const world = createWorld(init, balance);
  const bots = new Map<FactionId, BotState>();
  for (const faction of world.factions) {
    if (faction.control === 'bot') bots.set(faction.id, createBotState(faction.id, balance));
  }
  return { world, bots, balance };
}

/**
 * Advances the match one fixed step.
 *
 * Player commands are applied before bot commands so a player who reacts
 * inside the same step always wins the race — the game should never feel like
 * it ignored an input in favour of the computer.
 */
export function stepMatch(match: Match, playerCommands: readonly Command[] = []): readonly SimEvent[] {
  const commands: Command[] = [...playerCommands];
  for (const [factionId, state] of match.bots) {
    commands.push(...thinkBot(match.world, factionId, state, match.balance));
  }
  return stepWorld(match.world, commands, match.balance);
}

export interface HeadlessResult {
  readonly outcome: World['outcome'];
  /** Simulated seconds played. */
  readonly time: number;
  readonly steps: number;
  readonly standings: ReturnType<typeof standings>;
  readonly captures: number;
  readonly nukes: number;
}

/** Runs a match to completion with no player input. Used by tests and `npm run sim`. */
export function runHeadless(init: WorldInit, balance: Balance = BALANCE): HeadlessResult {
  const match = createMatch(init, balance);
  let steps = 0;
  let captures = 0;
  let nukes = 0;
  const maxSteps = Math.ceil((init.timeLimit ?? balance.timeLimit) / balance.dt) + 2;
  while (match.world.outcome.state === 'running' && steps < maxSteps) {
    for (const event of stepMatch(match)) {
      if (event.kind === 'captured') captures++;
      else if (event.kind === 'nuke-hit') nukes++;
    }
    steps++;
  }
  return {
    outcome: match.world.outcome,
    time: match.world.time,
    steps,
    standings: standings(match.world, balance),
    captures,
    nukes,
  };
}

/** Public surface of the simulation package. The client imports only from here. */

export * from './types.js';
export * from './config.js';
export * from './rng.js';
export * from './nations.js';
export * from './levels.js';
export { generateMap, dist, type GeneratedMap, type MapSpec } from './map/generate.js';
export {
  createWorld,
  stepWorld,
  standings,
  nodesOf,
  distanceBetween,
  resolveArrival,
  type FactionSpec,
  type FactionStanding,
  type WorldInit,
} from './sim/world.js';
export { applyCommand, sendableFrom, marchDuration } from './sim/commands.js';
export { createBotState, thinkBot, type BotState } from './ai/bot.js';
export { createMatch, stepMatch, runHeadless, type HeadlessResult, type Match } from './match.js';

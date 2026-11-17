/**
 * Campaign definition.
 *
 * Levels are seeded, not hand-placed: a level id hashes to a seed, so the map
 * is identical for every player on every device yet costs nothing to author.
 * The ramp introduces one idea at a time — expansion, then two fronts, then
 * factories and warheads, then genuine multipolar pressure.
 */

import { seedFrom } from './rng.js';
import type { MapSpec } from './map/generate.js';
import { nationAt } from './nations.js';
import type { BotSkill } from './types.js';
import type { FactionSpec, WorldInit } from './sim/world.js';

export interface LevelDef {
  readonly id: string;
  readonly name: string;
  /** One line shown on the level card. Teaches the idea the level is about. */
  readonly brief: string;
  readonly nodeCount: number;
  readonly bounds: { readonly x: number; readonly y: number };
  readonly minSpacing: number;
  readonly opponents: readonly BotSkill[];
  readonly garrisonScale: number;
  readonly kindMix?: { readonly fort: number; readonly factory: number };
  /** Beating the level under this many seconds earns the third star. */
  readonly parTime: number;
}

export const CAMPAIGN: readonly LevelDef[] = [
  {
    id: 'first-steps',
    name: 'First Steps',
    brief: 'Drag from your capital onto a grey territory to take it.',
    nodeCount: 8,
    bounds: { x: 1180, y: 700 },
    minSpacing: 150,
    opponents: ['calm'],
    garrisonScale: 0.65,
    parTime: 100,
  },
  {
    id: 'two-fronts',
    name: 'Two Fronts',
    brief: 'Two rivals, one map. Do not open a second front before you can hold the first.',
    nodeCount: 11,
    bounds: { x: 1320, y: 760 },
    minSpacing: 140,
    opponents: ['calm', 'calm'],
    garrisonScale: 0.8,
    parTime: 150,
  },
  {
    id: 'factory-floor',
    name: 'Factory Floor',
    brief: 'Factories out-produce cities and build warheads. Take them early.',
    nodeCount: 12,
    bounds: { x: 1340, y: 780 },
    minSpacing: 138,
    opponents: ['steady'],
    garrisonScale: 0.9,
    kindMix: { fort: 0.14, factory: 0.34 },
    parTime: 160,
  },
  {
    id: 'the-narrows',
    name: 'The Narrows',
    brief: 'Short marches cut both ways. Nothing you take here is safe for long.',
    nodeCount: 13,
    bounds: { x: 1200, y: 720 },
    minSpacing: 120,
    opponents: ['steady', 'calm'],
    garrisonScale: 0.95,
    parTime: 180,
  },
  {
    id: 'fortress-line',
    name: 'Fortress Line',
    brief: 'Forts defend at 1.6x. Pool several garrisons into one assault.',
    nodeCount: 14,
    bounds: { x: 1440, y: 820 },
    minSpacing: 132,
    opponents: ['steady', 'steady'],
    garrisonScale: 1,
    kindMix: { fort: 0.42, factory: 0.12 },
    parTime: 210,
  },
  {
    id: 'three-crowns',
    name: 'Three Crowns',
    brief: 'Three rivals. Let two of them bleed each other first.',
    nodeCount: 15,
    bounds: { x: 1500, y: 860 },
    minSpacing: 130,
    opponents: ['steady', 'steady', 'calm'],
    garrisonScale: 1,
    parTime: 230,
  },
  {
    id: 'warhead',
    name: 'Warhead',
    brief: 'Hold factories to arm a strike. A struck territory falls to whoever walks in.',
    nodeCount: 15,
    bounds: { x: 1500, y: 860 },
    minSpacing: 132,
    opponents: ['sharp', 'steady'],
    garrisonScale: 1.05,
    kindMix: { fort: 0.2, factory: 0.3 },
    parTime: 240,
  },
  {
    id: 'attrition',
    name: 'Attrition',
    brief: 'Fat neutral garrisons. Upgrade at home before you spend troops abroad.',
    nodeCount: 17,
    bounds: { x: 1560, y: 880 },
    minSpacing: 128,
    opponents: ['sharp', 'steady', 'steady'],
    garrisonScale: 1.3,
    parTime: 270,
  },
  {
    id: 'encirclement',
    name: 'Encirclement',
    brief: 'You start in the middle. Everything is a border.',
    nodeCount: 18,
    bounds: { x: 1560, y: 880 },
    minSpacing: 124,
    opponents: ['sharp', 'sharp', 'steady'],
    garrisonScale: 1.15,
    parTime: 290,
  },
  {
    id: 'cold-open',
    name: 'Cold Open',
    brief: 'Everyone has warheads. Keep your best garrison out of range.',
    nodeCount: 19,
    bounds: { x: 1600, y: 900 },
    minSpacing: 124,
    opponents: ['sharp', 'sharp', 'sharp'],
    garrisonScale: 1.1,
    kindMix: { fort: 0.22, factory: 0.3 },
    parTime: 310,
  },
  {
    id: 'great-game',
    name: 'The Great Game',
    brief: 'Four rivals, no safe corner. Trade territory for tempo.',
    nodeCount: 21,
    bounds: { x: 1600, y: 900 },
    minSpacing: 120,
    opponents: ['ruthless', 'sharp', 'sharp', 'steady'],
    garrisonScale: 1.2,
    parTime: 340,
  },
  {
    id: 'last-dictator',
    name: 'The Last Dictator',
    brief: 'Five rivals, every one of them playing to win. Good luck.',
    nodeCount: 23,
    bounds: { x: 1600, y: 900 },
    minSpacing: 118,
    opponents: ['ruthless', 'ruthless', 'sharp', 'sharp', 'steady'],
    garrisonScale: 1.25,
    parTime: 380,
  },
];

export function levelById(id: string): LevelDef | undefined {
  return CAMPAIGN.find((l) => l.id === id);
}

export interface LevelOptions {
  /** Index into `NATIONS` for the player. Cosmetic. */
  readonly playerNation?: number;
  /** Overrides the seed derived from the level id. Used by skirmish rerolls. */
  readonly seed?: number;
}

/** Builds the `WorldInit` for a campaign level. */
export function buildLevel(level: LevelDef, options: LevelOptions = {}): WorldInit {
  const factionCount = level.opponents.length + 1;
  const playerNation = options.playerNation ?? 0;
  const factions: FactionSpec[] = [
    {
      name: nationAt(playerNation).name,
      flag: nationAt(playerNation).flag,
      control: 'human',
    },
    ...level.opponents.map((skill, i) => {
      const nation = nationAt(playerNation + 1 + i);
      return { name: nation.name, flag: nation.flag, control: 'bot' as const, skill };
    }),
  ];
  const map: MapSpec = {
    seed: options.seed ?? seedFrom(level.id),
    bounds: level.bounds,
    nodeCount: level.nodeCount,
    factions: factionCount,
    minSpacing: level.minSpacing,
    garrisonScale: level.garrisonScale,
    ...(level.kindMix ? { kindMix: level.kindMix } : {}),
  };
  return { map, factions };
}

export interface SkirmishOptions {
  readonly seed: number;
  readonly opponents: readonly BotSkill[];
  readonly nodeCount?: number;
  readonly playerNation?: number;
  readonly allBots?: boolean;
}

/** A one-off random map. `allBots` is what `npm run sim` uses for balance runs. */
export function buildSkirmish(options: SkirmishOptions): WorldInit {
  const count = options.opponents.length + 1;
  const nodeCount = options.nodeCount ?? Math.min(24, 8 + count * 3);
  const playerNation = options.playerNation ?? 0;
  const factions: FactionSpec[] = [
    {
      name: nationAt(playerNation).name,
      flag: nationAt(playerNation).flag,
      control: options.allBots ? 'bot' : 'human',
      skill: 'sharp',
    },
    ...options.opponents.map((skill, i) => {
      const nation = nationAt(playerNation + 1 + i);
      return { name: nation.name, flag: nation.flag, control: 'bot' as const, skill };
    }),
  ];
  return {
    map: {
      seed: options.seed,
      bounds: { x: 1600, y: 900 },
      nodeCount,
      factions: count,
      minSpacing: 120,
    },
    factions,
  };
}

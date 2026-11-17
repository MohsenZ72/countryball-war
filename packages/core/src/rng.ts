/**
 * mulberry32 — a small, fast, well-distributed 32-bit PRNG.
 *
 * The simulation stores the raw state on the world so a match can be stepped,
 * serialised and resumed without drift. Never swap this for `Math.random`:
 * determinism is what makes the tests and the bot replays meaningful.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Picks one element. Returns `undefined` for an empty array. */
  pick<T>(items: readonly T[]): T | undefined;
  /** Fisher-Yates, in place. */
  shuffle<T>(items: T[]): T[];
  /** Current state, for storing back on the world. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (n) => Math.floor(next() * n),
    pick: (items) => (items.length === 0 ? undefined : items[Math.floor(next() * items.length)]),
    shuffle: <T>(items: T[]): T[] => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const a = items[i] as T;
        const b = items[j] as T;
        items[i] = b;
        items[j] = a;
      }
      return items;
    },
    state: () => s,
  };
}

/** Hashes a string to a usable seed, so level ids can act as seeds. */
export function seedFrom(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

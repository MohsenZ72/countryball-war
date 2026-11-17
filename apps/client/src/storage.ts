/**
 * Local progress.
 *
 * Browser storage is per-viewer and can be absent, full or blocked (private
 * windows, cleared site data), so every read and write is guarded and the game
 * must work correctly when it returns nothing. Nothing here is authoritative:
 * losing it costs a player their stars, never their ability to play.
 */

const KEY = 'cbw.progress.v1';

export interface LevelRecord {
  /** Fastest winning time in seconds. */
  readonly bestTime: number;
  /** 1-3. Three means a win inside the level's par time. */
  readonly stars: number;
}

export interface Progress {
  readonly levels: Record<string, LevelRecord>;
  /** Index into `NATIONS`. */
  readonly nation: number;
  readonly sound: boolean;
}

const EMPTY: Progress = { levels: {}, nation: 0, sound: true };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      levels: typeof parsed.levels === 'object' && parsed.levels !== null ? parsed.levels : {},
      nation: typeof parsed.nation === 'number' ? parsed.nation : 0,
      sound: parsed.sound !== false,
    };
  } catch {
    return EMPTY;
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable or full. The session still plays; nothing to do.
  }
}

/** Records a win, keeping the better of the old and new result. */
export function recordWin(progress: Progress, levelId: string, time: number, parTime: number): Progress {
  const stars = time <= parTime ? 3 : time <= parTime * 1.5 ? 2 : 1;
  const existing = progress.levels[levelId];
  if (existing && existing.stars >= stars && existing.bestTime <= time) return progress;
  const next: Progress = {
    ...progress,
    levels: {
      ...progress.levels,
      [levelId]: {
        bestTime: existing ? Math.min(existing.bestTime, time) : time,
        stars: Math.max(existing?.stars ?? 0, stars),
      },
    },
  };
  saveProgress(next);
  return next;
}

export function setNation(progress: Progress, nation: number): Progress {
  const next = { ...progress, nation };
  saveProgress(next);
  return next;
}

export function setSound(progress: Progress, sound: boolean): Progress {
  const next = { ...progress, sound };
  saveProgress(next);
  return next;
}

/** A level is playable once the one before it has been won. */
export function isUnlocked(progress: Progress, index: number, ids: readonly string[]): boolean {
  if (index === 0) return true;
  const previous = ids[index - 1];
  return previous !== undefined && progress.levels[previous] !== undefined;
}

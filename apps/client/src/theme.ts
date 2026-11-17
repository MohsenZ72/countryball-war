/**
 * Design tokens.
 *
 * This file is the only place a colour, radius, duration or type size is
 * defined. `docs/04-design-system.md` documents the intent; if the two ever
 * disagree, this file is the truth and the document is the bug.
 *
 * The palette is a cool night map with warm faction colours on top: territory
 * must read instantly at a glance, so faction hues are saturated while every
 * surface behind them stays desaturated and dark.
 */

export const COLOUR = {
  // Surfaces
  abyss: '#0b0f16',
  surface: '#101620',
  raised: '#18212e',
  raisedHover: '#1f2a3a',
  line: '#2a3647',
  // Map
  sea: '#0e141d',
  grid: '#151f2c',
  neutral: '#9aa9bb',
  neutralDeep: '#4a5668',
  // Text
  text: '#e8eef6',
  textDim: '#9fb0c4',
  textFaint: '#67788c',
  // Feedback
  danger: '#ef5350',
  warn: '#f0b429',
  good: '#3fb27f',
  fallout: '#c9f05a',
} as const;

export const RADIUS = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const SPACE = { xs: 4, sm: 8, md: 14, lg: 22, xl: 34 } as const;

/** Motion. Kept short: this is a game, not a slideshow. */
export const MOTION = {
  tapMs: 120,
  popMs: 320,
  flashMs: 520,
  nukeMs: 900,
  /** Honours `prefers-reduced-motion` at call sites that animate decoratively. */
  reduced: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
} as const;

export const TYPE = {
  stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  /** Troop counts and timers. Tabular so digits do not jitter. */
  numeric: "'SF Mono', ui-monospace, 'Cascadia Mono', Menlo, monospace",
} as const;

/** Map-space sizes, in the same units as `World.bounds`. */
export const MAP = {
  nodeRadius: { city: 30, fort: 32, factory: 34 },
  capitalRing: 7,
  armyDot: 4.5,
  /** Pixels the selection ring clears the capital ring by. Screen-space. */
  selectRing: 7,
} as const;

/** One place to ask "how big should touch targets be". */
export const TOUCH = { minTarget: 44 } as const;

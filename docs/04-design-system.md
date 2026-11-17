# Design system

Two token files, one intent. `apps/client/src/theme.ts` is the source of truth
for anything drawn on the canvas; `apps/client/src/styles.css` for anything in
the DOM. This document explains the reasoning. Where it disagrees with the
code, the code is right.

## Principles

1. **The number is the interface.** A garrison's troop count is the single most
   important thing on screen. It is drawn last, at the largest size the node
   allows, in a tabular font, with a dark stroke behind it so it survives any
   background.
2. **Colour means ownership, and nothing else.** Faction hues are the only
   saturated colours in the game. Every surface behind them is desaturated and
   dark so territory reads instantly.
3. **Information on top, actions on the bottom.** On a phone the thumb only
   ever has to reach the bottom strip.
4. **Nothing moves that is not telling you something.** Decoration is skipped
   entirely under `prefers-reduced-motion`, not merely shortened.

## Colour

### Surfaces

| Token | Value | Use |
| --- | --- | --- |
| `abyss` | `#0b0f16` | Page background, letterboxing |
| `surface` | `#101620` | Panels, cards |
| `raised` | `#18212e` | Buttons, list rows |
| `raisedHover` | `#1f2a3a` | Hover |
| `line` | `#2a3647` | Borders |

### Map

| Token | Value | Use |
| --- | --- | --- |
| `sea` | `#0e141d` | Board background |
| `grid` | `#151f2c` | Grid rules |
| `neutral` | `#9aa9bb` | Unclaimed territory |
| `neutralDeep` | `#4a5668` | Its footprint |

Neutral grey is lighter than it looks like it should be. At the first value
(`#6b7a8d`) an unclaimed ball sank into the near-black sea and the troop count
under it was the only thing a player could find. Grey has to read as "a place",
not as empty water.

### Text

`text #e8eef6` · `textDim #9fb0c4` · `textFaint #67788c`. All three pass WCAG AA
for body text on `surface`; `textFaint` is used only for secondary numerals at
14 px or larger.

### Feedback

`danger #ef5350` (warheads, defeat) · `warn #f0b429` (upgrades, primary action)
· `good #3fb27f` (victory) · `fallout #c9f05a` (contaminated ground).

### Faction colours

Twelve, defined in `packages/core/src/nations.ts` with a shade for outlines.
They are chosen to stay distinguishable in pairs on a dark ground, and the
palette avoids relying on red/green alone to separate two factions — kind
badges, capital rings and the flag design all carry the same information.

## Type

- **UI:** the system stack. A game that loads in a tab should not wait on a
  font request.
- **Numbers:** a monospace stack. Troop counts change every frame; tabular
  digits stop them jittering.
- Scale: 30–46 px (fluid) title · 24 px overlay heading · 15 px body · 13 px
  secondary · 12 px numerals.

## Space, radius, motion

Spacing `4 / 8 / 14 / 22 / 34`. Radius `6 / 10 / 16 / 999`.

Motion is short on purpose: tap 120 ms, pop 320 ms, flash 520 ms, warhead
900 ms. The warhead is the only animation long enough to notice, because it is
the only one you are meant to have time to react to.

## Map geometry

Node radii: city 30, fort 32, factory 34 map units. Capital ring 7. Column dot
4.5. Selection ring clears the capital ring by 7 **screen pixels** — not map
units. Scaled with the map, the two rings landed within half a pixel of each
other on a phone, and selection became invisible exactly where it matters most.

## Components

### Territory

A countryball — a circle wearing its flag, with a sphere highlight and two
eyes — over a darker footprint disc. Capitals get a ring in the owner's colour.
Forts and factories get a badge. Levels above 1 get pips. Contaminated ground
gets a draining arc. The troop count sits below, with capacity under it when
the territory is yours.

### Column

A rosette of dots, sized by `sqrt(troops)`, with the count above it. The
arrangement is deterministic — derived from the army id, never from a per-frame
random — so columns do not fizz as they travel. A number alone would be
unreadable in motion; a blob that visibly swells tells a player at a glance
whether an attack is serious.

### HUD strips

Top: level name, clock, standing chips, menu. Bottom: ratio control, upgrade,
warhead, speed. Both sit on a gradient so they never need an opaque bar. Every
control is at least 44x44 px.

### Overlays

Centred card on a blurred scrim. Primary action first and focused on mount.

## Accessibility

- All interactive elements are real `<button>`s with labels. The ratio control
  is a `group` of `aria-pressed` buttons; the nation picker is a `radiogroup`.
- Focus is visible everywhere (2 px `warn` outline, 2 px offset) and never
  removed.
- Live regions: `polite` for order feedback, `alert` for an inbound warhead.
- Keyboard: `Esc`/`Space` pause, `1`/`2`/`3` set the send ratio.
- `prefers-reduced-motion` disables map effects and CSS transitions.
- Colour is never the only signal: ownership is also carried by the flag
  design, kind by a badge shape, level by pip count.

### Known gaps

The board itself is a canvas and is not navigable by keyboard or exposed to a
screen reader. Giving territories a parallel DOM tree with roving focus is the
right fix and is on the roadmap, not done.

## Why there is no light theme

A bright board glares in a dark room, and the faction hues need a dark ground
to separate cleanly. Rather than ship a second palette that fails principle 2,
the tokens are declared once.

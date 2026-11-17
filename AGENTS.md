# Working in this repository

Read this before changing anything. The details are in `docs/`; this is the
short version and the list of things that have already gone wrong here.

## Shape

```
packages/core   the rules. Deterministic, DOM-free, 57 tests.
apps/client     the game. Canvas board, DOM HUD, no framework.
docs/           design, system design, design system, patterns, ADRs, runbook.
.claude/skills/ cbw-balance, cbw-simulation, cbw-client.
```

The client imports the core. The core has never heard of the client. Keep it
that way.

## Before you start

Load the skill that matches the work:

| Changing | Skill |
| --- | --- |
| Any balance number, bot behaviour, difficulty | `cbw-balance` |
| World stepping, combat, commands, maps, levels | `cbw-simulation` |
| Rendering, camera, input, HUD, styling | `cbw-client` |

## Commands

```bash
npm install
npm run dev        # http://localhost:5178
npm test           # 57 tests, ~1.5s
npm run sim        # bot-vs-bot balance harness
npm run typecheck
npm run build
```

`http://localhost:5178/#level=warhead` jumps straight into a level.

## Rules that are not negotiable

1. **Balance numbers live in `packages/core/src/config.ts`.** Nowhere else.
2. **No `Math.random`, `Date.now` or DOM access in `packages/core`.** The
   package compiles without DOM types so a stray `document` fails the build.
3. **Measure balance claims.** `npm run sim` before and after, and update the
   numbers in `docs/02-game-design.md`. Intuition about this game has been
   wrong repeatedly and measurably.
4. **Everything goes through `applyCommand`.** The UI queues commands; it does
   not mutate the world.
5. **Derive, do not store.** Capacity, rate, cost and defence are functions.
6. **Use the camera for any world↔screen conversion.** Bypassing it works on a
   desktop and breaks silently on a phone.
7. **Tokens only** for colours and sizes: `theme.ts` and `styles.css`.
8. **No ads, purchases, analytics or network calls.** This is a product
   decision, recorded in ADR-0004, not an oversight.

## Things that already bit us

Each of these has an ADR; skim them before touching the same area.

- A flat upgrade cost silently removed the whole build path — no error, just a
  stalled bot. ADR-0006.
- Bots not counting their own columns in flight made a *slower* bot beat a
  faster one, and inverted the skill ladder under either definition of
  "better". ADR-0007.
- A portrait phone letterboxed the board to a 0.24 scale. The board rotates
  now. ADR-0008.
- A `display` rule outranked the `hidden` attribute, leaving an invisible
  overlay eating every HUD tap. ADR-0009.

## Definition of done

- `npm test` and `npm run typecheck` pass.
- `npm run sim` run if anything touched balance or bots, with the result
  recorded in `docs/02-game-design.md`.
- Checked in a real browser at 390x844 as well as desktop, if the client
  changed.
- Documentation updated in the same change, not after it.

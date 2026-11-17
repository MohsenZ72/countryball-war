---
name: cbw-simulation
description: Use when changing the Countryball War simulation itself — world stepping, combat resolution, commands, map generation, campaign levels, or anything in packages/core. Covers the determinism contract and the rules that keep the core testable.
---

# Working on the simulation

`packages/core` holds the rules. It has no DOM, no timers, and no randomness it
does not own. The client imports it; it has never heard of the client.

## The determinism contract

Given the same `WorldInit` and the same ordered commands, `stepWorld` produces
a bit-identical `World`. Three rules make that true, all enforced:

1. **No `Math.random`.** The world owns a mulberry32 state. Bots derive their
   randomness from `(step index, faction id)` so they are pure functions of
   world state.
2. **No `Date.now` / `performance.now`.** Time advances only by `BALANCE.dt`.
3. **No DOM.** The package's `tsconfig.json` has `"lib": ["ES2022"]` and no DOM
   types, so a stray `document` fails to compile.

Break any of these and `determinism.test.ts` fails — but only after you have
spent time on a result you cannot reproduce. Check first.

## Where things go

| Change | File |
| --- | --- |
| A balance number | `src/config.ts` (see the `cbw-balance` skill) |
| Combat or production | `src/sim/world.ts` |
| A new player action | `src/types.ts` (`Command`) then `src/sim/commands.ts` |
| Bot behaviour | `src/ai/bot.ts` |
| Map shape | `src/map/generate.ts` |
| A campaign level | `src/levels.ts` |

## Rules of the module

**Every mutation goes through `applyCommand`.** The UI queues commands; it
never writes to the world. A rejected command pushes a `rejected` event with a
sentence a player can read, instead of throwing — a mis-aimed drag is a normal
thing for a player to do.

**Emit events, do not expect diffing.** `stepWorld` returns only the events of
that step. The renderer and audio react to them; the simulation stays unaware
of both.

**Derive, do not store.** Capacity, rate, cost and defence are functions of
level and kind. Caching one on a node guarantees a stale copy.

**One source of truth for defence.** `defenceMulOf(kind, capital)` serves both
the simulation and every bot estimate. If they disagreed, bots would commit to
assaults arithmetic says they cannot win.

## Adding a command

1. Add the variant to `Command` in `types.ts`.
2. Validate and apply it in `commands.ts`, rejecting with a readable reason.
3. Add a `SimEvent` if anything should see it happen.
4. Test the happy path *and* every rejection.
5. Only then wire it into the HUD.

## Testing

```bash
npm test               # 55 tests, ~1.5s
npm run test:watch
npm run sim            # headless bot-vs-bot
```

`bot.test.ts` plays several hundred headless matches, including every campaign
level to completion. That is deliberate: it is the test that catches a stalled
bot, an unreachable level, or a match that never terminates.

Always assert that matches finish. A bot that cannot act and a map that cannot
be won both look like "it is still running".

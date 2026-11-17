# System design

## Shape

```
packages/core  ──  the rules. No DOM, no timers, no randomness it does not own.
      │
      │  World, Command, SimEvent
      ▼
apps/client    ──  the game. Canvas for the board, DOM for the HUD.
```

Two packages, one direction of dependency. The client imports the core; the
core has never heard of the client. Everything else follows from that line.

## The simulation

### Deterministic by construction

Given the same `WorldInit` and the same ordered command stream, `stepWorld`
produces a bit-identical `World`. That requires three rules, all enforced:

1. **No `Math.random`.** The world owns a mulberry32 state. Bots derive their
   randomness from `(step index, faction id)`, so a bot is a pure function of
   world state and does not even need the shared stream.
2. **No `Date.now` or `performance.now`.** Simulated time advances only by
   `BALANCE.dt`.
3. **No DOM.** The package's `tsconfig.json` sets `"lib": ["ES2022"]` with no
   DOM types, so a stray `document` reference fails to compile.

This is not purism. It buys three concrete things: `npm run sim` can play
thousands of matches to validate a balance change, `determinism.test.ts` can
assert that two runs of the same seed fingerprint identically, and a replay or
a network protocol stays possible later without re-deriving the rules.

### Fixed step

30 Hz. The client accumulates real elapsed time and drains it in whole steps,
capped at 6 per frame. The cap matters: without it, a tab that was backgrounded
for a minute would fast-forward the entire match in one frame on return. With
it, the backlog is dropped and the match resumes.

### One place for each rule

- Every balance number is in `config.ts`. Nothing else may hard-code a troop
  count, a rate or a cost.
- Every mutation goes through `applyCommand`. The HUD cannot construct an
  illegal state, because it does not mutate anything — it queues a `Command`.
- Defence is computed by `defenceMulOf` for both the simulation and every bot
  estimate. If those two ever disagreed, bots would commit to assaults that
  arithmetic says they cannot win.

### Events, not diffs

`stepWorld` returns the events of that step and nothing else. The renderer
turns them into short-lived effects and the HUD turns some into messages. No
consumer has to diff two world states to notice that something happened, and
the simulation never has to know a renderer exists.

## The client

### Canvas for the board, DOM for the controls

The board is a few dozen moving shapes at 60 Hz: canvas. The HUD is buttons
that need focus rings, hit targets, labels and a screen reader: DOM. Drawing
buttons into the canvas would mean rebuilding all of that by hand, badly.

### No framework

A 40-line state machine covers the three screens. The whole bundle is ~48 kB
of JavaScript (~17 kB gzipped), which is roughly what a framework would cost
before any game code. See ADR-0003.

### Camera

The whole map is always on screen. This is a game of reading the board, so
panning and zooming would only hide information.

On a portrait screen, the board rotates a quarter turn rather than shrinking.
Maps are authored landscape and must be identical for every player, so the map
is not reshaped per device — it is presented sideways. On a 390x844 phone this
takes a 1440x820 map from a 0.24 scale (ten-pixel territories, unusable) to
0.45. See ADR-0008.

### Input

One `PointerController` handles mouse, touch and pen through pointer events.
Two ways to give the same order, because they suit different hands: **drag**
from a territory onto another (fast with a mouse), or **tap** to select then
tap the target (works one-handed, and lets several sources be pooled).

Hit testing takes whichever is larger, the drawn radius or a 44 px touch
target, so a dense map stays reachable on a phone.

## State that outlives a match

`localStorage`, guarded. Browser storage can be absent, full or blocked, so
every read and write is wrapped and the game must work correctly when it
returns nothing. Losing it costs a player their stars, never their ability to
play. Nothing is sent anywhere — there is no server to send it to.

## Failure modes we designed for

| What happens | What the game does |
| --- | --- |
| Tab backgrounded | Pauses on `visibilitychange`; no fast-forward on return |
| Frame rate collapses | Fixed step keeps the simulation honest; catch-up is capped |
| `localStorage` throws | Caught; the session plays normally with no progress saved |
| No `AudioContext` | Caught; the game is silent |
| Canvas 2D unavailable | Throws at mount with a plain message |
| Reduced motion | Decorative effects are skipped entirely, not shortened |
| An illegal order | Rejected with a reason, shown to the player as a sentence |

## What is deliberately missing

- **No server.** The build is static files.
- **No analytics.** Nothing is measured about the player.
- **No asset pipeline.** Every flag, icon and sound is generated at runtime, so
  there is nothing to optimise, licence or cache-bust.

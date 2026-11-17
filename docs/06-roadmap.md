# Roadmap

## Done

- **Simulation.** Deterministic 30 Hz step, production, movement, combat,
  upgrades, warheads, elimination, territory-count tiebreak. 55 tests.
- **Bots.** Four skill profiles with a measured, strictly-ordered ladder;
  survive / strike / invest / escalate / commit priority; garrison pooling
  across territories whose columns land together.
- **Campaign.** Twelve seeded levels with a measured difficulty ramp, stars
  against par time, local progress, level unlocking.
- **Client.** Canvas board with rotation for portrait screens, drag and tap
  input, pooled selection, HUD, pause, result screen, procedural flags and
  sound, PWA manifest.
- **Tooling.** Headless balance harness, typechecked workspace, CI.

## Next

**1. Keyboard and screen-reader access to the board.** The only accessibility
gap that is not a detail. Territories need a parallel DOM tree with roving
focus, so the whole game is playable without a pointer.

**2. Measure match length with humans.** Every length figure comes from bots in
every seat. Levels 10–12 have never been timed with a person playing.

**3. Skirmish mode in the UI.** `buildSkirmish` exists and is used by the test
suite and the balance harness, but there is no screen for it. Random map,
pick your rivals.

**4. A reason to look at forts again.** They may be under-taken: the bot value
function might be undervaluing a 1.6x defender relative to a factory. Needs
measurement before it needs a change.

## Considered, not committed

- **Multiplayer.** The simulation is deterministic and command-driven, so a
  lockstep or server-authoritative model is a reasonable fit. It is not
  committed because it turns a static bundle into a service with hosting,
  abuse handling and uptime. Not worth it until people are playing.
- **A comeback mechanic.** Whether the genre needs one here is an open
  question. Measure first.
- **More nations, map themes, alternate rules** (fog, timed objectives).
  Cheap to add, no evidence yet that they are wanted.

## Explicitly not planned

- Ads, in-app purchases, energy timers, daily rewards, accounts, analytics.
  See ADR-0004. These are not missing features; their absence is the design.

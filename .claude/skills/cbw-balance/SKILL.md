---
name: cbw-balance
description: Use when changing any game balance number, bot behaviour or difficulty in Countryball War — troop rates, capacities, upgrade costs, march speed, warheads, bot skill profiles, or campaign level definitions. Covers how to measure a change instead of guessing at it.
---

# Tuning Countryball War

## The rule

**Measure, then assert.** Four separate intuitions about bot behaviour were
wrong before measurement settled them, including the confident one that a
faster-thinking bot must beat a slower one. Do not ship a balance change you
have not run.

## Where numbers live

`packages/core/src/config.ts`, and nowhere else. A troop count, rate or cost
anywhere else in the codebase is a bug. Capacity, production, upgrade cost and
defence are *derived* by `capacityOf`, `rateOf`, `upgradeCostOf` and
`defenceMulOf` — never stored on a node.

## The loop

```bash
npm test          # invariants + the skill ladder, ~1.5s
npm run sim       # 24 seeds per matchup, prints the full table
SIM_SEEDS=64 npm run sim   # when a result looks marginal
```

A change is acceptable when:

- all tests pass, including the re-measured ladder in `bot.test.ts`;
- `npm run sim` keeps the ladder ordered (ruthless > sharp > steady > calm) in
  both the duels and the four-way;
- average match length stays roughly 60–180 s.

Then record what you measured in `docs/02-game-design.md`. The numbers in that
document are claims about this build, and a stale one is worse than none.

## Invariants the tests enforce

- Every upgrade is affordable by the node that pays for it, for every kind and
  level (`cost + garrisonFloor < capacity`). A flat cost once locked every fort
  out of the build path with no error — see ADR-0006.
- Upgrades repay themselves in under 120 s of holding.
- Each node kind keeps a distinct role: fort defends best, factory produces
  best and alone arms warheads.
- The bot ladder is monotonic on every axis *and* wins in measured play.

## Tuning a bot profile

Coordinate descent against a fixed opponent. Hold three skills constant, sweep
one axis of the fourth across 5–7 values at 40 seeds each, keep the best, move
to the next axis, then repeat the pass.

What the last run found, so you do not rediscover it:

| Axis | Effect |
| --- | --- |
| `reserveRatio` | Dominant. 0.00 → 33% win rate, 0.34 → 88%. Higher is better |
| `holdRatio` | Large and **inverted**. 0.00 → 97%, 0.40 → 47%. Lower is better |
| `commitRatio` | Moderate, noisy. 0.70–0.85 all play well |
| `safetyMargin` | Nearly flat, 1.02 to 1.60 |
| `thinkEvery` | Flat, since bots started counting columns in flight |
| `buildBias` | No measurable effect on a bot at any value |

Pushing a good axis further does not keep paying: a profile at `commitRatio`
0.92 / `reserveRatio` 0.10 over-extends and measures *worse* than a moderate
one. Ruthless wins on reaction speed and warhead use, not on more bodies.

## Traps

- **Changing a bot without re-running `npm run sim`.** The ladder is easy to
  invert and the inversion is invisible from a single match.
- **Making a capital reserve too strict.** At 0.6 it stopped the strongest bot
  spending its capital and flipped the ladder. 0.25 prevents abandonment
  without dictating strategy.
- **Adding a balance number outside `config.ts`.**
- **Reading the clock or `Math.random` in `packages/core`.** It breaks
  determinism, and `determinism.test.ts` will catch it — after you have wasted
  time on an unreproducible result.

# ADR-0006: Upgrade cost is a share of capacity, not a flat number

**Status:** accepted · **Date:** 2026-11-17

## Context

The first balance pass set flat upgrade costs: 25 troops for level 1→2, 55 for
2→3. It read well in a table.

## Problem

A level-1 city caps at 20 troops. A level-1 fort caps at 14. Neither can ever
hold 25 troops, so neither could ever upgrade — and since forts cap lower at
every level, forts were locked out of the build path entirely.

Nothing failed. No error, no warning. The build option simply did not exist,
and the bots quietly never used it. It surfaced only when a bot stalled: a
commander sitting at full capacity with no affordable target and no way to
spend the troops, doing nothing for the rest of the match.

## Decision

Upgrade cost is a ratio of the node's own capacity at its current level: 60%
for 1→2, 75% for 2→3. `upgradeCostOf(level, kind)` computes it.

A test asserts that for every level and every node kind,
`cost + garrisonFloor < capacity`. The build path can never silently vanish
again.

## Consequences

- Forts are cheap to upgrade (8 troops at level 1), factories expensive (16).
  That reads as a sensible trade rather than an accident.
- Costs are derived, so there is no stored value to drift.
- The payback window stayed sane: every level-1 upgrade repays itself in under
  40 seconds of holding, also asserted by a test.

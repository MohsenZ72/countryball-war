# ADR-0007: Bots account for their own columns already in flight

**Status:** accepted · **Date:** 2026-11-17

## Context

Bots were tuned on a one-axis skill ladder: better commanders think more often,
commit more of a garrison, and accept thinner margins.

## Problem

Measured over 24 seeds per matchup, the ladder was not merely wrong, it was
**inverted** — and stayed inverted when the axis was flipped. Whichever profile
was given the longest `thinkEvery` won, under either definition of "better".

The cause: a bot evaluated targets from scratch every pass and did not know
about columns it had already sent. Thinking twice a second meant re-committing
to the same target four times over, pouring every garrison into one territory
while the rest of its front stood empty. Thinking slowly accidentally avoided
the bug, which is why "slower is better" kept reproducing.

## Decision

Tally inbound columns per destination at the start of each decision pass, and
subtract friendly inbound from what a target still needs. Skip the target if
what is already marching covers it. `defend()` likewise counts relief already
on the way before sending more.

## Results

Immediately after the change, the ladder became transitive and stayed that way:

| Matchup | Before | After |
| --- | --- | --- |
| ruthless vs sharp | 8–16 | 22–2 |
| sharp vs steady | 12–12 | 17–7 |
| steady vs calm | 4–20 | 20–4 |

A coordinate descent (40 seeds per point) then found what actually matters:
`reserveRatio` is the dominant axis (0.00 → 33% win rate, 0.34 → 88%), and
`holdRatio` — "do not take what you cannot hold" — is actively harmful
(0.00 → 97%, 0.40 → 47%), because it makes a bot decline free territory.
`thinkEvery` and `buildBias` turned out to be nearly flat.

Two further fixes came out of the same work. Capitals got a 1.5x defence bonus
because matches were ending in 42 seconds when a bot walked into an
out-expanded rival's seat; and bots keep a floor of 25% of a capital's capacity
at home, because the weakest profile (`reserveRatio` 0) was leaving its seat
literally empty. The floor is deliberately low: at 0.6 it stopped the strongest
bot from spending its capital and inverted the ladder all over again.

## Consequences

- The skill profiles describe style as well as strength, and the strength
  ordering is re-measured by `bot.test.ts` on every run.
- `buildBias` is documented as inert for bots rather than quietly removed; it
  still matters for a human, who can bank production.
- The lesson is written into the defeat screen: hold a reserve on the border.

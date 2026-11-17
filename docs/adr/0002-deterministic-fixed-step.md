# ADR-0002: A deterministic, fixed-step simulation

**Status:** accepted · **Date:** 2026-11-17

## Context

The simulation could advance by real frame delta (simple, and what most small
browser games do) or by a fixed step with its own random stream.

## Decision

A fixed 30 Hz step, with the random state owned by the world, no clock reads,
and no DOM types available to the package at all.

## Why

Determinism is what makes the balance work possible. `npm run sim` plays
thousands of matches headlessly to check a change, the test suite asserts that
two runs of a seed fingerprint identically, and bot behaviour is reproducible
when something looks wrong. A frame-delta simulation would make every one of
those a guess.

It also keeps the door open: replays, a shareable seed, and lockstep
multiplayer all need exactly this property and none of them can be retrofitted
cheaply.

## Consequences

- No `Math.random`, `Date.now` or `performance.now` anywhere in `packages/core`.
  Bots derive randomness from `(step index, faction id)`.
- The client must accumulate real time and drain it in whole steps, with a cap
  so a backgrounded tab does not fast-forward a whole match on return.
- Balance claims in the documentation can be reproduced by anyone with the repo.

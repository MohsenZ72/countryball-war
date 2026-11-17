# ADR-0004: No ads, no in-app purchases, no analytics

**Status:** accepted · **Date:** 2026-11-17

## Context

The genre's commercial norm is free-to-play: interstitial ads between matches,
rewarded video for a retry, cosmetics, an energy meter, daily rewards.

## Decision

None of it. No ads, no purchases, no energy, no accounts, no analytics, no
network requests at all after the page loads.

## Why

This was the project's founding requirement, and it is load-bearing for the
design rather than a nice-to-have. Monetisation shapes a game: ad breaks want
short sessions with friction, rewarded video wants losing to feel bad in a
purchasable way, energy wants you to stop. Removing all of it means a match can
be exactly as long as it should be, a loss can be instructive instead of
monetisable, and the result screen can offer "play again" without a cost.

The absence of analytics has a real price — see the roadmap, where "measure
match length with humans" is an open item precisely because nothing is
instrumented. We would rather pay it.

## Consequences

- The build is static files with no runtime dependencies on any service.
- No consent banner, no privacy policy, no data to leak.
- Balance has to be validated by simulation and by playing, not by telemetry.

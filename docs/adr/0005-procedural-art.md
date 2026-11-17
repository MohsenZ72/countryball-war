# ADR-0005: Every visual and sound is generated at runtime

**Status:** accepted · **Date:** 2026-11-17

## Context

The game needs twelve national flags, territory art, UI icons and sound
effects. The normal answer is a sprite sheet and some audio files.

## Decision

No asset files. Flags are drawn from a small declarative spec, territories are
composed from circles and gradients, the app icon is inline SVG, and every
sound is an oscillator envelope.

## Why

Three reasons, in order of weight.

**Originality is verifiable.** With no asset pipeline there is no possibility
of an imported file, and the claim in `08-legal-and-ip.md` is checkable by
looking at the repository: there is no `assets/` directory because there is
nothing to put in one.

**It costs nothing.** No requests, no cache busting, no loading screen, no
decode cost, no licence tracking. The whole game is under 60 kB.

**It scales for free.** The same flag spec draws at 48 px in the nation picker
and at 14 px on a dense phone map, at any device pixel ratio.

## Consequences

- Art direction is constrained to what is cheap to draw procedurally, which
  suits the countryball look and would not suit a detailed one.
- `flags.ts` is a small renderer with its own grammar — bands, cross, saltire,
  disc, quarters, diagonal — rather than a list of images.
- Adding a nation is one entry in `nations.ts` and one in the flag table.

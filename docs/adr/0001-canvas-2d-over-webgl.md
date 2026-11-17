# ADR-0001: Canvas 2D for the board, not WebGL

**Status:** accepted · **Date:** 2026-11-17

## Context

The board draws a few dozen circles, dots and lines at 60 Hz, plus text.
WebGL, a 2D engine such as Pixi, and plain Canvas 2D were all plausible.

## Decision

Plain Canvas 2D, with no rendering library.

## Why

The largest campaign map holds 23 territories and rarely more than 30 columns —
roughly 300 draw calls per frame, which Canvas 2D handles without effort. Text
is a first-class citizen, and text is the most important thing on this board.
A WebGL path would mean reimplementing text rendering for no measured gain, and
a 2D engine would cost more bytes than the whole game currently ships.

## Consequences

- The entire bundle is ~48 kB of JavaScript, ~17 kB gzipped.
- Troop counts are rendered by the platform, with correct shaping everywhere.
- If a future mode needs hundreds of entities, this decision gets revisited.
  The renderer is already isolated behind `render(ctx, state)`.

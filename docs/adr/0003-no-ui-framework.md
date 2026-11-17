# ADR-0003: No UI framework

**Status:** accepted · **Date:** 2026-11-17

## Context

The game has three screens — menu, match, result — and an in-match HUD.

## Decision

Plain DOM with a small `el()` helper, and a state machine in `main.ts`.

## Why

React or Svelte would cost roughly as much as the entire game currently ships,
before any game code. The HUD is about a dozen controls whose state changes
every frame from a single source — exactly the case where a virtual DOM is
overhead rather than help. The complexity a framework manages (shared state
across many components, deep trees, routing) does not exist here.

## Consequences

- `main.ts` is a 40-line state machine; each screen is a mount function.
- Updating the HUD means touching nodes directly, once per frame.
- If the UI ever grows past a handful of screens, revisit. The screens are
  already isolated behind mount functions.

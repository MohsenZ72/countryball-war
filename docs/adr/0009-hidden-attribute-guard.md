# ADR-0009: A global guard for the `hidden` attribute

**Status:** accepted · **Date:** 2026-11-17

## Context

Overlays (pause, results) are toggled with the `hidden` attribute, and styled
with `.overlay { display: grid }`.

## Problem

An author's `display` rule outranks the user agent's `[hidden] { display: none }`.
The pause overlay therefore stayed laid out while "hidden" — invisible, full
screen, and still receiving pointer events. Every HUD control underneath it was
dead after the player closed the pause menu.

It was caught by browser automation reporting
`<div hidden class="overlay"> intercepts pointer events`, not by looking at the
page: an invisible element that silently eats input looks exactly like nothing
being wrong.

## Decision

One global rule, once:

```css
[hidden] { display: none !important; }
```

## Why this and not a fix at the call site

Changing `.overlay` to `display: none` when hidden fixes one element and leaves
the trap armed for the next one. The attribute should mean what it says
everywhere in the stylesheet, and `!important` is correct here precisely
because it must outrank every author `display` rule, including future ones.

## Consequences

- Any element in this app can be toggled with `hidden` and will behave.
- An element that genuinely needs to be invisible but present must use
  `visibility` or opacity, deliberately.

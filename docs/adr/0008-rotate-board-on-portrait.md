# ADR-0008: Rotate the board on portrait screens

**Status:** accepted · **Date:** 2026-11-17

## Context

Maps are authored landscape (up to 1600x900) and must be identical for every
player, because levels are seeded and compared by time. A phone in portrait is
roughly 390x844.

## Problem

Letterboxing a landscape map into a portrait viewport gave a scale of 0.24.
Territories drew at about ten pixels across with their troop counts smaller
still. It was unreadable, and the whole lower two thirds of the screen was
empty. Measured on a 390x844 viewport with the 14-territory Fortress Line map.

## Options

1. **Generate maps to fit the device.** Rejected: the same level would be a
   different map on a phone and a laptop, and times would not be comparable.
2. **Allow zoom and pan.** Rejected: this is a game of seeing every front at
   once. Hiding part of the board is a worse failure than shrinking it.
3. **Rotate the presentation.** Chosen.

## Decision

`fitCamera` computes the scale for both orientations and takes the larger,
turning the board a quarter turn when that wins. The rotation lives entirely in
`toScreen`/`toWorld`; the simulation never knows, and neither does the rest of
the renderer.

On a 390x844 phone this takes the scale from 0.24 to 0.45.

## Consequences

- One code path serves every device; there are no layout branches.
- Everyone plays the identical map, whatever they hold it in.
- Hit testing goes through the same transform, so taps land on the territory
  under the finger in either orientation.
- Anything that converts between world and screen coordinates must use the
  camera. Bypassing it works upright and breaks silently on a phone.

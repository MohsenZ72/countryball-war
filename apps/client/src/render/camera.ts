/**
 * Camera: maps world units to canvas pixels.
 *
 * Two rules, both about reading the board rather than exploring it:
 *
 *   1. The whole map is always on screen. This is a game of seeing every
 *      front at once, so panning and zooming would only hide information.
 *   2. The board rotates a quarter turn when that makes it bigger.
 *
 * Rule 2 is what makes the game playable on a phone. Maps are authored
 * landscape and must stay identical for every player, so the map is not
 * reshaped per device — it is presented sideways on a portrait screen. A
 * 1440x820 map on a 390x844 phone goes from a 0.24 scale (ten-pixel
 * territories, unusable) to 0.45.
 */

import type { Vec2 } from '@cbw/core';

export interface Camera {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  /** When true, the map is drawn turned a quarter turn clockwise. */
  readonly rotated: boolean;
  readonly bounds: Vec2;
}

export interface Viewport {
  /** CSS pixels. */
  readonly width: number;
  readonly height: number;
  /** Space reserved for the HUD strips, so they never cover the map. */
  readonly padTop: number;
  readonly padBottom: number;
  readonly padSide: number;
}

export function fitCamera(bounds: Vec2, view: Viewport): Camera {
  const usableW = Math.max(80, view.width - view.padSide * 2);
  const usableH = Math.max(80, view.height - view.padTop - view.padBottom);

  const upright = Math.min(usableW / bounds.x, usableH / bounds.y);
  const turned = Math.min(usableW / bounds.y, usableH / bounds.x);
  const rotated = turned > upright;
  const scale = rotated ? turned : upright;

  // Drawn extent of the map after any rotation.
  const drawnW = (rotated ? bounds.y : bounds.x) * scale;
  const drawnH = (rotated ? bounds.x : bounds.y) * scale;

  return {
    scale,
    offsetX: view.padSide + (usableW - drawnW) / 2,
    offsetY: view.padTop + (usableH - drawnH) / 2,
    rotated,
    bounds,
  };
}

export function toScreen(camera: Camera, p: Vec2): Vec2 {
  if (!camera.rotated) {
    return { x: camera.offsetX + p.x * camera.scale, y: camera.offsetY + p.y * camera.scale };
  }
  // Quarter turn clockwise: world +y runs left across the screen.
  return {
    x: camera.offsetX + (camera.bounds.y - p.y) * camera.scale,
    y: camera.offsetY + p.x * camera.scale,
  };
}

export function toWorld(camera: Camera, p: Vec2): Vec2 {
  if (!camera.rotated) {
    return { x: (p.x - camera.offsetX) / camera.scale, y: (p.y - camera.offsetY) / camera.scale };
  }
  return {
    x: (p.y - camera.offsetY) / camera.scale,
    y: camera.bounds.y - (p.x - camera.offsetX) / camera.scale,
  };
}

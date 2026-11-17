/**
 * Pointer input: one controller for mouse, touch and pen.
 *
 * Two ways to give the same order, because they suit different hands:
 *
 *   - **drag** from a territory onto another — fastest with a mouse
 *   - **tap** a territory to select it, then tap the target — works one-handed
 *     on a phone, and lets several sources be pooled into one assault
 *
 * Hit testing uses whichever is larger, the territory's drawn radius or a
 * 44 px touch target, so small nodes on a dense map stay reachable.
 */

import type { Vec2, World } from '@cbw/core';
import { MAP, TOUCH } from '../theme.js';
import { toWorld, type Camera } from '../render/camera.js';

export interface PointerHandlers {
  readonly onSend: (from: readonly number[], to: number) => void;
  readonly onNukeTarget: (to: number) => void;
  readonly onSelectionChange: (selected: ReadonlySet<number>) => void;
}

export interface PointerContext {
  readonly world: World;
  readonly camera: Camera;
  readonly playerFaction: number;
  readonly targeting: boolean;
}

/** How far a pointer may travel and still count as a tap, in CSS pixels. */
const TAP_SLOP = 12;

export class PointerController {
  private selected = new Set<number>();
  private dragFrom: number[] = [];
  private downAt: Vec2 | null = null;
  private moved = false;

  aim: Vec2 | null = null;
  hovered: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly context: () => PointerContext,
    private readonly handlers: PointerHandlers,
  ) {
    canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    canvas.addEventListener('pointermove', this.onMove, { passive: false });
    canvas.addEventListener('pointerup', this.onUp, { passive: false });
    canvas.addEventListener('pointercancel', this.onCancel, { passive: true });
    canvas.addEventListener('pointerleave', this.onLeave, { passive: true });
    // Stop the browser from scrolling or long-press-selecting the board.
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
  }

  selection(): ReadonlySet<number> {
    return this.selected;
  }

  clearSelection(): void {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.handlers.onSelectionChange(this.selected);
  }

  /** Drops selected nodes the player no longer owns, e.g. after losing one. */
  pruneSelection(): void {
    const { world, playerFaction } = this.context();
    let changed = false;
    for (const id of [...this.selected]) {
      if (world.nodes[id]?.owner !== playerFaction) {
        this.selected.delete(id);
        changed = true;
      }
    }
    if (changed) this.handlers.onSelectionChange(this.selected);
  }

  private local(event: PointerEvent): Vec2 {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private pick(screen: Vec2): number | null {
    const { world, camera } = this.context();
    const point = toWorld(camera, screen);
    let best: number | null = null;
    let bestDist = Infinity;
    for (const node of world.nodes) {
      const drawn = MAP.nodeRadius[node.kind];
      // Keep the touch target at least 44 CSS px wide, in world units.
      const reach = Math.max(drawn * 1.25, TOUCH.minTarget / 2 / camera.scale);
      const d = Math.hypot(node.pos.x - point.x, node.pos.y - point.y);
      if (d <= reach && d < bestDist) {
        bestDist = d;
        best = node.id;
      }
    }
    return best;
  }

  private onDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    const screen = this.local(event);
    this.downAt = screen;
    this.moved = false;
    this.aim = null;
    this.dragFrom = [];

    const { world, playerFaction, targeting } = this.context();
    const hit = this.pick(screen);
    if (hit === null || targeting) return;

    if (world.nodes[hit]?.owner === playerFaction) {
      // Dragging a selected node drags the whole pooled selection with it.
      this.dragFrom = this.selected.has(hit) ? [...this.selected] : [hit];
    }
  };

  private onMove = (event: PointerEvent): void => {
    const screen = this.local(event);
    this.hovered = this.pick(screen);
    if (!this.downAt) return;
    if (Math.hypot(screen.x - this.downAt.x, screen.y - this.downAt.y) > TAP_SLOP) this.moved = true;
    if (this.moved && this.dragFrom.length > 0) {
      event.preventDefault();
      const { camera } = this.context();
      this.aim = toWorld(camera, screen);
      // Show the drag against the dragged set, not the stale selection.
      this.selected = new Set(this.dragFrom);
      this.handlers.onSelectionChange(this.selected);
    }
  };

  private onUp = (event: PointerEvent): void => {
    const screen = this.local(event);
    const hit = this.pick(screen);
    const { world, playerFaction, targeting } = this.context();
    const wasDrag = this.moved && this.dragFrom.length > 0;
    const from = this.dragFrom;
    this.downAt = null;
    this.dragFrom = [];
    this.aim = null;
    this.moved = false;

    if (targeting) {
      if (hit !== null && world.nodes[hit]?.owner !== playerFaction) this.handlers.onNukeTarget(hit);
      return;
    }

    if (wasDrag) {
      if (hit !== null && !from.includes(hit)) {
        this.handlers.onSend(from, hit);
        this.clearSelection();
      }
      return;
    }

    // A tap.
    if (hit === null) {
      this.clearSelection();
      return;
    }
    const owner = world.nodes[hit]?.owner;
    if (owner === playerFaction) {
      if (this.selected.has(hit)) this.selected.delete(hit);
      else this.selected.add(hit);
      this.handlers.onSelectionChange(this.selected);
      return;
    }
    if (this.selected.size > 0) {
      this.handlers.onSend([...this.selected], hit);
      this.clearSelection();
    }
  };

  private onCancel = (): void => {
    this.downAt = null;
    this.dragFrom = [];
    this.aim = null;
    this.moved = false;
  };

  private onLeave = (): void => {
    this.hovered = null;
  };
}

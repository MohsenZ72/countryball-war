/**
 * Transient visuals driven by simulation events.
 *
 * The simulation never knows about them: it emits what happened, and this
 * queue turns those facts into short-lived marks on the map. Effects are
 * purely decorative, so they are skipped entirely under
 * `prefers-reduced-motion` rather than merely shortened.
 */

import type { SimEvent, World } from '@cbw/core';
import { MOTION } from '../theme.js';

export type EffectKind = 'capture' | 'repel' | 'nuke' | 'upgrade';

export interface Effect {
  readonly kind: EffectKind;
  readonly x: number;
  readonly y: number;
  readonly colour: string;
  /** Seconds remaining. */
  life: number;
  readonly maxLife: number;
}

export class EffectQueue {
  private effects: Effect[] = [];

  ingest(world: World, events: readonly SimEvent[], colourOf: (faction: number | null) => string): void {
    if (MOTION.reduced) return;
    for (const event of events) {
      switch (event.kind) {
        case 'captured':
          this.push(world, event.node, colourOf(event.by), 'capture', MOTION.popMs);
          break;
        case 'repelled':
          this.push(world, event.node, colourOf(event.by), 'repel', MOTION.tapMs * 2);
          break;
        case 'nuke-hit':
          this.push(world, event.node, '#c9f05a', 'nuke', MOTION.nukeMs);
          break;
        case 'upgraded':
          this.push(world, event.node, colourOf(world.nodes[event.node]?.owner ?? null), 'upgrade', MOTION.popMs);
          break;
        default:
          break;
      }
    }
  }

  private push(world: World, nodeId: number, colour: string, kind: EffectKind, ms: number): void {
    const node = world.nodes[nodeId];
    if (!node) return;
    const life = ms / 1000;
    this.effects.push({ kind, x: node.pos.x, y: node.pos.y, colour, life, maxLife: life });
  }

  advance(dt: number): void {
    if (this.effects.length === 0) return;
    for (const effect of this.effects) effect.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
  }

  all(): readonly Effect[] {
    return this.effects;
  }

  clear(): void {
    this.effects = [];
  }
}

/**
 * Canvas renderer.
 *
 * Draw order is deliberate and fixed: sea, grid, march lanes, columns,
 * territories, selection, aim line, missiles, effects. Territories sit above
 * columns so a crowded node never hides its own troop count — the number is
 * the single most important thing on screen.
 *
 * Everything is drawn in world units through the camera, so the same code
 * serves a phone and a desktop with no layout branches.
 */

import { BALANCE, capacityOf, NATIONS, type World } from '@cbw/core';
import { COLOUR, MAP, TYPE } from '../theme.js';
import { drawBall } from './flags.js';
import { toScreen, type Camera } from './camera.js';
import type { EffectQueue } from './effects.js';

export interface RenderState {
  readonly world: World;
  readonly camera: Camera;
  /** Node ids the player has selected as sources. */
  readonly selected: ReadonlySet<number>;
  /** Node the pointer is currently over or dragging to, if any. */
  readonly hovered: number | null;
  /** Live drag position in world units, when a drag is in progress. */
  readonly aim: { readonly x: number; readonly y: number } | null;
  /** True while the player is choosing a warhead target. */
  readonly targeting: boolean;
  readonly effects: EffectQueue;
  readonly playerFaction: number;
}

export function colourOfFaction(world: World, faction: number | null): string {
  if (faction === null) return COLOUR.neutral;
  const flag = world.factions[faction]?.flag;
  return NATIONS.find((n) => n.flag === flag)?.colour ?? COLOUR.neutral;
}

function shadeOfFaction(world: World, faction: number | null): string {
  if (faction === null) return COLOUR.neutralDeep;
  const flag = world.factions[faction]?.flag;
  return NATIONS.find((n) => n.flag === flag)?.shade ?? COLOUR.neutralDeep;
}

export function render(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { world, camera } = state;
  const w = ctx.canvas.clientWidth;
  const h = ctx.canvas.clientHeight;

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLOUR.sea;
  ctx.fillRect(0, 0, w, h);

  drawGrid(ctx, state, w, h);
  drawLanes(ctx, state);
  drawColumns(ctx, state);
  drawNodes(ctx, state);
  drawAim(ctx, state);
  drawMissiles(ctx, state);
  drawEffects(ctx, state);
  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, state: RenderState, w: number, h: number): void {
  const step = 110 * state.camera.scale;
  if (step < 18) return;
  ctx.strokeStyle = COLOUR.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = state.camera.offsetX % step; x < w; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, h);
  }
  for (let y = state.camera.offsetY % step; y < h; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(w, Math.round(y) + 0.5);
  }
  ctx.stroke();
}

/** Faint line behind every column so the player can see where troops go. */
function drawLanes(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { world, camera } = state;
  if (world.armies.length === 0) return;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 7]);
  for (const army of world.armies) {
    const from = world.nodes[army.from];
    const to = world.nodes[army.to];
    if (!from || !to) continue;
    const a = toScreen(camera, from.pos);
    const b = toScreen(camera, to.pos);
    ctx.strokeStyle = withAlpha(colourOfFaction(world, army.owner), 0.28);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/**
 * A column is a small cluster of dots, sized by how many troops it carries.
 * A number alone would be unreadable in motion; a blob that visibly swells
 * tells the player at a glance whether an attack is serious.
 */
function drawColumns(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { world, camera } = state;
  for (const army of world.armies) {
    const from = world.nodes[army.from];
    const to = world.nodes[army.to];
    if (!from || !to) continue;
    const t = army.progress;
    const x = from.pos.x + (to.pos.x - from.pos.x) * t;
    const y = from.pos.y + (to.pos.y - from.pos.y) * t;
    const p = toScreen(camera, { x, y });
    const colour = colourOfFaction(world, army.owner);
    const dots = Math.min(9, 2 + Math.floor(Math.sqrt(army.count)));
    const spread = (MAP.armyDot + Math.sqrt(army.count) * 1.1) * camera.scale;

    ctx.fillStyle = colour;
    for (let i = 0; i < dots; i++) {
      // Deterministic rosette: no per-frame randomness, so columns do not fizz.
      const angle = (i / dots) * Math.PI * 2 + army.id;
      const ring = i === 0 ? 0 : spread * 0.6;
      ctx.beginPath();
      ctx.arc(
        p.x + Math.cos(angle) * ring,
        p.y + Math.sin(angle) * ring,
        Math.max(1.4, MAP.armyDot * camera.scale * 0.9),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    if (camera.scale > 0.45) {
      ctx.fillStyle = COLOUR.text;
      ctx.font = `600 ${Math.round(11 * Math.max(0.8, camera.scale))}px ${TYPE.numeric}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = 'rgba(8,12,18,0.85)';
      ctx.lineWidth = 3;
      const label = String(army.count);
      ctx.strokeText(label, p.x, p.y - spread - 7);
      ctx.fillText(label, p.x, p.y - spread - 7);
    }
  }
}

function drawNodes(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { world, camera } = state;
  for (const node of world.nodes) {
    const p = toScreen(camera, node.pos);
    const r = MAP.nodeRadius[node.kind] * camera.scale;
    const owned = node.owner === state.playerFaction;
    const selected = state.selected.has(node.id);
    const hovered = state.hovered === node.id;

    // Footprint: a darker disc so a ball never floats on the grid.
    ctx.beginPath();
    ctx.fillStyle = withAlpha(shadeOfFaction(world, node.owner), 0.5);
    ctx.arc(p.x, p.y, r * 1.22, 0, Math.PI * 2);
    ctx.fill();

    if (node.capital) {
      ctx.beginPath();
      ctx.strokeStyle = withAlpha(colourOfFaction(world, node.owner), 0.95);
      ctx.lineWidth = Math.max(2, MAP.capitalRing * camera.scale * 0.5);
      ctx.arc(p.x, p.y, r * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    drawBall(ctx, r, world.factions[node.owner ?? -1]?.flag ?? null, r >= 14);
    ctx.restore();

    drawKindBadge(ctx, p, r, node.kind, camera.scale);
    drawLevelPips(ctx, p, r, node.level, camera.scale);

    if (node.falloutFor > 0) drawFallout(ctx, p, r, node.falloutFor);

    if (selected || hovered) {
      // Sits outside the capital ring by a fixed number of PIXELS, not world
      // units. Scaled with the map it collided with the capital ring on a
      // phone, where the two rings landed within half a pixel of each other
      // and selection became invisible exactly where it matters most.
      const ring = r * 1.3 + (selected ? MAP.selectRing : MAP.selectRing - 2);
      ctx.beginPath();
      ctx.strokeStyle = selected ? COLOUR.text : withAlpha(COLOUR.text, 0.5);
      ctx.lineWidth = selected ? 3 : 2;
      ctx.setLineDash(selected ? [] : [4, 4]);
      ctx.arc(p.x, p.y, ring, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (state.targeting && node.owner !== state.playerFaction && node.falloutFor <= 0) {
      drawCrosshair(ctx, p, r + 10 * camera.scale);
    }

    // Troop count: the most important number on the board.
    const label = String(Math.floor(node.troops));
    const size = Math.round(Math.max(12, r * 0.62));
    ctx.font = `700 ${size}px ${TYPE.numeric}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(3, size * 0.3);
    ctx.strokeStyle = 'rgba(6,10,16,0.9)';
    ctx.strokeText(label, p.x, p.y + r + size * 0.78);
    ctx.fillStyle = owned ? COLOUR.text : COLOUR.textDim;
    ctx.fillText(label, p.x, p.y + r + size * 0.78);

    if (owned && camera.scale > 0.5) {
      const cap = Math.round(capacityOf(node.level, node.kind));
      ctx.font = `500 ${Math.round(size * 0.6)}px ${TYPE.numeric}`;
      ctx.fillStyle = COLOUR.textFaint;
      ctx.fillText(`/${cap}`, p.x, p.y + r + size * 1.55);
    }
  }
}

function drawKindBadge(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  r: number,
  kind: 'city' | 'fort' | 'factory',
  scale: number,
): void {
  if (kind === 'city' || r < 15) return;
  const size = Math.max(7, r * 0.42);
  const cx = p.x + r * 0.72;
  const cy = p.y - r * 0.72;
  ctx.beginPath();
  ctx.fillStyle = 'rgba(8,12,18,0.88)';
  ctx.arc(cx, cy, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = kind === 'fort' ? COLOUR.textDim : COLOUR.warn;
  ctx.lineWidth = Math.max(1.4, 1.8 * scale);
  if (kind === 'fort') {
    // Battlement
    const w = size * 0.95;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy + w * 0.6);
    ctx.lineTo(cx - w, cy - w * 0.2);
    ctx.lineTo(cx - w * 0.4, cy - w * 0.2);
    ctx.lineTo(cx - w * 0.4, cy - w * 0.7);
    ctx.lineTo(cx + w * 0.4, cy - w * 0.7);
    ctx.lineTo(cx + w * 0.4, cy - w * 0.2);
    ctx.lineTo(cx + w, cy - w * 0.2);
    ctx.lineTo(cx + w, cy + w * 0.6);
    ctx.stroke();
  } else {
    // Chimney + smoke: a factory also arms warheads, so it gets the warm hue.
    const w = size * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy + w * 0.7);
    ctx.lineTo(cx - w, cy - w * 0.3);
    ctx.lineTo(cx, cy + w * 0.1);
    ctx.lineTo(cx, cy - w * 0.6);
    ctx.lineTo(cx + w, cy - w * 0.6);
    ctx.lineTo(cx + w, cy + w * 0.7);
    ctx.closePath();
    ctx.stroke();
  }
}

function drawLevelPips(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  r: number,
  level: number,
  scale: number,
): void {
  if (level <= 1 || r < 13) return;
  const pips = level - 1;
  const pr = Math.max(2, 2.6 * scale);
  const gap = pr * 3;
  const startX = p.x - ((pips - 1) * gap) / 2;
  for (let i = 0; i < pips; i++) {
    ctx.beginPath();
    ctx.fillStyle = COLOUR.warn;
    ctx.arc(startX + i * gap, p.y - r - pr * 2.2, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFallout(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  r: number,
  remaining: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLOUR.fallout;
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.globalAlpha = 0.85;
  const sweep = Math.PI * 2 * (remaining / BALANCE.nuke.falloutTime);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r * 1.45, -Math.PI / 2, -Math.PI / 2 + sweep);
  ctx.stroke();
  ctx.restore();
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  p: { x: number; y: number },
  r: number,
): void {
  ctx.save();
  ctx.strokeStyle = COLOUR.danger;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    ctx.moveTo(p.x + Math.cos(a) * r * 0.7, p.y + Math.sin(a) * r * 0.7);
    ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
  }
  ctx.stroke();
  ctx.restore();
}

function drawAim(ctx: CanvasRenderingContext2D, state: RenderState): void {
  if (!state.aim || state.selected.size === 0) return;
  const { world, camera } = state;
  const target = toScreen(camera, state.aim);
  ctx.save();
  ctx.strokeStyle = withAlpha(colourOfFaction(world, state.playerFaction), 0.8);
  ctx.lineWidth = 2.5;
  ctx.setLineDash([9, 6]);
  for (const id of state.selected) {
    const node = world.nodes[id];
    if (!node) continue;
    const from = toScreen(camera, node.pos);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMissiles(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { world, camera } = state;
  for (const missile of world.missiles) {
    const from = world.nodes[missile.from];
    const to = world.nodes[missile.to];
    if (!from || !to) continue;
    const t = missile.progress;
    // A lobbed arc, so a warhead never reads as just another column.
    const x = from.pos.x + (to.pos.x - from.pos.x) * t;
    const y = from.pos.y + (to.pos.y - from.pos.y) * t - Math.sin(t * Math.PI) * 120;
    const p = toScreen(camera, { x, y });
    const target = toScreen(camera, to.pos);

    ctx.save();
    ctx.strokeStyle = withAlpha(COLOUR.danger, 0.55);
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 6]);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Impact ring tightens as the warhead falls: free reaction time, visible.
    ctx.strokeStyle = COLOUR.danger;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(target.x, target.y, (1 - t) * 60 * camera.scale + 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = COLOUR.warn;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(3, 5 * camera.scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, state: RenderState): void {
  const { camera } = state;
  for (const effect of state.effects.all()) {
    const p = toScreen(camera, { x: effect.x, y: effect.y });
    const t = 1 - effect.life / effect.maxLife;
    ctx.save();
    if (effect.kind === 'nuke') {
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = COLOUR.fallout;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (20 + t * 150) * camera.scale, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = effect.colour;
      ctx.lineWidth = effect.kind === 'repel' ? 2 : 3.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (28 + t * 42) * camera.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

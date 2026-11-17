/**
 * Procedural flags.
 *
 * Every emblem is drawn from a tiny declarative spec rather than loaded as an
 * image: the whole set costs no network requests, scales to any density, and
 * recolours for free. The nations are invented, so no real flag is reproduced.
 *
 * A "countryball" here is a circle wearing its flag, with a highlight and two
 * eyes — the look of the internet's own doodle style, drawn from scratch.
 */

import { NATIONS, type Nation } from '@cbw/core';

type Band = { readonly colour: string; readonly weight?: number };

type FlagSpec =
  | { readonly kind: 'horizontal'; readonly bands: readonly Band[] }
  | { readonly kind: 'vertical'; readonly bands: readonly Band[] }
  | { readonly kind: 'cross'; readonly field: string; readonly cross: string; readonly weight: number }
  | { readonly kind: 'saltire'; readonly field: string; readonly cross: string; readonly weight: number }
  | { readonly kind: 'disc'; readonly field: string; readonly disc: string; readonly radius: number }
  | { readonly kind: 'quarters'; readonly a: string; readonly b: string }
  | { readonly kind: 'diagonal'; readonly a: string; readonly b: string };

const FLAGS: Record<string, FlagSpec> = {
  brightland: { kind: 'horizontal', bands: [{ colour: '#f0b429' }, { colour: '#1d2735' }] },
  verdalia: { kind: 'cross', field: '#3fb27f', cross: '#f4f8ff', weight: 0.26 },
  cobalt: { kind: 'vertical', bands: [{ colour: '#4c8dff' }, { colour: '#f4f8ff' }, { colour: '#4c8dff' }] },
  crimsonia: { kind: 'disc', field: '#ef5350', disc: '#ffe08a', radius: 0.3 },
  violetta: { kind: 'diagonal', a: '#a06cf0', b: '#2a1d4a' },
  tangerine: { kind: 'horizontal', bands: [{ colour: '#ff8a3d' }, { colour: '#f4f8ff', weight: 0.5 }, { colour: '#ff8a3d' }] },
  slate: { kind: 'saltire', field: '#8fa3b8', cross: '#1d2735', weight: 0.2 },
  teal: { kind: 'quarters', a: '#2fb6c4', b: '#0f3d47' },
  rose: { kind: 'disc', field: '#f06ea9', disc: '#f4f8ff', radius: 0.26 },
  lime: { kind: 'horizontal', bands: [{ colour: '#b7d94c' }, { colour: '#3b5410' }] },
  indigo: { kind: 'saltire', field: '#6b63f0', cross: '#ffe08a', weight: 0.16 },
  sand: { kind: 'vertical', bands: [{ colour: '#d9b382' }, { colour: '#6b4a24' }] },
};

/**
 * Unclaimed territory.
 *
 * Deliberately lighter than it looks like it should be: against the near-black
 * sea, a mid-grey ball sank into the background and the troop count under it
 * was the only thing a player could find. Grey has to read as "a place", not
 * as empty water.
 */
const NEUTRAL_SPEC: FlagSpec = { kind: 'horizontal', bands: [{ colour: '#9aa9bb' }, { colour: '#67788c' }] };

export function flagSpec(key: string | null): FlagSpec {
  if (key === null) return NEUTRAL_SPEC;
  return FLAGS[key] ?? NEUTRAL_SPEC;
}

export function nationFor(flag: string): Nation | undefined {
  return NATIONS.find((n) => n.flag === flag);
}

/**
 * Draws a countryball of radius `r` centred at the origin of the current
 * transform. The caller sets up translation; this keeps the clip local.
 */
export function drawBall(ctx: CanvasRenderingContext2D, r: number, flag: string | null, eyes = true): void {
  const spec = flagSpec(flag);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  paintField(ctx, r, spec);
  ctx.restore();

  // Soft top-left highlight so the ball reads as a sphere, not a sticker.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  const sheen = ctx.createRadialGradient(-r * 0.4, -r * 0.5, r * 0.05, 0, 0, r * 1.25);
  sheen.addColorStop(0, 'rgba(255,255,255,0.3)');
  sheen.addColorStop(0.55, 'rgba(255,255,255,0.03)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();

  if (eyes && r >= 12) drawEyes(ctx, r);
}

function drawEyes(ctx: CanvasRenderingContext2D, r: number): void {
  const dx = r * 0.33;
  const dy = -r * 0.1;
  const er = Math.max(1.6, r * 0.17);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.fillStyle = '#f7fbff';
    ctx.ellipse(sx * dx, dy, er, er * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#121923';
    ctx.arc(sx * dx + sx * er * 0.12, dy + er * 0.1, er * 0.52, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintField(ctx: CanvasRenderingContext2D, r: number, spec: FlagSpec): void {
  const size = r * 2;
  const left = -r;
  const top = -r;
  switch (spec.kind) {
    case 'horizontal':
    case 'vertical': {
      const total = spec.bands.reduce((sum, b) => sum + (b.weight ?? 1), 0);
      let offset = 0;
      for (const band of spec.bands) {
        const share = ((band.weight ?? 1) / total) * size;
        ctx.fillStyle = band.colour;
        if (spec.kind === 'horizontal') ctx.fillRect(left, top + offset, size, share + 0.5);
        else ctx.fillRect(left + offset, top, share + 0.5, size);
        offset += share;
      }
      return;
    }
    case 'cross': {
      ctx.fillStyle = spec.field;
      ctx.fillRect(left, top, size, size);
      const w = size * spec.weight;
      ctx.fillStyle = spec.cross;
      ctx.fillRect(left, -w / 2, size, w);
      ctx.fillRect(-w / 2, top, w, size);
      return;
    }
    case 'saltire': {
      ctx.fillStyle = spec.field;
      ctx.fillRect(left, top, size, size);
      ctx.strokeStyle = spec.cross;
      ctx.lineWidth = size * spec.weight;
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(-left, -top);
      ctx.moveTo(-left, top);
      ctx.lineTo(left, -top);
      ctx.stroke();
      return;
    }
    case 'disc': {
      ctx.fillStyle = spec.field;
      ctx.fillRect(left, top, size, size);
      ctx.fillStyle = spec.disc;
      ctx.beginPath();
      ctx.arc(0, 0, r * spec.radius * 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'quarters': {
      ctx.fillStyle = spec.a;
      ctx.fillRect(left, top, size, size);
      ctx.fillStyle = spec.b;
      ctx.fillRect(left, top, r, r);
      ctx.fillRect(0, 0, r, r);
      return;
    }
    case 'diagonal': {
      ctx.fillStyle = spec.a;
      ctx.fillRect(left, top, size, size);
      ctx.fillStyle = spec.b;
      ctx.beginPath();
      ctx.moveTo(left, -top);
      ctx.lineTo(-left, -top);
      ctx.lineTo(-left, top);
      ctx.closePath();
      ctx.fill();
      return;
    }
  }
}

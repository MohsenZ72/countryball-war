/**
 * The match screen: owns the fixed-step loop, the canvas and the HUD.
 *
 * The loop is an accumulator at `BALANCE.dt`, not a per-frame delta, so the
 * simulation runs identically at 60 Hz, 120 Hz or on a throttled background
 * tab. Catch-up is capped so a long stall (a backgrounded tab, a sleeping
 * laptop) resumes instead of fast-forwarding the whole match in one frame.
 */

import {
  BALANCE,
  buildLevel,
  createMatch,
  stepMatch,
  type Command,
  type LevelDef,
  type Match,
} from '@cbw/core';
import type { Audio } from '../audio.js';
import { fitCamera, toScreen, type Camera } from '../render/camera.js';
import { EffectQueue } from '../render/effects.js';
import { colourOfFaction, render } from '../render/renderer.js';
import { PointerController } from '../input/pointer.js';
import { Hud } from '../ui/hud.js';
import { button, el } from '../ui/dom.js';
import { TOUCH } from '../theme.js';

export type MatchResult =
  | { readonly kind: 'won'; readonly time: number }
  | { readonly kind: 'lost' }
  | { readonly kind: 'draw' }
  | { readonly kind: 'quit' };

export interface GameOptions {
  readonly level: LevelDef;
  readonly nation: number;
  readonly audio: Audio;
  readonly onFinish: (result: MatchResult) => void;
}

/** Never advance more than this much simulated time in one frame. */
const MAX_CATCHUP_STEPS = 6;
const PLAYER = 0;

export function mountGame(host: HTMLElement, options: GameOptions): () => void {
  const match: Match = createMatch(buildLevel(options.level, { playerNation: options.nation }));
  const canvas = el('canvas', { class: 'board', 'aria-label': 'Game board' });
  const context2d = canvas.getContext('2d');
  if (!context2d) throw new Error('this browser cannot provide a 2D canvas');
  // `frame` is hoisted, so narrow into a dedicated constant it can close over.
  const ctx: CanvasRenderingContext2D = context2d;

  const effects = new EffectQueue();
  const queued: Command[] = [];
  let ratio = BALANCE.sendRatios[1] ?? 0.5;
  let speed = 1;
  let paused = false;
  let finished = false;
  let camera: Camera = { scale: 1, offsetX: 0, offsetY: 0, rotated: false, bounds: match.world.bounds };

  const hud = new Hud(options.level.name, {
    onRatio: (value) => {
      ratio = value;
      hud.setRatio(value);
    },
    onUpgrade: () => {
      for (const id of pointer.selection()) queued.push({ kind: 'upgrade', faction: PLAYER, node: id });
      options.audio.play('upgrade');
    },
    onArmWarhead: () => {
      targeting = !targeting;
      hud.setTargeting(targeting);
      hud.notify(targeting ? 'Choose a target outside your own territory.' : 'Warhead stood down.');
    },
    onSpeed: (value) => {
      speed = value;
    },
    onPause: () => setPaused(true),
  });
  hud.setRatio(ratio);

  let targeting = false;

  const pointer = new PointerController(
    canvas,
    () => ({ world: match.world, camera, playerFaction: PLAYER, targeting }),
    {
      onSend: (from, to) => {
        queued.push({ kind: 'send', faction: PLAYER, from: [...from], to, ratio });
        options.audio.play('send');
      },
      onNukeTarget: (to) => {
        const silo = nearestValidSilo(to);
        targeting = false;
        hud.setTargeting(false);
        if (silo === null) {
          hud.notify('No launch site far enough from that target.');
          options.audio.play('deny');
          return;
        }
        queued.push({ kind: 'nuke', faction: PLAYER, from: silo, to });
      },
      onSelectionChange: () => {
        /* HUD reads the selection on its next update. */
      },
    },
  );

  function nearestValidSilo(target: number): number | null {
    const to = match.world.nodes[target];
    if (!to) return null;
    let best: number | null = null;
    let bestDist = Infinity;
    for (const node of match.world.nodes) {
      if (node.owner !== PLAYER || node.falloutFor > 0) continue;
      const d = Math.hypot(node.pos.x - to.pos.x, node.pos.y - to.pos.y);
      if (d >= BALANCE.nuke.minRange && d < bestDist) {
        bestDist = d;
        best = node.id;
      }
    }
    return best;
  }

  // ---- pause overlay -------------------------------------------------------

  const pauseCard = el('div', { class: 'overlay-card' }, [
    el('h2', { text: 'Paused' }),
    el('p', { class: 'muted', text: options.level.brief }),
  ]);
  const resume = button('Resume', { class: 'cta' });
  const restart = button('Restart', { class: 'cta cta--ghost' });
  const quit = button('Leave match', { class: 'cta cta--ghost' });
  pauseCard.append(el('div', { class: 'overlay-actions' }, [resume, restart, quit]));
  const pauseOverlay = el('div', { class: 'overlay', hidden: true }, [pauseCard]);

  resume.addEventListener('click', () => setPaused(false));
  restart.addEventListener('click', () => {
    dispose();
    mountGame(host, options);
  });
  quit.addEventListener('click', () => {
    dispose();
    options.onFinish({ kind: 'quit' });
  });

  function setPaused(value: boolean): void {
    if (finished) return;
    paused = value;
    pauseOverlay.hidden = !value;
    if (value) resume.focus();
  }

  // ---- canvas sizing -------------------------------------------------------

  function resize(): void {
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera = fitCamera(match.world.bounds, {
      width: rect.width,
      height: rect.height,
      // Leave room for the HUD strips so nothing important hides behind them.
      padTop: 64,
      padBottom: TOUCH.minTarget + 36,
      padSide: 12,
    });
  }

  const observer = new ResizeObserver(resize);

  // ---- loop ----------------------------------------------------------------

  let raf = 0;
  let last = performance.now();
  let accumulator = 0;

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;

    if (!paused && !finished) {
      accumulator += elapsed * speed;
      let steps = 0;
      while (accumulator >= BALANCE.dt && steps < MAX_CATCHUP_STEPS) {
        const commands = queued.splice(0, queued.length);
        const events = stepMatch(match, commands);
        effects.ingest(match.world, events, (f) => colourOfFaction(match.world, f));
        reactTo(events);
        accumulator -= BALANCE.dt;
        steps++;
      }
      // Drop the backlog rather than fast-forward through it.
      if (accumulator > BALANCE.dt * MAX_CATCHUP_STEPS) accumulator = 0;
      effects.advance(elapsed);
      pointer.pruneSelection();
      checkOutcome();
    }

    hud.update(match.world, PLAYER, pointer.selection());
    render(ctx, {
      world: match.world,
      camera,
      selected: pointer.selection(),
      hovered: pointer.hovered,
      aim: pointer.aim,
      targeting,
      effects,
      playerFaction: PLAYER,
    });
  }

  function reactTo(events: readonly import('@cbw/core').SimEvent[]): void {
    for (const event of events) {
      switch (event.kind) {
        case 'captured':
          options.audio.play(event.by === PLAYER ? 'capture' : 'lose');
          break;
        case 'nuke-hit':
          options.audio.play('nuke');
          break;
        case 'rejected':
          hud.notify(sentenceCase(event.reason));
          options.audio.play('deny');
          break;
        case 'nuke-launched':
          if (event.owner !== PLAYER) hud.notify('A warhead is in the air.');
          break;
        default:
          break;
      }
    }
  }

  function checkOutcome(): void {
    const outcome = match.world.outcome;
    if (outcome.state === 'running' || finished) return;
    finished = true;
    if (outcome.state === 'won' && outcome.faction === PLAYER) {
      options.audio.play('win');
      options.onFinish({ kind: 'won', time: match.world.time });
      return;
    }
    if (outcome.state === 'draw') {
      options.onFinish({ kind: 'draw' });
      return;
    }
    options.audio.play('defeat');
    options.onFinish({ kind: 'lost' });
  }

  function onVisibility(): void {
    if (document.hidden) setPaused(true);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') setPaused(!paused);
    if (event.key === ' ' && !finished) {
      event.preventDefault();
      setPaused(!paused);
    }
    const index = Number(event.key);
    if (index >= 1 && index <= BALANCE.sendRatios.length) {
      const value = BALANCE.sendRatios[index - 1];
      if (value !== undefined) {
        ratio = value;
        hud.setRatio(value);
      }
    }
  }

  function dispose(): void {
    cancelAnimationFrame(raf);
    observer.disconnect();
    pointer.dispose();
    document.removeEventListener('visibilitychange', onVisibility);
    globalThis.removeEventListener('keydown', onKey);
    host.replaceChildren();
  }

  if (import.meta.env.DEV) {
    // Development affordance: lets browser automation convert a territory id
    // into a screen point so a drag can be aimed at a real node. Stripped from
    // production builds by the `import.meta.env.DEV` guard.
    (globalThis as unknown as Record<string, unknown>).__cbw = {
      world: match.world,
      screenOf: (id: number) => {
        const node = match.world.nodes[id];
        if (!node) return null;
        const rect = canvas.getBoundingClientRect();
        const p = toScreen(camera, node.pos);
        return { x: rect.left + p.x, y: rect.top + p.y };
      },
      setPaused,
      pointer,
      queued,
    };
  }

  host.replaceChildren(el('div', { class: 'stage' }, [canvas, hud.root, pauseOverlay]));
  observer.observe(canvas);
  resize();
  document.addEventListener('visibilitychange', onVisibility);
  globalThis.addEventListener('keydown', onKey);
  raf = requestAnimationFrame(frame);

  return dispose;
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

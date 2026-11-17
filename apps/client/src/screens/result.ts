/**
 * Post-match screen.
 *
 * Shows the one thing the player wants (did I win, and how fast) and the two
 * things they will do next (replay, or move on), and nothing else.
 */

import type { LevelDef } from '@cbw/core';
import { button, clock, el } from '../ui/dom.js';
import type { MatchResult } from './game.js';

export interface ResultCallbacks {
  readonly onReplay: () => void;
  readonly onNext: (() => void) | null;
  readonly onMenu: () => void;
}

export function mountResult(
  host: HTMLElement,
  level: LevelDef,
  result: MatchResult,
  stars: number,
  callbacks: ResultCallbacks,
): void {
  const heading =
    result.kind === 'won' ? 'Territory secured' : result.kind === 'lost' ? 'Driven out' : 'Time called';
  const detail =
    result.kind === 'won'
      ? `${level.name} in ${clock(result.time)} — par is ${clock(level.parTime)}.`
      : result.kind === 'lost'
        ? 'Your last territory fell. Hold a reserve on the border next time.'
        : 'Neither empire could finish the other inside the time limit.';

  const actions: HTMLElement[] = [];
  if (result.kind === 'won' && callbacks.onNext) {
    const next = button('Next level', { class: 'cta' });
    next.addEventListener('click', callbacks.onNext);
    actions.push(next);
  }
  const replay = button(result.kind === 'won' ? 'Play again' : 'Try again', {
    class: result.kind === 'won' ? 'cta cta--ghost' : 'cta',
  });
  replay.addEventListener('click', callbacks.onReplay);
  actions.push(replay);
  const menu = button('Campaign', { class: 'cta cta--ghost' });
  menu.addEventListener('click', callbacks.onMenu);
  actions.push(menu);

  const card = el('div', { class: `overlay-card overlay-card--${result.kind}` }, [
    el('h2', { text: heading }),
    result.kind === 'won'
      ? el('p', { class: 'stars', text: '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)) })
      : el('span', {}),
    el('p', { class: 'muted', text: detail }),
    el('div', { class: 'overlay-actions' }, actions),
  ]);

  host.replaceChildren(el('div', { class: 'overlay overlay--solid' }, [card]));
  actions[0]?.focus();
}

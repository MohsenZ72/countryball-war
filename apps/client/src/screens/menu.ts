/**
 * Title, nation picker and level select.
 *
 * One screen rather than three: on a phone, every extra tap between opening
 * the game and playing it is a tap that loses players. The level list is the
 * page; everything else sits above it.
 */

import { CAMPAIGN, NATIONS, type LevelDef } from '@cbw/core';
import { isUnlocked, type Progress } from '../storage.js';
import { drawBall } from '../render/flags.js';
import { button, clock, el } from '../ui/dom.js';

export interface MenuCallbacks {
  readonly onPlay: (level: LevelDef) => void;
  readonly onNation: (index: number) => void;
  readonly onSound: (on: boolean) => void;
}

export function mountMenu(host: HTMLElement, progress: Progress, callbacks: MenuCallbacks): void {
  const ids = CAMPAIGN.map((l) => l.id);
  const won = CAMPAIGN.filter((l) => progress.levels[l.id]).length;
  const stars = CAMPAIGN.reduce((sum, l) => sum + (progress.levels[l.id]?.stars ?? 0), 0);

  const soundToggle = button(progress.sound ? 'Sound on' : 'Sound off', {
    class: 'chip',
    'aria-pressed': String(progress.sound),
  });
  soundToggle.addEventListener('click', () => {
    const next = soundToggle.getAttribute('aria-pressed') !== 'true';
    soundToggle.setAttribute('aria-pressed', String(next));
    soundToggle.textContent = next ? 'Sound on' : 'Sound off';
    callbacks.onSound(next);
  });

  const nationRow = el('div', { class: 'nation-row', role: 'radiogroup', 'aria-label': 'Choose your nation' });
  NATIONS.forEach((nation, index) => {
    const swatch = el('canvas', { class: 'nation', width: 96, height: 96 });
    const ctx = swatch.getContext('2d');
    if (ctx) {
      ctx.translate(48, 48);
      drawBall(ctx, 44, nation.flag);
    }
    const choice = el('button', {
      type: 'button',
      class: `nation-choice${index === progress.nation ? ' is-active' : ''}`,
      role: 'radio',
      'aria-checked': String(index === progress.nation),
      'aria-label': nation.name,
      title: nation.name,
    }, [swatch]);
    choice.addEventListener('click', () => {
      for (const sibling of nationRow.querySelectorAll('.nation-choice')) {
        sibling.classList.remove('is-active');
        sibling.setAttribute('aria-checked', 'false');
      }
      choice.classList.add('is-active');
      choice.setAttribute('aria-checked', 'true');
      callbacks.onNation(index);
    });
    nationRow.append(choice);
  });

  const list = el('ol', { class: 'levels' });
  CAMPAIGN.forEach((level, index) => {
    const record = progress.levels[level.id];
    const unlocked = isUnlocked(progress, index, ids);
    const card = el('li', { class: `level${unlocked ? '' : ' is-locked'}` });
    const action = el('button', {
      type: 'button',
      class: 'level-button',
      disabled: !unlocked,
      'aria-label': unlocked
        ? `Play ${level.name}. ${level.brief}`
        : `${level.name} is locked. Win the previous level first.`,
    }, [
      el('span', { class: 'level-index', text: String(index + 1) }),
      el('span', { class: 'level-body' }, [
        el('span', { class: 'level-name', text: level.name }),
        el('span', { class: 'level-brief', text: unlocked ? level.brief : 'Locked' }),
      ]),
      el('span', { class: 'level-meta' }, [
        el('span', { class: 'level-stars', text: '★'.repeat(record?.stars ?? 0) || '—' }),
        el('span', {
          class: 'level-time',
          text: record ? clock(record.bestTime) : `par ${clock(level.parTime)}`,
        }),
      ]),
    ]);
    if (unlocked) action.addEventListener('click', () => callbacks.onPlay(level));
    card.append(action);
    list.append(card);
  });

  host.replaceChildren(
    el('main', { class: 'menu' }, [
      el('header', { class: 'menu-head' }, [
        el('h1', { class: 'logo', text: 'Countryball War' }),
        el('p', { class: 'tagline', text: 'Take territory, hold it, and out-think three rivals. No ads, no purchases.' }),
        el('div', { class: 'menu-chips' }, [
          el('span', { class: 'chip chip--quiet', text: `${won}/${CAMPAIGN.length} levels` }),
          el('span', { class: 'chip chip--quiet', text: `${stars}/${CAMPAIGN.length * 3} stars` }),
          soundToggle,
        ]),
      ]),
      el('section', { class: 'panel' }, [
        el('h2', { class: 'panel-title', text: 'Your nation' }),
        nationRow,
      ]),
      el('section', { class: 'panel' }, [
        el('h2', { class: 'panel-title', text: 'Campaign' }),
        list,
      ]),
      el('section', { class: 'panel panel--help' }, [
        el('h2', { class: 'panel-title', text: 'How it works' }),
        el('ul', { class: 'help' }, [
          el('li', { text: 'Drag from one of your territories onto another to send troops. Or tap yours to select, then tap the target.' }),
          el('li', { text: 'Tap several of your territories to pool them into one assault — that is how a fort falls.' }),
          el('li', { text: 'Your territories grow to a cap, then stop. Upgrade them or spend the troops.' }),
          el('li', { text: 'Factories arm warheads. A strike clears a garrison and leaves the ground free to walk into.' }),
        ]),
      ]),
      el('footer', { class: 'menu-foot' }, [
        el('span', { class: 'muted', text: 'An original game. Not affiliated with any other title.' }),
      ]),
    ]),
  );
}

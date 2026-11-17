/**
 * In-match HUD.
 *
 * Plain DOM over the canvas rather than drawn in it: buttons get real focus,
 * real hit targets and screen-reader labels for free, and the canvas stays
 * one job — the board.
 *
 * Layout rule: the top strip carries information, the bottom strip carries
 * actions. On a phone the thumb only ever has to reach the bottom.
 */

import { BALANCE, capacityOf, standings, upgradeCostOf, type World } from '@cbw/core';
import { nationFor } from '../render/flags.js';
import { button, clock, el } from './dom.js';

export interface HudCallbacks {
  readonly onRatio: (ratio: number) => void;
  readonly onUpgrade: () => void;
  readonly onArmWarhead: () => void;
  readonly onSpeed: (speed: number) => void;
  readonly onPause: () => void;
}

export class Hud {
  readonly root: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly title: HTMLElement;
  private readonly chips: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly warning: HTMLElement;
  private readonly ratioButtons: HTMLButtonElement[] = [];
  private readonly upgradeButton: HTMLButtonElement;
  private readonly warheadButton: HTMLButtonElement;
  private readonly speedButton: HTMLButtonElement;
  private toastUntil = 0;
  private lastToast = '';

  constructor(levelName: string, callbacks: HudCallbacks) {
    this.title = el('span', { class: 'hud-title', text: levelName });
    this.timer = el('span', { class: 'hud-timer', text: '0:00' });
    this.chips = el('div', { class: 'hud-chips', role: 'status', 'aria-live': 'off' });
    this.toast = el('div', { class: 'hud-toast', role: 'status', 'aria-live': 'polite' });
    this.warning = el('div', { class: 'hud-warning', role: 'alert', hidden: true });

    const pause = button('Menu', { class: 'hud-button hud-button--ghost', 'aria-label': 'Pause and open the menu' });
    pause.addEventListener('click', callbacks.onPause);

    for (const ratio of BALANCE.sendRatios) {
      const label = `${Math.round(ratio * 100)}%`;
      const b = button(label, {
        class: 'hud-ratio',
        'aria-label': `Send ${label} of each selected garrison`,
        'data-ratio': ratio,
      });
      b.addEventListener('click', () => callbacks.onRatio(ratio));
      this.ratioButtons.push(b);
    }

    this.upgradeButton = button('Upgrade', { class: 'hud-button', 'aria-label': 'Upgrade the selected territory' });
    this.upgradeButton.addEventListener('click', callbacks.onUpgrade);

    this.warheadButton = button('Warhead', { class: 'hud-button hud-button--danger', 'aria-label': 'Arm a warhead, then choose a target' });
    this.warheadButton.addEventListener('click', callbacks.onArmWarhead);

    this.speedButton = button('1x', { class: 'hud-button hud-button--ghost', 'aria-label': 'Change game speed' });
    this.speedButton.addEventListener('click', () => {
      const next = this.speedButton.textContent === '1x' ? 2 : 1;
      callbacks.onSpeed(next);
      this.speedButton.textContent = `${next}x`;
    });

    this.root = el('div', { class: 'hud' }, [
      el('div', { class: 'hud-top' }, [
        el('div', { class: 'hud-top-left' }, [this.title, this.timer]),
        this.chips,
        pause,
      ]),
      this.warning,
      this.toast,
      el('div', { class: 'hud-bottom' }, [
        el('div', { class: 'hud-group', role: 'group', 'aria-label': 'Share of each garrison to send' }, this.ratioButtons),
        el('div', { class: 'hud-group' }, [this.upgradeButton, this.warheadButton, this.speedButton]),
      ]),
    ]);
  }

  setRatio(ratio: number): void {
    for (const b of this.ratioButtons) {
      const active = Number(b.dataset.ratio) === ratio;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    }
  }

  setTargeting(active: boolean): void {
    this.warheadButton.classList.toggle('is-active', active);
    this.warheadButton.setAttribute('aria-pressed', String(active));
  }

  notify(message: string): void {
    // Repeating the same message should refresh it, not stack it.
    this.lastToast = message;
    this.toast.textContent = message;
    this.toast.classList.add('is-shown');
    this.toastUntil = performance.now() + 1800;
  }

  update(world: World, playerFaction: number, selected: ReadonlySet<number>): void {
    this.timer.textContent = clock(world.time);

    const table = standings(world);
    this.chips.replaceChildren(
      ...table
        .filter((row) => world.factions[row.faction]?.eliminatedAt === null || row.nodes > 0)
        .sort((a, b) => b.nodes - a.nodes || b.troops - a.troops)
        .map((row) => {
          const faction = world.factions[row.faction];
          const nation = faction ? nationFor(faction.flag) : undefined;
          const chip = el('div', {
            class: `hud-chip${row.faction === playerFaction ? ' is-you' : ''}`,
            title: `${faction?.name ?? 'Unknown'}: ${row.nodes} territories, ${Math.round(row.troops)} troops`,
          }, [
            el('span', { class: 'hud-chip-swatch', style: `background:${nation?.colour ?? '#888'}` }),
            el('span', { class: 'hud-chip-count', text: String(row.nodes) }),
          ]);
          return chip;
        }),
    );

    const faction = world.factions[playerFaction];
    const charges = faction?.charges ?? 0;
    const progress = faction?.chargeProgress ?? 0;
    this.warheadButton.textContent = charges > 0 ? `Warhead ${charges}` : `Arming ${Math.round(progress * 100)}%`;
    this.warheadButton.disabled = charges < BALANCE.nuke.cost;

    const upgradable = [...selected].filter((id) => {
      const node = world.nodes[id];
      if (!node || node.owner !== playerFaction || node.falloutFor > 0) return false;
      const cost = upgradeCostOf(node.level, node.kind);
      return cost !== null && node.troops >= cost + BALANCE.garrisonFloor;
    });
    this.upgradeButton.disabled = upgradable.length === 0;
    const first = upgradable[0] !== undefined ? world.nodes[upgradable[0]] : undefined;
    const cost = first ? upgradeCostOf(first.level, first.kind) : null;
    this.upgradeButton.textContent = cost === null ? 'Upgrade' : `Upgrade ${cost}`;

    // Incoming warhead: the one thing worth interrupting the player for.
    const incoming = world.missiles.find((m) => world.nodes[m.to]?.owner === playerFaction);
    if (incoming) {
      const node = world.nodes[incoming.to];
      const cap = node ? Math.round(capacityOf(node.level, node.kind)) : 0;
      this.warning.hidden = false;
      this.warning.textContent = `Warhead inbound — ${Math.ceil(
        (1 - incoming.progress) * BALANCE.nuke.flightTime,
      )}s. That territory holds ${Math.floor(node?.troops ?? 0)}/${cap}.`;
    } else {
      this.warning.hidden = true;
    }

    if (this.toastUntil > 0 && performance.now() > this.toastUntil) {
      this.toast.classList.remove('is-shown');
      this.toastUntil = 0;
      this.lastToast = '';
    }
  }
}

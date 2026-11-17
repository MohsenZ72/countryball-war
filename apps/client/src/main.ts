/**
 * Application shell: owns the screen stack and the persisted progress.
 *
 * There is no router. The game has three places to be — menu, match, result —
 * and a 40-line state machine beats a routing library for all three.
 */

import { CAMPAIGN, levelById, type LevelDef } from '@cbw/core';
import './styles.css';
import { Audio } from './audio.js';
import { mountGame, type MatchResult } from './screens/game.js';
import { mountMenu } from './screens/menu.js';
import { mountResult } from './screens/result.js';
import { loadProgress, recordWin, setNation, setSound, type Progress } from './storage.js';

const mount = document.querySelector<HTMLElement>('#app');
if (!mount) throw new Error('#app is missing from index.html');
// Hoisted functions below may be referenced before this check in TypeScript's
// view of the module, so bind the narrowed value to its own constant.
const host: HTMLElement = mount;

let progress: Progress = loadProgress();
const audio = new Audio(progress.sound);
let disposeGame: (() => void) | null = null;

// Browsers only allow an AudioContext to start inside a gesture.
document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

function showMenu(): void {
  disposeGame?.();
  disposeGame = null;
  mountMenu(host, progress, {
    onPlay: (level) => showGame(level),
    onNation: (index) => {
      progress = setNation(progress, index);
    },
    onSound: (on) => {
      progress = setSound(progress, on);
      audio.setEnabled(on);
    },
  });
}

function showGame(level: LevelDef): void {
  disposeGame?.();
  disposeGame = mountGame(host, {
    level,
    nation: progress.nation,
    audio,
    onFinish: (result) => showResult(level, result),
  });
}

function showResult(level: LevelDef, result: MatchResult): void {
  disposeGame?.();
  disposeGame = null;
  if (result.kind === 'quit') {
    showMenu();
    return;
  }
  if (result.kind === 'won') {
    progress = recordWin(progress, level.id, result.time, level.parTime);
  }
  const stars = progress.levels[level.id]?.stars ?? 0;
  const index = CAMPAIGN.findIndex((l) => l.id === level.id);
  const nextLevel = index >= 0 ? CAMPAIGN[index + 1] : undefined;
  mountResult(host, level, result, stars, {
    onReplay: () => showGame(level),
    onNext: nextLevel ? () => showGame(nextLevel) : null,
    onMenu: showMenu,
  });
}

// Deep link for sharing and for testing a single level: #level=warhead
const requested = new URLSearchParams(location.hash.replace(/^#/, '')).get('level');
const deepLink = requested ? levelById(requested) : undefined;
if (deepLink) showGame(deepLink);
else showMenu();

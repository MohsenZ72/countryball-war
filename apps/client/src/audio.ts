/**
 * Sound, synthesised on the fly.
 *
 * No audio files: a handful of oscillator envelopes cover every cue, which
 * keeps the download tiny and means nothing to license. The context is created
 * on the first real gesture, because browsers refuse to start one before that.
 */

type Cue = 'send' | 'capture' | 'lose' | 'upgrade' | 'nuke' | 'win' | 'defeat' | 'deny';

interface Voice {
  readonly type: OscillatorType;
  readonly from: number;
  readonly to: number;
  readonly ms: number;
  readonly gain: number;
}

const VOICES: Record<Cue, Voice> = {
  send: { type: 'triangle', from: 420, to: 300, ms: 90, gain: 0.05 },
  capture: { type: 'square', from: 520, to: 780, ms: 150, gain: 0.06 },
  lose: { type: 'sawtooth', from: 300, to: 140, ms: 220, gain: 0.07 },
  upgrade: { type: 'triangle', from: 600, to: 980, ms: 180, gain: 0.05 },
  nuke: { type: 'sawtooth', from: 180, to: 60, ms: 700, gain: 0.1 },
  win: { type: 'triangle', from: 520, to: 1040, ms: 600, gain: 0.08 },
  defeat: { type: 'sine', from: 320, to: 90, ms: 800, gain: 0.08 },
  deny: { type: 'square', from: 200, to: 170, ms: 70, gain: 0.04 },
};

export class Audio {
  private ctx: AudioContext | null = null;
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Call from a click or tap handler before the first cue. */
  unlock(): void {
    if (!this.enabled || this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
  }

  play(cue: Cue): void {
    if (!this.enabled) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;
    const voice = VOICES[cue];
    const now = ctx.currentTime;
    const seconds = voice.ms / 1000;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = voice.type;
    osc.frequency.setValueAtTime(voice.from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, voice.to), now + seconds);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(voice.gain, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }
}

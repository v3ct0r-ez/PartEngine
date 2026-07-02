'use client';

/**
 * Tiny UI sound engine built on the Web Audio API — no audio files, works
 * offline in the Electron shell. Sounds are short synthesized tones so the
 * bundle stays asset-free. Controlled by the user's preferences (see
 * `configureSound`, wired from AppPrefs). Every sound is a no-op when disabled,
 * when the volume is 0, or before the first user gesture (autoplay policy).
 */

let ctx: AudioContext | null = null;
let enabled = true;
let volume = 0.5;

/** Sync the engine with the user's saved preferences. */
export function configureSound(cfg: { enabled: boolean; volume: number }) {
  enabled = cfg.enabled;
  volume = Math.min(Math.max(cfg.volume, 0), 1);
}

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type Tone = { f: number; at: number; dur: number; type?: OscillatorType; gain?: number };

function playTones(seq: Tone[]) {
  const context = audioCtx();
  if (!context) return;
  const now = context.currentTime;
  for (const s of seq) {
    const osc = context.createOscillator();
    const g = context.createGain();
    osc.type = s.type ?? 'sine';
    osc.frequency.value = s.f;
    const start = now + s.at;
    const peak = Math.max(volume * (s.gain ?? 0.5), 0.0002);
    // Fast attack, exponential decay — a soft, click-free envelope.
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + s.dur);
    osc.connect(g).connect(context.destination);
    osc.start(start);
    osc.stop(start + s.dur + 0.02);
  }
}

export type SoundType = 'success' | 'error' | 'open' | 'click' | 'notify';

/** Play a named UI sound (respects the enabled/volume preferences). */
export function playSound(type: SoundType) {
  if (!enabled || volume <= 0) return;
  switch (type) {
    case 'success':
      playTones([{ f: 660, at: 0, dur: 0.12 }, { f: 880, at: 0.09, dur: 0.15 }]);
      break;
    case 'error':
      playTones([
        { f: 311, at: 0, dur: 0.16, type: 'square', gain: 0.32 },
        { f: 233, at: 0.12, dur: 0.2, type: 'square', gain: 0.32 },
      ]);
      break;
    case 'open':
      playTones([{ f: 520, at: 0, dur: 0.1, type: 'triangle' }, { f: 784, at: 0.06, dur: 0.12, type: 'triangle' }]);
      break;
    case 'click':
      playTones([{ f: 880, at: 0, dur: 0.05, gain: 0.22 }]);
      break;
    case 'notify':
      playTones([{ f: 784, at: 0, dur: 0.14 }, { f: 1047, at: 0.11, dur: 0.18 }]);
      break;
  }
}

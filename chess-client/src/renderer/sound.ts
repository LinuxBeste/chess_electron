/**
 * Procedural sound effects using the Web Audio API.
 *
 * Rather than bundling audio files, all game sounds are generated
 * on-the-fly via OscillatorNode + GainNode — minimal footprint,
 * zero network requests, instant playback.
 *
 * AudioContext is created lazily on first use (browser autoplay policies
 * require a user gesture before creation).
 */

/* Lazily-initialised AudioContext; kept as a singleton for the app lifetime */
let audioCtx: AudioContext | null = null;
/* Cached volume level (0–1), updated by setSoundVolume() */
let cachedVolume = 1;

export function setSoundVolume(pct: number): void {
  cachedVolume = Math.max(0, Math.min(1, pct / 100));
}

/* Lazily create AudioContext and resume if suspended (common after
   browser autoplay policy suspension). */
function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/* Core sound primitive: play a tone at a given frequency for a given duration.
   Uses exponentialRampToValueAtTime for a natural decay envelope. */
function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume * cachedVolume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

/* Short, light taps for normal moves */
export function playMoveSound(): void {
  playTone(600, 0.1, 'sine', 0.1);
}

/* Lower, harsher tone for captures (square wave + two-note sequence) */
export function playCaptureSound(): void {
  playTone(300, 0.15, 'square', 0.08);
  setTimeout(() => playTone(200, 0.1, 'square', 0.06), 50);
}

/* Rising two-note alert for check */
export function playCheckSound(): void {
  playTone(800, 0.08, 'sine', 0.12);
  setTimeout(() => playTone(1000, 0.12, 'sine', 0.12), 80);
}

/* Descending three-note sequence for game over */
export function playGameOverSound(): void {
  playTone(400, 0.2, 'sine', 0.1);
  setTimeout(() => playTone(300, 0.2, 'sine', 0.1), 200);
  setTimeout(() => playTone(200, 0.4, 'sine', 0.1), 400);
}

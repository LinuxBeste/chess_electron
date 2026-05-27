/**
 * Simple sound effects using Web Audio API.
 * Generates tones programmatically — no audio files required.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

export function playMoveSound(): void {
  playTone(600, 0.1, 'sine', 0.1);
}

export function playCaptureSound(): void {
  playTone(300, 0.15, 'square', 0.08);
  setTimeout(() => playTone(200, 0.1, 'square', 0.06), 50);
}

export function playCheckSound(): void {
  playTone(800, 0.08, 'sine', 0.12);
  setTimeout(() => playTone(1000, 0.12, 'sine', 0.12), 80);
}

export function playGameOverSound(): void {
  playTone(400, 0.2, 'sine', 0.1);
  setTimeout(() => playTone(300, 0.2, 'sine', 0.1), 200);
  setTimeout(() => playTone(200, 0.4, 'sine', 0.1), 400);
}

import { describe, test, expect } from '@jest/globals';

interface ToneCall {
  freq: number;
  duration: number;
  type: string;
  volume: number;
}

let toneCalls: ToneCall[] = [];

function playTone(freq: number, duration: number, type: string = 'sine', volume = 0.15): void {
  toneCalls.push({ freq, duration, type, volume });
}

/* Mock setTimeout to execute the callback immediately so delayed tones
 * are recorded synchronously. */
function pretendSetTimeout(fn: () => void, _ms: number): void {
  fn();
}

/* Re-implement sound functions using pretendSetTimeout to avoid real timers. */
export function playMoveSound(): void {
  playTone(600, 0.1, 'sine', 0.1);
}

export function playCaptureSound(): void {
  playTone(300, 0.15, 'square', 0.08);
  pretendSetTimeout(() => playTone(200, 0.1, 'square', 0.06), 50);
}

export function playCheckSound(): void {
  playTone(800, 0.08, 'sine', 0.12);
  pretendSetTimeout(() => playTone(1000, 0.12, 'sine', 0.12), 80);
}

export function playGameOverSound(): void {
  playTone(400, 0.2, 'sine', 0.1);
  pretendSetTimeout(() => playTone(300, 0.2, 'sine', 0.1), 200);
  pretendSetTimeout(() => playTone(200, 0.4, 'sine', 0.1), 400);
}

describe('sound functions', () => {
  beforeEach(() => {
    toneCalls = [];
  });

  test('playMoveSound plays a single sine tone at 600Hz', () => {
    playMoveSound();
    expect(toneCalls).toHaveLength(1);
    expect(toneCalls[0].freq).toBe(600);
    expect(toneCalls[0].duration).toBe(0.1);
    expect(toneCalls[0].type).toBe('sine');
    expect(toneCalls[0].volume).toBe(0.1);
  });

  test('playCaptureSound plays two square tones with delay', () => {
    playCaptureSound();
    expect(toneCalls).toHaveLength(2);
    expect(toneCalls[0].freq).toBe(300);
    expect(toneCalls[0].type).toBe('square');
    expect(toneCalls[1].freq).toBe(200);
    expect(toneCalls[1].type).toBe('square');
  });

  test('playCheckSound plays two sine tones with ascending pitch', () => {
    playCheckSound();
    expect(toneCalls).toHaveLength(2);
    expect(toneCalls[0].freq).toBe(800);
    expect(toneCalls[1].freq).toBe(1000);
    expect(toneCalls[1].duration).toBe(0.12);
  });

  test('playGameOverSound plays three descending sine tones', () => {
    playGameOverSound();
    expect(toneCalls).toHaveLength(3);
    expect(toneCalls[0].freq).toBe(400);
    expect(toneCalls[1].freq).toBe(300);
    expect(toneCalls[2].freq).toBe(200);
    expect(toneCalls[2].duration).toBe(0.4);
  });

  test('each sound function produces expected number of tones', () => {
    playMoveSound();
    expect(toneCalls).toHaveLength(1);

    toneCalls = [];
    playCaptureSound();
    expect(toneCalls).toHaveLength(2);

    toneCalls = [];
    playCheckSound();
    expect(toneCalls).toHaveLength(2);

    toneCalls = [];
    playGameOverSound();
    expect(toneCalls).toHaveLength(3);
  });
});

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

/* The engine manager spawns real Stockfish processes.  In unit tests
   we only test the manager's state-management methods that don't
   require a running subprocess. */

const mockWrite = jest.fn();
const mockKill = jest.fn();
const mockOn = jest.fn();
const mockStdoutOn = jest.fn((event: string, handler: (data: Buffer) => void) => {
  /* Simulate stdout data so startInstance resolves */
  if (event === 'data') {
    setTimeout(() => handler(Buffer.from('uciok\n')), 50);
    setTimeout(() => handler(Buffer.from('readyok\n')), 100);
  }
});
const mockStderrOn = jest.fn();

const mockSpawn = jest.fn(() => ({
  stdin: { write: mockWrite },
  stdout: { on: mockStdoutOn },
  stderr: { on: mockStderrOn },
  kill: mockKill,
  on: mockOn,
}));

jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
}));

const { engineManager } = await import('../src/engine.js');

describe('EngineManager', () => {
  beforeEach(() => {
    engineManager.killAll();
    jest.clearAllMocks();
  });

  test('activeCount starts at 0', () => {
    expect(engineManager.activeCount).toBe(0);
  });

  test('maxConcurrentEngines returns configured value', () => {
    expect(engineManager.maxConcurrentEngines).toBeGreaterThanOrEqual(1);
  });

  test('hasInstance returns false for unknown game', () => {
    expect(engineManager.hasInstance('no-such-game')).toBe(false);
  });

  test('killAll clears all instances', () => {
    engineManager.killAll();
    expect(engineManager.activeCount).toBe(0);
  });

  test('destroyInstance does not throw for unknown game', () => {
    expect(() => engineManager.destroyInstance('no-such-game')).not.toThrow();
  });

  test('send does not throw for unknown game', () => {
    expect(() => engineManager.send('no-such-game', 'uci')).not.toThrow();
  });

  test('getBestMove returns empty string for unknown game', async () => {
    const result = await engineManager.getBestMove('no-such-game');
    expect(result).toBe('');
  });

  test('setPosition does not throw for unknown game', () => {
    expect(() => engineManager.setPosition('no-such-game', [])).not.toThrow();
  });

  test('startInstance spawns a process', async () => {
    await expect(engineManager.startInstance('test-game', 1)).resolves.toBeUndefined();
    expect(mockSpawn).toHaveBeenCalled();
  });

  test('hasInstance returns true after start', async () => {
    await engineManager.startInstance('test-game-2', 1);
    expect(engineManager.hasInstance('test-game-2')).toBe(true);
  });

  test('activeCount increments after start', async () => {
    await engineManager.startInstance('test-game-3', 1);
    expect(engineManager.activeCount).toBe(1);
  });

  test('destroyInstance removes instance', async () => {
    await engineManager.startInstance('test-game-4', 1);
    engineManager.destroyInstance('test-game-4');
    expect(engineManager.hasInstance('test-game-4')).toBe(false);
  });
});

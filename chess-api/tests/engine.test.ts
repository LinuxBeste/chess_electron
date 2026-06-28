import { describe, test, expect, beforeEach, jest } from '@jest/globals';

/* The engine manager spawns real Stockfish processes.  In unit tests
   we only test the manager's state-management methods that don't
   require a running subprocess. */

const stdoutHandlers: Map<string, (data: Buffer) => void> = new Map();

const mockWrite = jest.fn();
const mockKill = jest.fn();
const mockOn = jest.fn();
const mockStdoutOn = jest.fn((event: string, handler: (data: Buffer) => void) => {
  if (event === 'data') {
    stdoutHandlers.set('data', handler);
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

function drainStdoutHandler(): void {
  stdoutHandlers.delete('data');
}

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

  test('getBestMove returns empty result for unknown game', async () => {
    const result = await engineManager.getBestMove('no-such-game');
    expect(result).toEqual({ move: '', score: 0 });
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

  test('setPosition with moves sends position command', async () => {
    await engineManager.startInstance('test-pos', 1);
    mockWrite.mockClear();
    engineManager.setPosition('test-pos', ['e2e4', 'e7e5']);
    expect(mockWrite).toHaveBeenCalledWith('position startpos moves e2e4 e7e5\n');
  });

  test('setPosition with empty moves sends startpos', async () => {
    await engineManager.startInstance('test-pos2', 1);
    mockWrite.mockClear();
    engineManager.setPosition('test-pos2', []);
    expect(mockWrite).toHaveBeenCalledWith('position startpos\n');
  });

  test('getBestMove returns bestmove result with score', async () => {
    await engineManager.startInstance('test-gbm', 1);
    const handler = stdoutHandlers.get('data');
    expect(handler).toBeDefined();

    const movePromise = engineManager.getBestMove('test-gbm', 100);

    handler!(Buffer.from('info score cp 42 depth 10\n'));
    handler!(Buffer.from('bestmove e2e4\n'));

    const result = await movePromise;
    expect(result).toEqual({ move: 'e2e4', score: 42 });
  });

  test('getBestMove uses lastScore from bestmove line without trailing info', async () => {
    await engineManager.startInstance('test-gbm2', 1);
    const handler = stdoutHandlers.get('data');
    expect(handler).toBeDefined();

    const movePromise = engineManager.getBestMove('test-gbm2', 100);

    handler!(Buffer.from('info score cp -15 depth 8\n'));
    handler!(Buffer.from('bestmove e7e5\n'));

    const result = await movePromise;
    expect(result).toEqual({ move: 'e7e5', score: -15 });
  });

  test('getBestMove handles mate score', async () => {
    await engineManager.startInstance('test-mate', 1);
    const handler = stdoutHandlers.get('data');
    expect(handler).toBeDefined();

    const movePromise = engineManager.getBestMove('test-mate', 100);

    handler!(Buffer.from('info score mate 3 depth 12\n'));
    handler!(Buffer.from('bestmove Qh5\n'));

    const result = await movePromise;
    expect(result.move).toBe('Qh5');
    expect(result.score).toBe(10000);
  });

  test('getBestMove timeout rejects', async () => {
    await engineManager.startInstance('test-timeout', 1);
    const movePromise = engineManager.getBestMove('test-timeout', 5);

    await expect(movePromise).rejects.toThrow('Engine best-move timeout');
  }, 20000);

  test('startInstance rejects when maxConcurrent reached', async () => {
    const max = engineManager.maxConcurrentEngines;
    for (let i = 0; i < max; i++) {
      await engineManager.startInstance('fill-' + i, 1);
    }
    await expect(engineManager.startInstance('rejected', 1)).rejects.toThrow('Too many concurrent bot games');
  });

  test('process exit during getBestMove rejects', async () => {
    await engineManager.startInstance('test-exit', 1);
    const exitHandler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'exit');
    expect(exitHandler).toBeDefined();

    const movePromise = engineManager.getBestMove('test-exit', 500);
    exitHandler![1](1, null);

    await expect(movePromise).rejects.toThrow();
  });

  test('process crash with signal during getBestMove rejects', async () => {
    await engineManager.startInstance('test-signal', 1);
    const exitHandler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'exit');
    expect(exitHandler).toBeDefined();

    const movePromise = engineManager.getBestMove('test-signal', 500);
    exitHandler![1](null, 'SIGKILL');

    await expect(movePromise).rejects.toThrow();
    expect(engineManager.hasInstance('test-signal')).toBe(false);
  });

  test('error event during getBestMove rejects', async () => {
    await engineManager.startInstance('test-error', 1);
    const errorHandler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'error');
    expect(errorHandler).toBeDefined();

    const movePromise = engineManager.getBestMove('test-error', 500);
    errorHandler![1](new Error('process spawn failed'));

    await expect(movePromise).rejects.toThrow();
  });

  test('send writes to stdin', async () => {
    await engineManager.startInstance('test-send', 1);
    mockWrite.mockClear();
    engineManager.send('test-send', 'uci');
    expect(mockWrite).toHaveBeenCalledWith('uci\n');
  });

  test('send does not throw when stdin write fails', async () => {
    await engineManager.startInstance('test-send-fail', 1);
    mockWrite.mockImplementation(() => {
      throw new Error('stdin closed');
    });
    expect(() => engineManager.send('test-send-fail', 'uci')).not.toThrow();
  });

  test('score cp parsing sets lastScore', async () => {
    await engineManager.startInstance('test-score', 1);
    const handler = stdoutHandlers.get('data');
    expect(handler).toBeDefined();

    handler!(Buffer.from('info depth 5 seldepth 6 multipv 1 score cp 120 wtime 1000 btime 1000\n'));

    const movePromise = engineManager.getBestMove('test-score', 100);
    handler!(Buffer.from('bestmove e2e4\n'));
    const result = await movePromise;
    expect(result.score).toBe(120);
  });

  test('scattered stdout lines are buffered and parsed', async () => {
    await engineManager.startInstance('test-buf', 1);
    const handler = stdoutHandlers.get('data');
    expect(handler).toBeDefined();

    const movePromise = engineManager.getBestMove('test-buf', 100);
    handler!(Buffer.from('info score cp '));
    handler!(Buffer.from('50 depth 10\n'));
    handler!(Buffer.from('bestmove d2d4\n'));

    const result = await movePromise;
    expect(result).toEqual({ move: 'd2d4', score: 50 });
  });

  test('destroyInstance kills process and removes from map', async () => {
    await engineManager.startInstance('test-destroy', 1);
    expect(engineManager.hasInstance('test-destroy')).toBe(true);
    engineManager.destroyInstance('test-destroy');
    expect(engineManager.hasInstance('test-destroy')).toBe(false);
    expect(mockKill).toHaveBeenCalled();
  });

  test('killAll kills all and clears', async () => {
    await engineManager.startInstance('ka-1', 1);
    await engineManager.startInstance('ka-2', 1);
    engineManager.killAll();
    expect(engineManager.activeCount).toBe(0);
    expect(mockKill).toHaveBeenCalled();
  });
});

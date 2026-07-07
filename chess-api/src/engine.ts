import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import logger from './logger.js';

const ENGINE_POLL_INTERVAL_MS = parseInt(process.env.ENGINE_POLL_INTERVAL_MS ?? '100', 10);
const ENGINE_DEFAULT_MOVETIME_MS = parseInt(process.env.ENGINE_DEFAULT_MOVETIME_MS ?? '500', 10);
const ENGINE_TIMEOUT_BUFFER_MS = parseInt(process.env.ENGINE_TIMEOUT_BUFFER_MS ?? '10000', 10);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BestMoveResult {
  move: string;
  score: number;
}

interface EngineInstance {
  process: ChildProcess;
  buffer: string;
  bestMovePromise: { resolve: (result: BestMoveResult) => void; reject: (err: Error) => void } | null;
  uciok: boolean;
  ready: boolean;
  lastScore: number;
  waitTimer: ReturnType<typeof setTimeout> | null;
  settled: boolean;
}

// Manages concurrent Stockfish subprocesses for bot games
class EngineManager {
  private instances = new Map<string, EngineInstance>();
  private maxConcurrent = Math.max(1, parseInt(process.env.MAX_CONCURRENT_ENGINES ?? '4', 10)); // Cap concurrent Stockfish to limit RAM

  get activeCount(): number {
    return this.instances.size;
  }

  get maxConcurrentEngines(): number {
    return this.maxConcurrent;
  }

  private getEnginePath(): string {
    return path.join(__dirname, '..', 'node_modules', 'stockfish', 'bin', 'stockfish-18-lite-single.js');
  }

  // Spawn a Stockfish subprocess and wait for UCI ready
  startInstance(gameId: string, skillLevel: number): Promise<void> {
    if (this.instances.size >= this.maxConcurrent) {
      logger.warn('Engine limit reached: ' + this.instances.size + '/' + this.maxConcurrent + ' active');
      return Promise.reject(new Error('Too many concurrent bot games. Try again later.'));
    }
    return new Promise((resolve, reject) => {
      const enginePath = this.getEnginePath();
      const proc = spawn(process.execPath, [enginePath], {
        // Stockfish runs as child Node.js process
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const inst: EngineInstance = {
        process: proc,
        buffer: '',
        bestMovePromise: null,
        uciok: false,
        ready: false,
        lastScore: 0,
        waitTimer: null,
        settled: false,
      };

      proc.stdout!.on('data', (data: Buffer) => {
        inst.buffer += data.toString();
        const lines = inst.buffer.split('\n');
        inst.buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed === 'uciok') inst.uciok = true;
          if (trimmed === 'readyok') inst.ready = true;

          const scoreMatch = trimmed.match(/^info.*\bscore\s+(cp|mate)\s+(-?\d+)/);
          if (scoreMatch) {
            if (scoreMatch[1] === 'mate') {
              const mateIn = parseInt(scoreMatch[2], 10);
              inst.lastScore = mateIn > 0 ? 10000 : -10000;
            } else {
              inst.lastScore = parseInt(scoreMatch[2], 10);
            }
          }

          const bestMatch = trimmed.match(/^bestmove\s+(\S+)/);
          if (bestMatch && inst.bestMovePromise) {
            inst.bestMovePromise.resolve({ move: bestMatch[1], score: inst.lastScore });
            inst.bestMovePromise = null;
          }
        }
      });

      proc.stderr!.on('data', (data: Buffer) => {
        logger.debug('Engine stderr:', data.toString().trim());
      });

      const origResolve = resolve;
      const origReject = reject;
      const safeReject = (err: Error) => {
        if (!inst.settled) {
          inst.settled = true;
          origReject(err);
        }
      };
      const safeResolve = () => {
        if (!inst.settled) {
          inst.settled = true;
          origResolve();
        }
      };

      proc.on('error', (err) => {
        logger.error('Engine process error for game ' + gameId, err);
        rejectAndCleanup(inst, err);
        safeReject(err);
      });

      proc.on('exit', (code, signal) => {
        logger.warn('Engine process exited for game ' + gameId + ' code=' + code + ' signal=' + signal);
        const err = new Error('Engine process exited (code=' + code + ' signal=' + signal + ')');
        rejectAndCleanup(inst, err);
        this.instances.delete(gameId);
        safeReject(err);
      });

      this.instances.set(gameId, inst);

      this.send(gameId, 'uci');
      this.waitForCondition(gameId, () => inst.uciok)
        .then(() => {
          if (inst.settled) return;
          const level = Math.max(1, Math.min(20, skillLevel || 1)); // Clamp skill level 1-20
          this.send(gameId, `setoption name Skill Level value ${level}`);
          this.send(gameId, 'isready');
          return this.waitForCondition(gameId, () => inst.ready);
        })
        .then(() => {
          if (inst.settled) return;
          logger.info('Engine ready for game', gameId);
          safeResolve();
        })
        .catch((err) => {
          safeReject(err);
        });
    });
  }

  waitForCondition(gameId: string, condition: () => boolean): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        const inst = this.instances.get(gameId);
        if (!inst || inst.settled) return;
        if (condition()) return resolve();
        inst.waitTimer = setTimeout(check, ENGINE_POLL_INTERVAL_MS);
      };
      check();
    });
  }

  // Send UCI command to engine stdin
  send(gameId: string, cmd: string): void {
    const inst = this.instances.get(gameId);
    if (!inst) {
      logger.warn('Engine not found for game', gameId);
      return;
    }
    try {
      inst.process.stdin!.write(cmd + '\n');
    } catch (err) {
      // stdin.write can throw if process died
      logger.warn('Engine send failed for game ' + gameId + ': ' + err);
    }
  }

  // Send go movetime, wait for bestmove response
  async getBestMove(gameId: string, movetime = ENGINE_DEFAULT_MOVETIME_MS): Promise<BestMoveResult> {
    const inst = this.instances.get(gameId);
    if (!inst) {
      logger.warn('Engine not found for game', gameId);
      return { move: '', score: 0 };
    }

    if (inst.bestMovePromise) {
      inst.bestMovePromise.reject(new Error('New search started'));
    }

    return new Promise((resolve, reject) => {
      inst.bestMovePromise = { resolve, reject };
      this.send(gameId, `go movetime ${movetime}`);

      const timeoutMs = movetime + ENGINE_TIMEOUT_BUFFER_MS;
      const timer = setTimeout(() => {
        if (inst.bestMovePromise) {
          inst.bestMovePromise = null;
          reject(new Error('Engine best-move timeout'));
        }
      }, timeoutMs).unref();

      const origResolve = inst.bestMovePromise.resolve;
      const origReject = inst.bestMovePromise.reject;
      inst.bestMovePromise.resolve = (result: BestMoveResult) => {
        clearTimeout(timer);
        origResolve(result);
      };
      inst.bestMovePromise.reject = (err: Error) => {
        clearTimeout(timer);
        origReject(err);
      };
    });
  }

  // Set up position from UCI move list
  setPosition(gameId: string, moves: string[]): void {
    if (moves.length === 0) {
      this.send(gameId, 'position startpos');
    } else {
      this.send(gameId, `position startpos moves ${moves.join(' ')}`);
    }
  }

  // Kill the engine process and clean up
  destroyInstance(gameId: string): void {
    const inst = this.instances.get(gameId);
    if (inst) {
      if (inst.waitTimer) clearTimeout(inst.waitTimer);
      inst.settled = true;
      try {
        inst.process.kill();
      } catch (err) {
        logger.warn('Engine kill failed for game ' + gameId + ': ' + err);
      }
      this.instances.delete(gameId);
      logger.info('Engine instance destroyed for game', gameId);
    }
  }

  hasInstance(gameId: string): boolean {
    return this.instances.has(gameId);
  }

  // Terminate all running engine processes
  killAll(): void {
    for (const [gameId, inst] of this.instances) {
      try {
        inst.process.kill();
      } catch (err) {
        logger.warn('Engine kill failed during shutdown for game ' + gameId + ': ' + err);
      }
      logger.info('Engine killed on shutdown: game=' + gameId);
    }
    this.instances.clear();
  }
}

function rejectAndCleanup(inst: EngineInstance, err: Error): void {
  if (inst.bestMovePromise) {
    inst.bestMovePromise.reject(err);
    inst.bestMovePromise = null;
  }
}

export const engineManager = new EngineManager();

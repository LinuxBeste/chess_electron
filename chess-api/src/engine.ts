import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import logger from './logger';

interface EngineInstance {
  process: ChildProcess;
  buffer: string;
  bestMovePromise: { resolve: (move: string) => void; reject: (err: Error) => void } | null;
  uciok: boolean;
  ready: boolean;
}

class EngineManager {
  private instances = new Map<string, EngineInstance>();
  private maxConcurrent = Math.max(1, parseInt(process.env.MAX_CONCURRENT_ENGINES ?? '4', 10));

  get activeCount(): number {
    return this.instances.size;
  }

  get maxConcurrentEngines(): number {
    return this.maxConcurrent;
  }

  private getEnginePath(): string {
    return path.join(__dirname, '..', 'node_modules', 'stockfish', 'bin', 'stockfish-18-lite-single.js');
  }

  startInstance(gameId: string, skillLevel: number): Promise<void> {
    if (this.instances.size >= this.maxConcurrent) {
      logger.warn('Engine limit reached: ' + this.instances.size + '/' + this.maxConcurrent + ' active');
      return Promise.reject(new Error('Too many concurrent bot games. Try again later.'));
    }
    return new Promise((resolve, reject) => {
      const enginePath = this.getEnginePath();
      const proc = spawn(process.execPath, [enginePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const inst: EngineInstance = {
        process: proc,
        buffer: '',
        bestMovePromise: null,
        uciok: false,
        ready: false,
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

          const bestMatch = trimmed.match(/^bestmove\s+(\S+)/);
          if (bestMatch && inst.bestMovePromise) {
            inst.bestMovePromise.resolve(bestMatch[1]);
            inst.bestMovePromise = null;
          }
        }
      });

      proc.stderr!.on('data', (data: Buffer) => {
        logger.debug('Engine stderr:', data.toString().trim());
      });

      proc.on('error', (err) => {
        logger.error('Engine process error for game ' + gameId, err);
        rejectAndCleanup(inst, err);
        reject(err);
      });

      proc.on('exit', (code, signal) => {
        logger.warn('Engine process exited for game ' + gameId + ' code=' + code + ' signal=' + signal);
        const err = new Error('Engine process exited (code=' + code + ' signal=' + signal + ')');
        rejectAndCleanup(inst, err);
        this.instances.delete(gameId);
        reject(err);
      });

      this.instances.set(gameId, inst);

      this.send(gameId, 'uci');
      this.waitForCondition(gameId, () => inst.uciok)
        .then(() => {
          const level = Math.max(1, Math.min(20, skillLevel || 1));
          this.send(gameId, `setoption name Skill Level value ${level}`);
          this.send(gameId, 'isready');
          return this.waitForCondition(gameId, () => inst.ready);
        })
        .then(() => {
          logger.info('Engine ready for game', gameId);
          resolve();
        })
        .catch(reject);
    });
  }

  waitForCondition(gameId: string, condition: () => boolean): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.instances.has(gameId)) return;
        if (condition()) return resolve();
        setTimeout(check, 10);
      };
      check();
    });
  }

  send(gameId: string, cmd: string): void {
    const inst = this.instances.get(gameId);
    if (!inst) {
      logger.warn('Engine not found for game', gameId);
      return;
    }
    try {
      inst.process.stdin!.write(cmd + '\n');
    } catch (err) {
      logger.warn('Engine send failed for game ' + gameId + ': ' + err);
    }
  }

  async getBestMove(gameId: string, movetime = 500): Promise<string> {
    const inst = this.instances.get(gameId);
    if (!inst) {
      logger.warn('Engine not found for game', gameId);
      return '';
    }

    if (inst.bestMovePromise) {
      inst.bestMovePromise.reject(new Error('New search started'));
    }

    return new Promise((resolve, reject) => {
      inst.bestMovePromise = { resolve, reject };
      this.send(gameId, `go movetime ${movetime}`);

      /* Timeout: if Stockfish doesn't respond within movetime + 10s, reject */
      const timeoutMs = movetime + 10000;
      const timer = setTimeout(() => {
        if (inst.bestMovePromise) {
          inst.bestMovePromise = null;
          reject(new Error('Engine best-move timeout'));
        }
      }, timeoutMs).unref();

      /* Wrap original resolve/reject to clear the timeout */
      const origResolve = inst.bestMovePromise.resolve;
      const origReject = inst.bestMovePromise.reject;
      inst.bestMovePromise.resolve = (move: string) => {
        clearTimeout(timer);
        origResolve(move);
      };
      inst.bestMovePromise.reject = (err: Error) => {
        clearTimeout(timer);
        origReject(err);
      };
    });
  }

  setPosition(gameId: string, moves: string[]): void {
    if (moves.length === 0) {
      this.send(gameId, 'position startpos');
    } else {
      this.send(gameId, `position startpos moves ${moves.join(' ')}`);
    }
  }

  destroyInstance(gameId: string): void {
    const inst = this.instances.get(gameId);
    if (inst) {
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

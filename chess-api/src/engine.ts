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

  private getEnginePath(): string {
    return path.join(__dirname, '..', 'node_modules', 'stockfish', 'bin', 'stockfish-18-lite-single.js');
  }

  startInstance(gameId: string, skillLevel: number): Promise<void> {
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
        logger.error('Engine process error', err);
        if (inst.bestMovePromise) {
          inst.bestMovePromise.reject(err);
          inst.bestMovePromise = null;
        }
        reject(err);
      });

      this.instances.set(gameId, inst);

      this.send(gameId, 'uci');
      this.waitForCondition(gameId, () => inst.uciok).then(() => {
        const level = Math.max(1, Math.min(20, skillLevel || 1));
        this.send(gameId, `setoption name Skill Level value ${level}`);
        this.send(gameId, 'isready');
        return this.waitForCondition(gameId, () => inst.ready);
      }).then(() => {
        logger.info('Engine ready for game', gameId);
        resolve();
      }).catch(reject);
    });
  }

  waitForCondition(_gameId: string, condition: () => boolean): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
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
    inst.process.stdin!.write(cmd + '\n');
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
      inst.process.kill();
      this.instances.delete(gameId);
      logger.info('Engine instance destroyed for game', gameId);
    }
  }

  hasInstance(gameId: string): boolean {
    return this.instances.has(gameId);
  }
}

export const engineManager = new EngineManager();

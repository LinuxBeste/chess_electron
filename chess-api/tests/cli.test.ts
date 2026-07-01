import { describe, test, expect } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(__dirname, '..', 'src', 'cli.ts');

describe('CLI — DISABLE_CLI guard', () => {
  test('exits with code 1 when DISABLE_CLI=true', async () => {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    try {
      await execFileAsync('npx', ['tsx', cliPath, '--help'], {
        env: { ...process.env, DISABLE_CLI: 'true' },
      });
      expect(true).toBe(false); // Should not reach here
    } catch (err: unknown) {
      const e = err as { code?: number; stderr?: string };
      expect(e.code).toBe(1);
      expect(e.stderr || '').toContain('CLI is disabled');
    }
  });

  test('exits with code 1 when DISABLE_CLI=1', async () => {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    try {
      await execFileAsync('npx', ['tsx', cliPath, '--help'], {
        env: { ...process.env, DISABLE_CLI: '1' },
      });
      expect(true).toBe(false);
    } catch (err: unknown) {
      const e = err as { code?: number; stderr?: string };
      expect(e.code).toBe(1);
      expect(e.stderr || '').toContain('CLI is disabled');
    }
  });

  test('shows help when DISABLE_CLI is not set', async () => {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    // This may try to connect to DB for some commands, but --help should
    // just print help text and exit before any action runs.
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    delete env.DISABLE_CLI;
    const { stdout } = await execFileAsync('npx', ['tsx', cliPath, '--help'], { env });
    expect(stdout).toContain('chess-admin');
    expect(stdout).toContain('create');
    expect(stdout).toContain('edit');
    expect(stdout).toContain('list reports');
    expect(stdout).toContain('show report');
  });
});

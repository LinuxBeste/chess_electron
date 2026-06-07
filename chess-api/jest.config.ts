import path from 'path';
import os from 'os';
import fs from 'fs';
import type { Config } from 'jest';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chess-api-test-'));
process.env.DB_PATH = path.join(tmpDir, 'chess.db');

const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
};

export default config;

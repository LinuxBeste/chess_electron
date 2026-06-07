import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chess-api-test-'));
process.env.DB_PATH = path.join(tmpDir, 'chess.db');

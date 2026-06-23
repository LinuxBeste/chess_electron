import { beforeAll } from '@jest/globals';
import { initDb, getDb } from '../src/db.js';

beforeAll(async () => {
  try {
    const pool = getDb();
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO chess');
    await pool.query('GRANT ALL ON SCHEMA public TO public');
    await initDb();
  } catch {
    /* DB not available — tests that need it will fail individually */
  }
}, 30000);

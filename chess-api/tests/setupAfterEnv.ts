import { beforeAll } from '@jest/globals';
import { initDb, getDb, resetMigrations } from '../src/db.js';

beforeAll(async () => {
  try {
    const pool = getDb();
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('GRANT ALL ON SCHEMA public TO chess');
    await pool.query('GRANT ALL ON SCHEMA public TO public');
    resetMigrations();
    await initDb();
  } catch (err) {
    console.error('DB setup failed:', err);
  }
}, 30000);

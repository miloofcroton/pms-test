import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://sync_app:sync_app_dev_password@localhost:5432/sync_app',
});

// Shared by the store and the Postgres RentLive fake, so it knows none of their schemas.
export const db = drizzle(pool, { casing: 'snake_case' });

export async function getDBStatus(): Promise<'up' | 'down'> {
  try {
    await pool.query('select 1');
    return 'up';
  }
  catch {
    return 'down';
  }
}

export async function closeDB(): Promise<void> {
  await pool.end();
}

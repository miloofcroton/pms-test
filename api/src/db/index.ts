import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

import * as schema from './schema';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://pms:pms_dev_password@localhost:5432/pms',
});

export const db = drizzle(pool, {
  schema,
  casing: 'snake_case',
});

// Relative to the working directory: the api dir in dev, /app in the image.
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: 'drizzle' });
}

export async function getDBStatus(): Promise<'up' | 'down'> {
  try {
    await pool.query('select 1');
    return 'up';
  } catch {
    return 'down';
  }
}

export async function closeDB(): Promise<void> {
  await pool.end();
}

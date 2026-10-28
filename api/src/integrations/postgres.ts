import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://sync_app:sync_app_dev_password@localhost:5432/sync_app',
});

// Shared by every schema in modules/, so it imports none of them.
export const db = drizzle(pool, { casing: 'snake_case' });

export const getDBStatus = async (): Promise<'up' | 'down'> => {
  try {
    await pool.query('select 1');
    return 'up';
  }
  catch {
    return 'down';
  }
};

export const closeDB = async (): Promise<void> => {
  await pool.end();
};

// Relative to the working directory: the api dir in dev, /app in the image.
export const runMigrations = async (): Promise<void> => {
  await migrate(db, { migrationsFolder: 'drizzle' });
};

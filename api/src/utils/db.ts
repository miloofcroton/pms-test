import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as rentliveSchema from '../resources/rentlive.schema';
import * as syncSchema from '../resources/sync.schema';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://pms:pms_dev_password@localhost:5432/pms',
});

export const db = drizzle(pool, {
  schema: {
    ...rentliveSchema,
    ...syncSchema,
  },
  casing: 'snake_case',
});

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

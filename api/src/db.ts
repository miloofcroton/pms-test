import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://pms:pms_dev_password@localhost:5432/pms',
});

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

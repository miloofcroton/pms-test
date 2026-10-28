import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDB, db, getDBStatus, runMigrations } from './postgres';

// One pool for the whole file, so it is closed once.
afterAll(closeDB);

describe('database', () => {
  it('is reachable', async () => {
    expect(await getDBStatus()).toBe('up');
  });
});

describe('migrations', () => {
  beforeAll(runMigrations);

  it('creates the lakeside, rentlive and sync tables', async () => {
    const { rows } = await db.execute<{
      table_schema: string;
      table_name: string
    }>(sql`
      select table_schema, table_name from information_schema.tables
      where table_schema in ('lakeside', 'rentlive', 'sync')
      order by 1, 2
    `);
    expect(rows.map((r) => `${r.table_schema}.${r.table_name}`)).toEqual([
      'lakeside.snapshots',
      'rentlive.residents',
      'rentlive.units',
      'sync.change_log',
      'sync.decisions',
      'sync.runs',
    ]);
  });

  it('can run twice', async () => {
    await expect(runMigrations()).resolves.toBeUndefined();
  });
});

import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDB, db } from './db';
import { runMigrations } from './migrate';

describe('migrations', () => {
  beforeAll(runMigrations);
  afterAll(closeDB);

  it('creates the rentlive and sync tables', async () => {
    const { rows } = await db.execute<{
      table_schema: string;
      table_name: string
    }>(sql`
      select table_schema, table_name from information_schema.tables
      where table_schema in ('rentlive', 'sync')
      order by 1, 2
    `);
    expect(rows.map((r) => `${r.table_schema}.${r.table_name}`)).toEqual([
      'rentlive.residents',
      'rentlive.units',
      'sync.change_log',
      'sync.decisions',
      'sync.lease_customers',
      'sync.leases',
      'sync.properties',
      'sync.runs',
    ]);
  });

  it('can run twice', async () => {
    await expect(runMigrations()).resolves.toBeUndefined();
  });
});

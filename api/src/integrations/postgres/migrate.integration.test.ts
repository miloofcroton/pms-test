import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDB, db } from './connection';
import { runMigrations } from './migrate';

describe('migrations', () => {
  beforeAll(runMigrations);
  afterAll(closeDB);

  it('creates the lakeside_normal, rentlive and sync_audit tables', async () => {
    const { rows } = await db.execute<{
      table_schema: string;
      table_name: string
    }>(sql`
      select table_schema, table_name from information_schema.tables
      where table_schema in ('lakeside_normal', 'rentlive', 'sync_audit')
      order by 1, 2
    `);
    expect(rows.map((r) => `${r.table_schema}.${r.table_name}`)).toEqual([
      'lakeside_normal.lease_customers',
      'lakeside_normal.leases',
      'lakeside_normal.properties',
      'rentlive.residents',
      'rentlive.units',
      'sync_audit.change_log',
      'sync_audit.decisions',
      'sync_audit.runs',
    ]);
  });

  it('can run twice', async () => {
    await expect(runMigrations()).resolves.toBeUndefined();
  });
});

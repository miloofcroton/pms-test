import { sql } from 'drizzle-orm';
import { afterAll, beforeAll } from 'vitest';

import { closeDB, db, runMigrations } from './src/integrations/postgres';

// Runs around every integration test file: the test database is migrated and emptied first, so a file sees only its own rows.
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.endsWith('_test')) {
    throw new Error(`Integration tests empty their database, so they only run against one whose name ends in _test, not ${process.env.DATABASE_URL}`);
  }
  await runMigrations();
  await db.execute(sql`
    truncate lakeside.snapshots, rentlive.units, rentlive.residents, sync.runs, sync.decisions, sync.change_log, sync.exceptions
    restart identity cascade
  `);
});

afterAll(closeDB);

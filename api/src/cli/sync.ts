import { relative, resolve } from 'node:path';

import { closeDB, runMigrations } from '../integrations/postgres';
import { fileClient } from '../modules/lakeside/client';
import { postgresRentLive } from '../modules/rentlive/postgres';
import { runSync } from '../modules/sync/runner';
import { postgresStore } from '../modules/sync/store-postgres';

import { formatReport } from './format';

// Runs one snapshot through the sync and prints what it did: `mise run sync data/day1.json`.
// It exits with 1 when the run didn't finish, so a script can tell.

const main = async (): Promise<void> => {
  const [path] = process.argv.slice(2);
  if (!path) {
    console.error('Usage: mise run sync <snapshot path>, for example mise run sync data/day1.json');
    process.exitCode = 2;
    return;
  }

  // npm runs this from api/, so read the path from wherever the command was typed.
  const from = process.env.INIT_CWD ?? process.cwd();
  const source = resolve(from, path);
  try {
    await runMigrations();
    const report = await runSync(source, {
      lakeside: fileClient,
      rentLive: postgresRentLive,
      store: postgresStore,
    });
    console.log(formatReport(report, relative(from, source)));
    process.exitCode = report.status === 'ok' ? 0 : 1;
  }
  finally {
    await closeDB();
  }
};

void main();

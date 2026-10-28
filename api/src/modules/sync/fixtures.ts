import { fileClient } from '~/modules/lakeside/client';
import { postgresRentLive } from '~/modules/rentlive/postgres';
import { runSync } from '~/modules/sync/runner';
import { postgresStore } from '~/modules/sync/store-postgres';
import type { RunReport } from '~/modules/sync/runner';

// Helpers for the integration tests, which run the real snapshots against the test database.

export const snapshotPath = (day: number): string => {
  return new URL(`../../../../data/day${day}.json`, import.meta.url).pathname;
};

export const postgresDeps = {
  lakeside: fileClient,
  rentLive: postgresRentLive,
  store: postgresStore,
};

/** Runs the given days, in order, against Postgres. */
export const runDays = async (days: Array<number>): Promise<Array<RunReport>> => {
  const reports: Array<RunReport> = [];
  for (const day of days) {
    reports.push(await runSync(snapshotPath(day), postgresDeps));
  }
  return reports;
};

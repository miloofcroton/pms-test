import { fileClient } from '../lakeside/client';
import { postgresRentLive } from '../rentlive/postgres';

import { runSync } from './runner';
import { postgresStore } from './store-postgres';
import type { RunReport } from './runner';

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

import type { ChangeEntry } from './change-log';
import type { RunError } from './errors';
import type { SyncException } from './exceptions';
import type { Decision } from './rules';
import type { RunCounts, RunStatus } from './schema';

// Where the runner keeps the sync app's own records: snapshots, runs, decisions, exceptions and the change log.
// The runner only reaches storage through this type, so it runs the same against memory in unit tests and Postgres in the app.

export type SnapshotToStore = {
  source: string;
  propertyId: string | null;
  generatedAt: string | null;
  body: unknown;
};

/** The property's last successful run, which a new run is compared with and must not be older than. */
export type LastRun = {
  runId: number;
  generatedAt: string;
  body: unknown;
};

export type RunOutcome = {
  status: Exclude<RunStatus, 'running'>;
  error: RunError | null;
  counts: RunCounts;
};

export type RunResults = {
  decisions: Array<Decision>;
  exceptions: Array<SyncException>;
  changes: Array<ChangeEntry>;
};

export type SyncStore = {
  startRun: (source: string) => Promise<number>;
  // Stores the snapshot the run fetched, and links it to the run.
  saveSnapshot: (runId: number, snapshot: SnapshotToStore) => Promise<void>;
  // Ordered by `generated_at`, then by run, so rerunning the same snapshot finds the run before it.
  lastSuccessfulRun: (propertyId: string) => Promise<LastRun | null>;
  reviewExceptions: (runId: number) => Promise<Array<SyncException>>;
  // Replaces each resident's latest decision, and adds the run's exceptions and change-log entries.
  saveResults: (runId: number, propertyId: string, results: RunResults) => Promise<void>;
  finishRun: (runId: number, outcome: RunOutcome) => Promise<void>;
};

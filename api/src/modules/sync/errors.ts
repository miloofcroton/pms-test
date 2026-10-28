import type { FetchResult } from '~/modules/lakeside/client';
import type { SnapshotError } from '~/modules/lakeside/normalize';

// An error concerns a whole run: the snapshot couldn't be fetched or read, was out of date, or the run broke.
// A run has at most one, stored on the run itself, and nothing in the snapshot is applied.
// The run's status is `refused` for a `stale` error, since nothing went wrong, and `failed` for the rest.
// Problems inside the data are exceptions instead, in `exceptions.ts`.

export type RunErrorKind = 'fetch' | 'structure' | 'stale' | 'crash';

export type RunError = {
  kind: RunErrorKind;
  reason:
    | 'snapshot_not_found'
    | 'snapshot_unreadable'
    | 'snapshot_invalid_json'
    | 'invalid_structure'
    | 'snapshot_older_than_last_run'
    | 'run_crashed';
  details: Record<string, unknown>;
};

const FETCH_REASONS = {
  not_found: 'snapshot_not_found',
  unreadable: 'snapshot_unreadable',
  invalid_json: 'snapshot_invalid_json',
} as const;

/** The Lakeside client couldn't fetch or decode the snapshot. */
export const fetchErrorOf = (result: Extract<FetchResult, { ok: false }>, source: string): RunError => {
  return {
    kind: 'fetch',
    reason: FETCH_REASONS[result.error],
    details: {
      source,
      message: result.message,
    },
  };
};

/** The snapshot's structure broke the contract, so the normalizer threw. */
export const structureErrorOf = (error: SnapshotError): RunError => {
  return {
    kind: 'structure',
    reason: 'invalid_structure',
    details: {
      field: error.field,
      value: error.value,
    },
  };
};

/** Something unexpected was thrown partway through the run: our failure, not Lakeside's. */
export const crashErrorOf = (thrown: unknown): RunError => {
  return {
    kind: 'crash',
    reason: 'run_crashed',
    details: { message: thrown instanceof Error ? thrown.message : String(thrown) },
  };
};

/** The snapshot is older than the last run's, so nothing is applied and the run is refused, not failed. */
export const staleErrorOf = (generatedAt: string, lastGeneratedAt: string): RunError => {
  return {
    kind: 'stale',
    reason: 'snapshot_older_than_last_run',
    // The same format for both, since one comes from the snapshot as sent and the other back from the database.
    details: {
      generatedAt: new Date(generatedAt).toISOString(),
      lastGeneratedAt: new Date(lastGeneratedAt).toISOString(),
    },
  };
};

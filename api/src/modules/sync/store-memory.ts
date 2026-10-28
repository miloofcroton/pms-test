import type { ChangeEntry } from './change-log';
import type { SyncException } from './exceptions';
import type { Decision } from './rules';
import type { RunOutcome, SnapshotToStore, SyncStore } from './store';

// A `SyncStore` in memory, for unit tests, with its tables open so a test can check what was saved.

export type MemoryRun = Partial<RunOutcome> & {
  id: number;
  source: string;
  snapshotId: number | null;
  finished: boolean;
};

export type MemoryTables = {
  snapshots: Array<SnapshotToStore & { id: number }>;
  runs: Array<MemoryRun>;
  // Keyed by `property/unit/resident`, latest only.
  decisions: Map<string, Decision & { runId: number }>;
  exceptions: Array<SyncException & { runId: number }>;
  changes: Array<ChangeEntry & {
    runId: number;
    propertyId: string
  }>;
};

export const createMemoryStore = (): SyncStore & { tables: MemoryTables } => {
  const tables: MemoryTables = {
    snapshots: [],
    runs: [],
    decisions: new Map(),
    exceptions: [],
    changes: [],
  };
  const runOf = (runId: number): MemoryRun => {
    const run = tables.runs.find((candidate) => candidate.id === runId);
    if (!run) {
      throw new Error(`No run ${runId}`);
    }
    return run;
  };

  return {
    tables,

    startRun: async (source) => {
      const run: MemoryRun = {
        id: tables.runs.length + 1,
        source,
        snapshotId: null,
        finished: false,
      };
      tables.runs.push(run);
      return run.id;
    },

    saveSnapshot: async (runId, snapshot) => {
      const stored = {
        id: tables.snapshots.length + 1,
        ...snapshot,
      };
      tables.snapshots.push(stored);
      runOf(runId).snapshotId = stored.id;
    },

    lastSuccessfulRun: async (propertyId) => {
      const candidates = tables.runs
        .filter((run) => run.status === 'ok')
        .map((run) => ({
          run,
          snapshot: tables.snapshots.find((snapshot) => snapshot.id === run.snapshotId),
        }))
        .filter(({ snapshot }) => snapshot?.propertyId === propertyId && snapshot.generatedAt !== null)
        .sort((a, b) => Date.parse(b.snapshot!.generatedAt!) - Date.parse(a.snapshot!.generatedAt!) || b.run.id - a.run.id);
      const [last] = candidates;
      if (!last) {
        return null;
      }
      return {
        runId: last.run.id,
        generatedAt: last.snapshot!.generatedAt!,
        body: last.snapshot!.body,
      };
    },

    reviewExceptions: async (runId) => {
      return tables.exceptions
        .filter((exception) => exception.runId === runId && exception.kind === 'review')
        .map(({ runId: _, ...exception }) => exception);
    },

    saveResults: async (runId, propertyId, { decisions, exceptions, changes }) => {
      for (const decision of decisions) {
        tables.decisions.set(`${propertyId}/${decision.unitRemoteId}/${decision.residentRemoteId}`, {
          ...decision,
          runId,
        });
      }
      tables.exceptions.push(...exceptions.map((exception) => ({
        ...exception,
        runId,
      })));
      tables.changes.push(...changes.map((change) => ({
        ...change,
        runId,
        propertyId,
      })));
    },

    finishRun: async (runId, outcome) => {
      Object.assign(runOf(runId), outcome, { finished: true });
    },
  };
};

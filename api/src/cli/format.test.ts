import { describe, expect, it } from 'vitest';

import type { RunReport } from '../modules/sync/runner';

import { formatReport } from './format';

const counts = {
  unitsUpserted: 16,
  residentsUpserted: 16,
  movedIn: 1,
  movedOut: 0,
  skipped: 6,
  flagged: 1,
};

describe('formatReport', () => {
  it('prints a finished run: counts, each move and flag, and the other changes by kind', () => {
    const report: RunReport = {
      runId: 7,
      status: 'ok',
      error: null,
      counts,
      changes: [
        {
          kind: 'unit_created',
          unitRemoteId: '5001',
          residentRemoteId: null,
          details: {},
        },
        {
          kind: 'unit_created',
          unitRemoteId: '5002',
          residentRemoteId: null,
          details: {},
        },
        {
          kind: 'moved_in',
          unitRemoteId: '5001',
          residentRemoteId: '3001',
          details: { leaseRemoteId: '9001' },
        },
        {
          kind: 'flagged_for_review',
          unitRemoteId: '5007',
          residentRemoteId: '3011',
          details: { reason: 'unknown_customer_type' },
        },
      ],
    };
    expect(formatReport(report, 'data/day1.json')).toBe([
      'Run 7 of data/day1.json: ok',
      '',
      '  units upserted      16',
      '  residents upserted  16',
      '  moved in            1',
      '  moved out           0',
      '  skipped             6',
      '  flagged             1',
      '',
      'Moves and flags:',
      '  moved in            5001/3001  lease 9001',
      '  flagged for review  5007/3011  unknown_customer_type',
      '',
      'Other changes:',
      '  unit created        2',
    ].join('\n'));
  });

  it('says when a run changed nothing', () => {
    const report: RunReport = {
      runId: 8,
      status: 'ok',
      error: null,
      counts,
      changes: [],
    };
    expect(formatReport(report, 'data/day1.json')).toContain('No changes.');
  });

  it('prints the error of a run that did not finish', () => {
    const report: RunReport = {
      runId: 9,
      status: 'refused',
      error: {
        kind: 'stale',
        reason: 'snapshot_older_than_last_run',
        details: {
          generatedAt: '2026-10-28T06:30:00Z',
          lastGeneratedAt: '2026-10-29T06:30:00Z',
        },
      },
      counts,
      changes: [],
    };
    expect(formatReport(report, 'data/day1.json')).toBe([
      'Run 9 of data/day1.json: refused',
      '',
      '  stale error: snapshot_older_than_last_run',
      '  {"generatedAt":"2026-10-28T06:30:00Z","lastGeneratedAt":"2026-10-29T06:30:00Z"}',
    ].join('\n'));
  });
});

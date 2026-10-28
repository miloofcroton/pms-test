import { describe, expect, it } from 'vitest';

import { SnapshotError } from '../lakeside/normalize';

import { crashErrorOf, fetchErrorOf, staleErrorOf, structureErrorOf } from './errors';

describe('fetchErrorOf', () => {
  it.each([
    ['not_found', 'snapshot_not_found'],
    ['unreadable', 'snapshot_unreadable'],
    ['invalid_json', 'snapshot_invalid_json'],
  ] as const)('turns a %s fetch into a %s fetch error', (error, reason) => {
    expect(fetchErrorOf({
      ok: false,
      error,
      message: 'data/missing.json: no such file',
    }, 'data/missing.json')).toEqual({
      kind: 'fetch',
      reason,
      details: {
        source: 'data/missing.json',
        message: 'data/missing.json: no such file',
      },
    });
  });
});

describe('structureErrorOf', () => {
  it('keeps the field and value that broke the contract', () => {
    expect(structureErrorOf(new SnapshotError('lease.id', null))).toEqual({
      kind: 'structure',
      reason: 'invalid_structure',
      details: {
        field: 'lease.id',
        value: null,
      },
    });
  });
});

describe('crashErrorOf', () => {
  it('keeps the message of whatever was thrown', () => {
    expect(crashErrorOf(new Error('connection reset'))).toEqual({
      kind: 'crash',
      reason: 'run_crashed',
      details: { message: 'connection reset' },
    });
  });

  it('copes with something thrown that is not an Error', () => {
    expect(crashErrorOf('boom').details).toEqual({ message: 'boom' });
  });
});

describe('staleErrorOf', () => {
  it('refuses a snapshot older than the last run, keeping both timestamps', () => {
    expect(staleErrorOf('2026-10-28T06:30:00Z', '2026-10-29T06:30:00Z')).toEqual({
      kind: 'stale',
      reason: 'snapshot_older_than_last_run',
      details: {
        generatedAt: '2026-10-28T06:30:00Z',
        lastGeneratedAt: '2026-10-29T06:30:00Z',
      },
    }); // day 1 after day 2
  });
});

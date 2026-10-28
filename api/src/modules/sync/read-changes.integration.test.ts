import { beforeAll, describe, expect, it } from 'vitest';

import { runDays } from './fixtures';
import { listChanges } from './read-changes';
import { getProperty, okSnapshots } from './read-snapshots';
import type { RunReport } from './runner';

const PROPERTY = '100';
let reports: Array<RunReport>;

beforeAll(async () => {
  reports = await runDays([1, 1, 2]);
});

describe('okSnapshots and getProperty', () => {
  it('gives the property\'s successful snapshots, newest first', async () => {
    const found = await okSnapshots(PROPERTY);
    expect(found.map(({ runId }) => runId)).toEqual([reports[2].runId, reports[1].runId, reports[0].runId]);
    expect(found[0].snapshot.generatedAt).toBe('2026-10-29T06:30:00Z');
  });

  it('can give just the latest', async () => {
    expect(await okSnapshots(PROPERTY, 1)).toHaveLength(1);
  });

  it('gives the property, with its timezone, from the latest snapshot', async () => {
    expect(await getProperty(PROPERTY)).toEqual({
      remoteId: PROPERTY,
      name: 'Harbor View Apartments',
      timezone: 'America/Los_Angeles',
    });
  });

  it('gives null for a property it has never synced', async () => {
    expect(await getProperty('no-such-property')).toBeNull();
  });
});

describe('listChanges', () => {
  it('gives the property\'s whole change log, newest first', async () => {
    const changes = await listChanges(PROPERTY);
    expect(changes).toHaveLength(reports.reduce((total, report) => total + report.changes.length, 0));
    expect(changes[0].runId).toBe(reports[2].runId);
    expect(changes.at(-1)?.runId).toBe(reports[0].runId);
    expect(changes.map((change) => change.id)).toEqual(changes.map((change) => change.id)
      .sort((a, b) => b - a));
    expect(Date.parse(changes[0].recordedAt)).not.toBeNaN();
  });

  it('gives one unit\'s entries, including its residents\'', async () => {
    const changes = await listChanges(PROPERTY, { unitRemoteId: '5011' });
    expect(changes.every((change) => change.unitRemoteId === '5011')).toBe(true);
    expect(changes.map((change) => `${change.kind} ${change.residentRemoteId ?? ''}`.trim())).toEqual(expect.arrayContaining([
      'moved_out 3016', // Mia on day 2
      'moved_in 3021', // Nora on day 2
      'moved_in 3016', // Mia on day 1
    ]));
  });

  it('gives one resident\'s entries on one unit, newest first', async () => {
    const changes = await listChanges(PROPERTY, {
      unitRemoteId: '5001',
      residentRemoteId: '3001',
    });
    expect(changes.map((change) => change.kind)).toEqual([
      'resident_updated', // day 2: re-signed on L9101
      'moved_in', // day 1
      'resident_created', // day 1
    ]);
  });

  it('gives nothing for a property it has never synced', async () => {
    expect(await listChanges('no-such-property')).toEqual([]);
  });
});

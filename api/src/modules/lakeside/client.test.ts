import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { fileClient } from '~/modules/lakeside/client';

describe('fileClient.fetchSnapshot', () => {
  let folder: string;

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'lakeside-'));
  });

  it('returns the decoded snapshot, otherwise raw', async () => {
    const source = join(folder, 'snapshot.json');
    await writeFile(source, JSON.stringify({ units: [{ id: 5001 }] }));
    expect(await fileClient.fetchSnapshot(source)).toEqual({
      ok: true,
      snapshot: { units: [{ id: 5001 }] },
    });
  });

  it('reads the real day 1 snapshot', async () => {
    const result = await fileClient.fetchSnapshot(new URL('../../../../data/day1.json', import.meta.url).pathname);
    expect(result).toMatchObject({
      ok: true,
      snapshot: { meta: { generated_at: '2026-10-28T06:30:00Z' } },
    });
  });

  it('returns not_found for a file that does not exist', async () => {
    expect(await fileClient.fetchSnapshot(join(folder, 'missing.json'))).toEqual({
      ok: false,
      error: 'not_found',
      // Node's message names the path, so the client doesn't add it a second time.
      message: expect.stringMatching(/^ENOENT: .*missing\.json'$/),
    });
  });

  it('returns invalid_json for a file that is not JSON', async () => {
    const source = join(folder, 'broken.json');
    await writeFile(source, '{ "units": [');
    expect(await fileClient.fetchSnapshot(source)).toEqual({
      ok: false,
      error: 'invalid_json',
      message: expect.any(String),
    });
  });

  it('returns unreadable for a path it cannot read as a file', async () => {
    expect(await fileClient.fetchSnapshot(folder)).toEqual({
      ok: false,
      error: 'unreadable',
      message: expect.any(String),
    });
  });
});

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { listSnapshotFiles, snapshotPathFor } from './snapshots';

describe('the snapshot folder', () => {
  let folder: string;

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), 'snapshots-'));
    await writeFile(join(folder, 'day2.json'), '{}');
    await writeFile(join(folder, 'day1.json'), '{}');
    await writeFile(join(folder, 'notes.txt'), '');
    await mkdir(join(folder, 'old.json'));
  });

  it('lists the JSON files, sorted', async () => {
    expect(await listSnapshotFiles(folder)).toEqual(['day1.json', 'day2.json']);
  });

  it('gives the path of a snapshot in the folder', async () => {
    expect(await snapshotPathFor(folder, 'day1.json')).toBe(join(folder, 'day1.json'));
  });

  it.each([
    ['a file that is not there', 'day9.json'],
    ['a file that is not JSON', 'notes.txt'],
    ['a folder', 'old.json'],
    ['a path out of the folder', '../day1.json'],
    ['a path into a subfolder', 'old.json/../day1.json'],
    ['an absolute path', '/etc/passwd'],
    ['something that is not a string', 7],
  ])('refuses %s', async (_, name) => {
    expect(await snapshotPathFor(folder, name)).toBeNull();
  });
});

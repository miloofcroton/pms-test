import { afterAll, describe, expect, it } from 'vitest';

import { closeDB, getDBStatus } from './db';

describe('database', () => {
  afterAll(closeDB);

  it('is reachable', async () => {
    expect(await getDBStatus()).toBe('up');
  });
});

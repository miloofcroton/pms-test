import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';
import { TEST_DATABASE_URL } from './vitest.integration.global';

// Runs against `sync_app_test` in the postgres container, never the app's `sync_app`: `mise run test:integration` starts postgres first.
export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // Creates the test database once, if it's missing.
    globalSetup: ['./vitest.integration.global.ts'],
    // Migrates and empties it before each file, so every file starts from nothing.
    setupFiles: ['./vitest.integration.setup.ts'],
    // Files share the test database, so they run one at a time.
    fileParallelism: false,
  },
}));

import { defineConfig } from 'vitest/config';

// Runs against the postgres container: `mise run test:integration` starts it first.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    // Tests share one database, so run files one at a time.
    fileParallelism: false,
  },
});

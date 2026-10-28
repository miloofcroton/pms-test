import { defineConfig } from 'vitest/config';

// Pure logic only: no database, no network.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/**', 'src/**/*.integration.test.ts'],
    environment: 'node',
  },
});

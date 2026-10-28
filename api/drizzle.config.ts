import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  casing: 'snake_case',
  schema: [
    './src/modules/lakeside/schema.ts',
    './src/modules/rentlive/schema.ts',
    './src/modules/sync/schema.ts',
  ],
  out: './drizzle',
  schemaFilter: [
    'lakeside',
    'rentlive',
    'sync',
  ],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://sync_app:sync_app_dev_password@localhost:5432/sync_app',
  },
});

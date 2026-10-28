import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  casing: 'snake_case',
  schema: [
    './src/integrations/lakeside/schema.ts',
    './src/integrations/rentlive/schema.ts',
    './src/store/schema.ts',
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

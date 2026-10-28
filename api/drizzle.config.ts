import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  casing: 'snake_case',
  schema: ['./src/store/*.schema.ts', './src/clients/*/*.schema.ts'],
  out: './drizzle',
  schemaFilter: ['rentlive', 'sync'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://sync:sync_dev_password@localhost:5432/sync',
  },
});

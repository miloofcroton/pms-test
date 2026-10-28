import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  casing: 'snake_case',
  schema: './src/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['rentlive', 'sync'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://pms:pms_dev_password@localhost:5432/pms',
  },
});

import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { db } from './connection';

// Relative to the working directory: the api dir in dev, /app in the image.
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: 'drizzle' });
}

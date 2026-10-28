import { runMigrations } from '../db';

export default defineNitroPlugin(async () => {
  await runMigrations();
});

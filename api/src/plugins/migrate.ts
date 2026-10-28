import { runMigrations } from '../integrations/postgres';

export default defineNitroPlugin(async () => {
  await runMigrations();
});

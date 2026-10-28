import { runMigrations } from '../integrations/postgres/migrate';

export default defineNitroPlugin(async () => {
  await runMigrations();
});

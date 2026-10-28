import { runMigrations } from '../utils/migrate';

export default defineNitroPlugin(async () => {
  await runMigrations();
});

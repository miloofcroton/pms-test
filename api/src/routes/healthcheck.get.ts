import { getDBStatus } from '../integrations/postgres/connection';

export default defineEventHandler(async () => ({
  status: 'healthy',
  db: await getDBStatus(),
  timestamp: new Date().toISOString(),
}));

import { getDBStatus } from '../db';

export default defineEventHandler(async () => ({
  status: 'healthy',
  db: await getDBStatus(),
  timestamp: new Date().toISOString(),
}));

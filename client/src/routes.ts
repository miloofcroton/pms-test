import { index, route } from '@react-router/dev/routes';
import type { RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/runs.tsx'),
  route('runs/:runId', 'routes/run.tsx'),
  route('properties/:propertyId/units', 'routes/units.tsx'),
] satisfies RouteConfig;

import { index, route } from '@react-router/dev/routes';
import type { RouteConfig } from '@react-router/dev/routes';

export default [
  index('routes/runs.tsx'),
  route('runs/:runId', 'routes/run.tsx'),
  route('properties/:propertyId/units', 'routes/units.tsx'),
  route('properties/:propertyId/units/:unitId', 'routes/unit.tsx'),
  route('properties/:propertyId/units/:unitId/residents/:residentId', 'routes/resident.tsx'),
  route('properties/:propertyId/changes', 'routes/changes.tsx'),
] satisfies RouteConfig;

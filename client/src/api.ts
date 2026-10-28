// The API the views read from, and the types of what it returns.
// The types come straight from the api's reads, type-only, so a changed field breaks the client's typecheck instead of failing quietly.

import type { Property } from '../../api/src/modules/lakeside/normalize';
import type { ChangeView } from '../../api/src/modules/sync/read-changes';
import type { ResidentDetail } from '../../api/src/modules/sync/read-resident';
import type { RunDetail, RunSummary } from '../../api/src/modules/sync/read-runs';
import type { UnitDetail } from '../../api/src/modules/sync/read-unit';
import type { UnitView } from '../../api/src/modules/sync/read-units';
import type { RunReport } from '../../api/src/modules/sync/runner';

export type { ChangeView, Property, ResidentDetail, RunDetail, RunReport, RunSummary, UnitDetail, UnitView };

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4444';

/** Throws the response on an error status, so the route's error boundary shows it. */
export const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw response;
  }
  return response.json() as Promise<T>;
};

export const postJson = async <T>(path: string, body: unknown): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw response;
  }
  return response.json() as Promise<T>;
};

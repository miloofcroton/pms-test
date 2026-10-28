// The API the views read from.
// The shapes of its JSON are shared with the api in `@sync-app/shared`, so a change there is checked on both sides.

export type {
  ChangeKind,
  ChangeView,
  DataReason,
  DecisionReason,
  Property,
  ResidentDetail,
  RunDetail,
  RunError,
  RunErrorReason,
  RunReport,
  RunStatus,
  RunSummary,
  SyncException,
  UnitDetail,
  UnitView,
} from '@sync-app/shared';

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

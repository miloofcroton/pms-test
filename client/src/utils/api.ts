// The API the views read from, and the shapes of the JSON it returns.
// The client doesn't import the api's code, so these types are the client's own copy of the api's responses and must be kept in step by hand.

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4444';

export type Property = {
  remoteId: string;
  name: string;
  timezone: string;
};

// Why a resident was or wasn't moved.
export type DecisionReason =
  | 'moved_in'
  | 'not_a_lease_signer'
  | 'unknown_customer_type'
  | 'not_current'
  | 'previously_moved_out'
  | 'no_move_in_date'
  | 'move_in_date_in_future'
  | 'move_in_date_outside_window'
  | 'move_out_date_not_in_future'
  | 'stays_current'
  | 'moved_out'
  | 'move_out_date_in_future'
  | 'no_move_out_date'
  | 'other_lease_moved_in'
  | 'competing_leases'
  | 'missing_from_snapshot'
  | 'past_beyond_sync_window';

// Why a record was left out of the snapshot, or kept without its broken part.
export type DataReason =
  | 'duplicate_unit_differs'
  | 'lease_on_conflicting_unit'
  | 'lease_without_unit'
  | 'lease_unit_not_in_snapshot'
  | 'lease_customers_not_a_list'
  | 'lease_interval_not_found'
  | 'lease_interval_invalid_date'
  | 'customer_invalid_date';

// Why a whole run failed or was refused.
export type RunErrorReason =
  | 'snapshot_not_found'
  | 'snapshot_unreadable'
  | 'snapshot_invalid_json'
  | 'invalid_structure'
  | 'snapshot_older_than_last_run'
  | 'run_crashed';

export type RunStatus = 'running' | 'ok' | 'refused' | 'failed';

export type RunError = {
  kind: 'fetch' | 'structure' | 'stale' | 'crash';
  reason: RunErrorReason;
  details: Record<string, unknown>;
};

export type RunCounts = {
  unitsUpserted: number;
  residentsUpserted: number;
  movedIn: number;
  movedOut: number;
  skipped: number;
  flagged: number;
};

export type SyncException = {
  kind: 'data' | 'review';
  propertyId: string;
  reason: DataReason | DecisionReason;
  unitRemoteId: string | null;
  leaseRemoteId: string | null;
  residentRemoteId: string | null;
};

export type RunSummary = {
  id: number;
  source: string;
  snapshotFile: string;
  propertyId: string | null;
  timezone: string | null;
  generatedAt: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  error: RunError | null;
  counts: RunCounts;
};

export type RunDetail = RunSummary & {
  exceptions: {
    data: Array<SyncException>;
    review: Array<SyncException>
  };
};

export type ChangeKind =
  | 'unit_created'
  | 'unit_status_changed'
  | 'unit_updated'
  | 'lease_added'
  | 'lease_changed'
  | 'lease_removed'
  | 'resident_created'
  | 'resident_updated'
  | 'moved_in'
  | 'moved_out'
  | 'flagged_for_review';

export type ChangeView = {
  id: number;
  runId: number;
  recordedAt: string;
  kind: ChangeKind;
  unitRemoteId: string | null;
  residentRemoteId: string | null;
  details: Record<string, unknown>;
};

export type RunReport = {
  runId: number;
  status: Exclude<RunStatus, 'running'>;
  error: RunError | null;
  counts: RunCounts;
  changes: Array<Omit<ChangeView, 'id' | 'runId' | 'recordedAt'>>;
};

export type UnitStatus = 'Occupied' | 'Vacant' | 'Model' | 'Common Area' | 'Down';

export type UnitView = {
  remoteId: string;
  unitNumber: string;
  buildingName: string | null;
  floorplanName: string | null;
  rawStatus: string | null;
  status: UnitStatus;
};

export type UnitDetail = {
  property: Property;
  generatedAt: string;
  unit: UnitView;
  leases: Array<{
    remoteId: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    people: Array<{
      residentRemoteId: string;
      firstName: string | null;
      lastName: string | null;
      type: string;
      status: string | null;
      effectiveStatus: string
    }>
  }>;
  movedIn: Array<{
    residentRemoteId: string;
    leaseRemoteId: string;
    firstName: string | null;
    lastName: string | null
  }>;
  exceptions: Array<SyncException>;
  changes: Array<ChangeView>;
};

export type ResidentDetail = {
  property: Property;
  unitRemoteId: string;
  residentRemoteId: string;
  leaseRemoteId: string;
  type: string;
  effectiveStatus: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  synced: boolean;
  inLatestSnapshot: boolean;
  seenGeneratedAt: string;
  rentLive: {
    movedIn: boolean;
    everMovedOut: boolean
  } | null;
  decision: {
    action: 'move_in' | 'move_out' | 'none';
    reason: DecisionReason;
    runId: number;
    decidedAt: string
  } | null;
  exceptions: Array<SyncException>;
  changes: Array<ChangeView>;
};

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

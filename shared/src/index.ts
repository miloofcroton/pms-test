// The types the api and the client share: the codes the api returns, and the shapes of its JSON responses.
// The api builds its responses to these types and the client reads them, so a change here is checked on both sides.
// Types only, imported with `import type`: nothing here runs, so neither build needs this package.
// One file on purpose, with no imports, because `~/` means each package's own `src/`.

// Codes.

/** Why a resident was or wasn't moved: the rule behind a decision. */
export type DecisionReason =
  // Not moved in, and every move-in rule passed.
  | 'moved_in'
  // Guarantors and occupants are never moved in.
  | 'not_a_lease_signer'
  // Not one of the four customer types, so it is not guessed at. Flagged.
  | 'unknown_customer_type'
  | 'not_current'
  // A resident who was moved out is never moved in again automatically.
  | 'previously_moved_out'
  // Current lease signer with no move-in date to check against the window. Flagged.
  | 'no_move_in_date'
  | 'move_in_date_in_future'
  // The move-in date is older than the last 14 days, counting today.
  | 'move_in_date_outside_window'
  // Current, but the move-out date is today or earlier, which contradicts the status. Flagged.
  | 'move_out_date_not_in_future'
  // Moved in and still Current.
  | 'stays_current'
  // Moved in, not Current, and the move-out date is today or earlier.
  | 'moved_out'
  | 'move_out_date_in_future'
  // Moved in and not Current, but there is no move-out date to act on. Flagged.
  | 'no_move_out_date'
  // Would move in, but someone from a different lease is still moved in on the unit. Flagged.
  | 'other_lease_moved_in'
  // Would move in, but so would someone from a different lease on the same unit. Flagged.
  | 'competing_leases'
  // Moved in on RentLive, but the snapshot no longer has them, so nothing says they left. Flagged.
  | 'missing_from_snapshot'
  // Moved in on RentLive, but Past for more than 14 days, so the instructions say not to sync them. Flagged.
  | 'past_beyond_sync_window';

/** Why a record broke the Lakeside contract: left out of the snapshot, or kept without its broken part. */
export type DataReason =
  // Two copies of a unit disagree, so the unit is left out rather than one copy chosen.
  | 'duplicate_unit_differs'
  // The lease's unit was left out because its copies disagree, so the lease is left out too.
  | 'lease_on_conflicting_unit'
  // The lease names no unit, so it is left out.
  | 'lease_without_unit'
  // The lease's unit is not in the snapshot, so it is left out.
  | 'lease_unit_not_in_snapshot'
  // `customers.customer` is not a list, so the lease is left out.
  | 'lease_customers_not_a_list'
  // No interval matches `leaseIntervalId`, so the lease has no dates.
  | 'lease_interval_not_found'
  // The interval in effect has a date that isn't MM/DD/YYYY, so the lease has no dates.
  | 'lease_interval_invalid_date'
  // A move-in or move-out date isn't MM/DD/YYYY, so the customer is left out.
  | 'customer_invalid_date';

/** Why a whole run stopped. */
export type RunErrorReason =
  | 'snapshot_not_found'
  | 'snapshot_unreadable'
  | 'snapshot_invalid_json'
  | 'invalid_structure'
  | 'snapshot_older_than_last_run'
  | 'run_crashed';

export type RunErrorKind = 'fetch' | 'structure' | 'stale' | 'crash';

export type Action = 'move_in' | 'move_out' | 'none';

export type ExceptionKind = 'data' | 'review';

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

/** RentLive stores a unit status from a fixed list. */
export type UnitStatus = 'Occupied' | 'Vacant' | 'Model' | 'Common Area' | 'Down';

// `ok`: the run finished.
// `refused`: a `stale` error, because the snapshot was older than the last run's, so nothing was applied.
// `failed`: any other error stopped it.
export type RunStatus = 'running' | 'ok' | 'refused' | 'failed';

// Building blocks.

export type Property = {
  remoteId: string;
  name: string;
  timezone: string;
};

/** The one error that stopped a run. */
export type RunError = {
  kind: RunErrorKind;
  reason: RunErrorReason;
  details: Record<string, unknown>;
};

/** The counts on the runs view. */
export type RunCounts = {
  unitsUpserted: number;
  residentsUpserted: number;
  movedIn: number;
  movedOut: number;
  // Records never upserted to RentLive: those a data exception left out, and residents the 14-day rule doesn't sync.
  skipped: number;
  // Residents upserted but not moved, because the rules couldn't decide: review exceptions.
  flagged: number;
};

/** Something inside the data: a record left out (`data`), or a decision flagged for review (`review`). */
export type SyncException = {
  kind: ExceptionKind;
  propertyId: string;
  reason: DataReason | DecisionReason;
  unitRemoteId: string | null;
  leaseRemoteId: string | null;
  residentRemoteId: string | null;
};

/** One thing a run changed. */
export type ChangeEntry = {
  kind: ChangeKind;
  unitRemoteId: string | null;
  residentRemoteId: string | null;
  details: Record<string, unknown>;
};

// Responses.

/** `POST /runs` */
export type RunReport = {
  runId: number;
  status: Exclude<RunStatus, 'running'>;
  error: RunError | null;
  counts: RunCounts;
  changes: Array<ChangeEntry>;
};

/** Each of `GET /runs`. */
export type RunSummary = {
  id: number;
  source: string;
  snapshotFile: string;
  // Null when the run never got a readable snapshot.
  propertyId: string | null;
  timezone: string | null;
  generatedAt: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: RunStatus;
  error: RunError | null;
  counts: RunCounts;
};

/** `GET /runs/:id` */
export type RunDetail = RunSummary & {
  exceptions: {
    data: Array<SyncException>;
    review: Array<SyncException>
  };
};

/** An entry of the change log, as stored. */
export type ChangeView = ChangeEntry & {
  id: number;
  runId: number;
  recordedAt: string;
};

/** Each unit of `GET /properties/:id/units`. */
export type UnitView = {
  remoteId: string;
  unitNumber: string;
  buildingName: string | null;
  floorplanName: string | null;
  rawStatus: string | null;
  status: UnitStatus;
};

export type LeasePerson = {
  residentRemoteId: string;
  firstName: string | null;
  lastName: string | null;
  type: string;
  // The customer's own status, or null when the lease status applies.
  status: string | null;
  effectiveStatus: string;
};

export type LeaseView = {
  remoteId: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  people: Array<LeasePerson>;
};

export type MovedInView = {
  residentRemoteId: string;
  leaseRemoteId: string;
  firstName: string | null;
  lastName: string | null;
};

/** `GET /properties/:id/units/:unit` */
export type UnitDetail = {
  property: Property;
  generatedAt: string;
  unit: UnitView;
  leases: Array<LeaseView>;
  movedIn: Array<MovedInView>;
  // From the latest successful run.
  exceptions: Array<SyncException>;
  changes: Array<ChangeView>;
};

/** `GET /properties/:id/units/:unit/residents/:resident` */
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
  // False for a Past resident who moved out more than 14 days ago, whom the sync never upserts.
  synced: boolean;
  // False when the latest snapshot doesn't have them, so this is from the newest one that did.
  inLatestSnapshot: boolean;
  seenGeneratedAt: string;
  // Null when RentLive never stored them.
  rentLive: {
    movedIn: boolean;
    everMovedOut: boolean
  } | null;
  // The rule behind the latest decision about them.
  decision: {
    action: Action;
    reason: DecisionReason;
    runId: number;
    decidedAt: string
  } | null;
  // From the latest successful run.
  exceptions: Array<SyncException>;
  changes: Array<ChangeView>;
};

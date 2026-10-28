import { Link } from 'react-router';

import { getJson } from '../api';
import { ChangeLog } from '../components/change-log';
import { Exceptions } from '../components/exceptions';
import { formatTime, personName, reasonText } from '../format';
import { bad, badge, callout, facts, good, muted } from '../styles';
import type { ResidentDetail } from '../api';

import type { Route } from './+types/resident';

// One resident on one unit: who they are, whether they're moved in, why, and what happened to them.

export const clientLoader = async ({ params }: Route.ClientLoaderArgs) => {
  return getJson<ResidentDetail>(`/properties/${params.propertyId}/units/${params.unitId}/residents/${params.residentId}`);
};

const MovedIn = ({ resident }: { resident: ResidentDetail }) => {
  if (!resident.rentLive) {
    return <span className={badge}>Not in RentLive</span>;
  }
  return resident.rentLive.movedIn
    ? <span className={`${badge} ${good}`}>Moved in</span>
    : <span className={`${badge} ${resident.rentLive.everMovedOut ? bad : ''}`}>{resident.rentLive.everMovedOut ? 'Moved out' : 'Not moved in'}</span>;
};

const Resident = ({ loaderData: resident }: Route.ComponentProps) => {
  const { property } = resident;

  return (
    <>
      <p><Link to={`/properties/${property.remoteId}/units/${resident.unitRemoteId}`}>← Unit {resident.unitRemoteId}</Link></p>
      <h1>{personName(resident.firstName, resident.lastName)} <MovedIn resident={resident} /></h1>

      {!resident.inLatestSnapshot && (
        <div className={callout}>
          Not in the latest snapshot. Shown as Lakeside last described them, in the snapshot generated {formatTime(resident.seenGeneratedAt, property.timezone)}.
        </div>
      )}

      <h2>Why</h2>
      {resident.decision
        ? (
          <p>
            <strong>{reasonText(resident.decision.reason)}</strong>
            {' '}
            <span className={muted}>
              Decided {formatTime(resident.decision.decidedAt, property.timezone)} by <Link to={`/runs/${resident.decision.runId}`}>run #{resident.decision.runId}</Link>.
            </span>
          </p>
        )
        : (
          <p>
            {resident.synced
              ? 'No decision yet.'
              : 'Not synced: they moved out more than 14 days ago, so the sync never sent them to RentLive.'}
          </p>
        )}

      <h2>Details</h2>
      <dl className={facts}>
        <dt>Unit</dt>
        <dd><Link to={`/properties/${property.remoteId}/units/${resident.unitRemoteId}`}>{resident.unitRemoteId}</Link></dd>
        <dt>Lease</dt>
        <dd>{resident.leaseRemoteId}</dd>
        <dt>Type</dt>
        <dd>{resident.type}</dd>
        <dt>Effective status</dt>
        <dd>{resident.effectiveStatus}</dd>
        <dt>Move-in date</dt>
        <dd>{resident.moveInDate ?? '—'}</dd>
        <dt>Move-out date</dt>
        <dd>{resident.moveOutDate ?? '—'}</dd>
        <dt>Email</dt>
        <dd>{resident.email ?? '—'}</dd>
        <dt>Phone</dt>
        <dd>{resident.phone ?? '—'}</dd>
        <dt>Ever moved out</dt>
        <dd>{resident.rentLive ? (resident.rentLive.everMovedOut ? 'Yes' : 'No') : '—'}</dd>
      </dl>

      <h2>Exceptions</h2>
      <p className={muted}>From the latest run.</p>
      <Exceptions exceptions={resident.exceptions} propertyId={property.remoteId} />

      <h2>Change log</h2>
      <ChangeLog changes={resident.changes} propertyId={property.remoteId} timezone={property.timezone} />
    </>
  );
};

export default Resident;

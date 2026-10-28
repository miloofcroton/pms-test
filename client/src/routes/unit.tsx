import { Link } from 'react-router';

import { getJson } from '../api';
import { ChangeLog } from '../components/change-log';
import { Exceptions } from '../components/exceptions';
import { formatTime, personName, rawCode } from '../format';
import { badge, code, good, muted, scroll, table } from '../styles';
import type { UnitDetail } from '../api';

import type { Route } from './+types/unit';

// One unit: who is moved in now, its leases and the people on each, its exceptions and its change log.

export const clientLoader = async ({ params }: Route.ClientLoaderArgs) => {
  return getJson<UnitDetail>(`/properties/${params.propertyId}/units/${params.unitId}`);
};

const Unit = ({ loaderData: { property, generatedAt, unit, leases, movedIn, exceptions, changes } }: Route.ComponentProps) => {
  const residentLink = (residentRemoteId: string) => `/properties/${property.remoteId}/units/${unit.remoteId}/residents/${residentRemoteId}`;

  return (
    <>
      <p><Link to={`/properties/${property.remoteId}/units`}>← Units</Link></p>
      <h1>Unit {unit.unitNumber}</h1>
      <p>
        <span className={badge}>{unit.status}</span>
        {' '}
        Lakeside code <span className={code}>{rawCode(unit.rawStatus)}</span>
        {' · '}
        Building {unit.buildingName ?? '—'}
        {' · '}
        Floorplan {unit.floorplanName ?? '—'}
      </p>

      <h2>Moved in now</h2>
      <p className={muted}>From RentLive.</p>
      {movedIn.length === 0
        ? <p className={muted}>Nobody is moved in.</p>
        : (
          <ul>
            {movedIn.map((resident) => (
              <li key={resident.residentRemoteId}>
                <Link to={residentLink(resident.residentRemoteId)}>{personName(resident.firstName, resident.lastName)}</Link>
                {' '}
                <span className={muted}>on lease {resident.leaseRemoteId}</span>
              </li>
            ))}
          </ul>
        )}

      <h2>Leases</h2>
      <p className={muted}>From the snapshot generated {formatTime(generatedAt, property.timezone)}.</p>
      {leases.length === 0 && <p className={muted}>Lakeside sent no leases for this unit.</p>}
      {leases.map((lease) => (
        <section key={lease.remoteId}>
          <h3>
            Lease {lease.remoteId}
            {' '}
            <span className={`${badge} ${lease.status === 'Current' || lease.status === 'Notice' ? good : ''}`}>{lease.status}</span>
            {' '}
            <span className={muted}>{lease.startDate ?? '—'} to {lease.endDate ?? '—'}</span>
          </h3>
          <div className={scroll}>
            <table className={table}>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Type</th>
                  <th>Own status</th>
                  <th>Effective status</th>
                </tr>
              </thead>
              <tbody>
                {lease.people.map((person) => (
                  <tr key={person.residentRemoteId}>
                    <td><Link to={residentLink(person.residentRemoteId)}>{personName(person.firstName, person.lastName)}</Link></td>
                    <td>{person.type}</td>
                    <td>{person.status ?? <span className={muted}>the lease's</span>}</td>
                    <td>{person.effectiveStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2>Exceptions</h2>
      <p className={muted}>From the latest run.</p>
      <Exceptions exceptions={exceptions} propertyId={property.remoteId} />

      <h2>Change log</h2>
      <ChangeLog changes={changes} propertyId={property.remoteId} timezone={property.timezone} />
    </>
  );
};

export default Unit;

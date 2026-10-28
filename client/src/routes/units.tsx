import { Link } from 'react-router';

import { getJson } from '~/utils/api';
import { formatTime, rawCode } from '~/utils/format';
import { badge, code, muted, scroll, table } from '~/utils/styles';
import type { Property, UnitView } from '~/utils/api';

import type { Route } from './+types/units';

// Every unit, from what Lakeside last said, with the raw Lakeside code next to the RentLive status.

export const clientLoader = async ({ params }: Route.ClientLoaderArgs) => {
  return getJson<{
    property: Property;
    generatedAt: string;
    units: Array<UnitView>
  }>(`/properties/${params.propertyId}/units`);
};

const Units = ({ loaderData: { property, generatedAt, units } }: Route.ComponentProps) => {
  return (
    <>
      <h1>Units</h1>
      <p className={muted}>{property.name}, from the snapshot generated {formatTime(generatedAt, property.timezone)}.</p>
      <div className={scroll}>
        <table className={table}>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Building</th>
              <th>Floorplan</th>
              <th>RentLive status</th>
              <th>Lakeside code</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr key={unit.remoteId}>
                <td><Link to={`/properties/${property.remoteId}/units/${unit.remoteId}`}>{unit.unitNumber}</Link></td>
                <td>{unit.buildingName ?? '—'}</td>
                <td>{unit.floorplanName ?? '—'}</td>
                <td><span className={badge}>{unit.status}</span></td>
                <td><span className={code}>{rawCode(unit.rawStatus)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default Units;

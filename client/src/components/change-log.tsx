import { Link } from 'react-router';

import { CHANGE_KINDS, describeChange, formatTime } from '~/utils/format';
import { muted, scroll, table } from '~/utils/styles';
import type { ChangeView } from '~/utils/api';

// A change-log timeline, newest first, with each time in the property's timezone and the run that recorded it.

export const ChangeLog = ({ changes, propertyId, timezone }: {
  changes: Array<ChangeView>;
  propertyId: string;
  timezone: string
}) => {
  if (changes.length === 0) {
    return <p className={muted}>No changes recorded.</p>;
  }
  return (
    <div className={scroll}>
      <table className={table}>
        <thead>
          <tr>
            <th>When</th>
            <th>What happened</th>
            <th>Unit</th>
            <th>Resident</th>
            <th>Details</th>
            <th>Run</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.id}>
              <td>{formatTime(change.recordedAt, timezone)}</td>
              <td>{CHANGE_KINDS[change.kind]}</td>
              <td>
                {change.unitRemoteId && <Link to={`/properties/${propertyId}/units/${change.unitRemoteId}`}>{change.unitRemoteId}</Link>}
              </td>
              <td>
                {change.unitRemoteId && change.residentRemoteId && (
                  <Link to={`/properties/${propertyId}/units/${change.unitRemoteId}/residents/${change.residentRemoteId}`}>{change.residentRemoteId}</Link>
                )}
              </td>
              <td>{describeChange(change)}</td>
              <td>
                <Link to={`/runs/${change.runId}`}>#{change.runId}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

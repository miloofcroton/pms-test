import { Link } from 'react-router';

import { reasonText } from '../format';
import { muted } from '../styles';
import type { RunDetail } from '../api';

type Exception = RunDetail['exceptions']['data'][number];

const KINDS = [
  {
    kind: 'data',
    title: 'Data left out',
    help: 'A record broke the Lakeside contract, so it was left out or kept without the broken part.',
  },
  {
    kind: 'review',
    title: 'Needs review',
    help: 'The data is valid, but the rules could not settle the case safely, so nobody was moved.',
  },
] as const;

// What an exception concerns: the unit, then the resident on it, or the lease when no resident is named.
const Where = ({ exception, propertyId }: {
  exception: Exception;
  propertyId: string
}) => {
  const unit = exception.unitRemoteId;
  const parts = [
    unit && <>unit <Link to={`/properties/${propertyId}/units/${unit}`}>{unit}</Link></>,
    unit && exception.residentRemoteId && (
      <>resident <Link to={`/properties/${propertyId}/units/${unit}/residents/${exception.residentRemoteId}`}>{exception.residentRemoteId}</Link></>
    ),
    exception.residentRemoteId === null && exception.leaseRemoteId && <>lease {exception.leaseRemoteId}</>,
  ].filter(Boolean);
  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && ', '}
          {part}
        </span>
      ))}
    </>
  );
};

// Exceptions grouped by kind, each with its reason in words and a link to what it concerns.

export const Exceptions = ({ exceptions, propertyId }: {
  exceptions: Array<Exception>;
  propertyId: string
}) => {
  if (exceptions.length === 0) {
    return <p className={muted}>No exceptions.</p>;
  }
  return (
    <>
      {KINDS.map(({ kind, title, help }) => {
        const ofKind = exceptions.filter((exception) => exception.kind === kind);
        if (ofKind.length === 0) {
          return null;
        }
        return (
          <section key={kind}>
            <h3>{title} ({ofKind.length})</h3>
            <p className={muted}>{help}</p>
            <ul>
              {ofKind.map((exception, index) => (
                <li key={index}>
                  {reasonText(exception.reason)}
                  {' '}
                  <span className={muted}>
                    <Where exception={exception} propertyId={propertyId} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
};

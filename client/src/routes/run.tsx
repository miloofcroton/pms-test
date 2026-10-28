import { Link } from 'react-router';

import { Exceptions } from '~/components/exceptions';
import { StatusBadge } from '~/routes/runs';
import { getJson } from '~/utils/api';
import { formatTime, reasonText } from '~/utils/format';
import { callout, code, facts } from '~/utils/styles';
import type { RunDetail } from '~/utils/api';

import type { Route } from './+types/run';

// One run: what it did, why it stopped if it did, and every exception it found.

export const clientLoader = async ({ params }: Route.ClientLoaderArgs) => {
  return getJson<RunDetail>(`/runs/${params.runId}`);
};

const Run = ({ loaderData: run }: Route.ComponentProps) => {
  return (
    <>
      <p><Link to="/">← Runs</Link></p>
      <h1>Run #{run.id} <StatusBadge status={run.status} /></h1>

      {run.error && (
        <div className={callout}>
          <strong>{reasonText(run.error.reason)}</strong>
          <div><span className={code}>{JSON.stringify(run.error.details)}</span></div>
        </div>
      )}

      <dl className={facts}>
        <dt>Snapshot</dt>
        <dd>{run.snapshotFile}</dd>
        <dt>Generated at</dt>
        <dd>{formatTime(run.generatedAt, run.timezone)}</dd>
        <dt>Started</dt>
        <dd>{formatTime(run.startedAt, run.timezone)}</dd>
        <dt>Finished</dt>
        <dd>{formatTime(run.finishedAt, run.timezone)}</dd>
        <dt>Units upserted</dt>
        <dd>{run.counts.unitsUpserted}</dd>
        <dt>Residents upserted</dt>
        <dd>{run.counts.residentsUpserted}</dd>
        <dt>Moved in</dt>
        <dd>{run.counts.movedIn}</dd>
        <dt>Moved out</dt>
        <dd>{run.counts.movedOut}</dd>
        <dt>Skipped</dt>
        <dd>{run.counts.skipped}</dd>
        <dt>Flagged</dt>
        <dd>{run.counts.flagged}</dd>
      </dl>

      <h2>Exceptions</h2>
      {run.propertyId && <Exceptions exceptions={[...run.exceptions.data, ...run.exceptions.review]} propertyId={run.propertyId} />}
    </>
  );
};

export default Run;

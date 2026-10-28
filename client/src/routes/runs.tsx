import { Form, Link, useNavigation } from 'react-router';

import { getJson, postJson } from '~/utils/api';
import { formatTime, reasonText } from '~/utils/format';
import { bad, badge, buttons, callout, good, muted, scroll, table, warn } from '~/utils/styles';
import type { RunReport, RunSummary } from '~/utils/api';

import type { Route } from './+types/runs';

// The sync runs view: a button per snapshot, and one row per run with what it did.

export const clientLoader = async () => {
  const [{ snapshots }, { runs }] = await Promise.all([
    getJson<{ snapshots: Array<string> }>('/snapshots'),
    getJson<{ runs: Array<RunSummary> }>('/runs'),
  ]);
  return {
    snapshots,
    runs,
  };
};

export const clientAction = async ({ request }: Route.ClientActionArgs) => {
  const form = await request.formData();
  return postJson<RunReport>('/runs', { snapshot: form.get('snapshot') });
};

export const StatusBadge = ({ status }: { status: RunSummary['status'] }) => {
  const tone = {
    ok: good,
    refused: warn,
    failed: bad,
    running: '',
  }[status];
  return <span className={`${badge} ${tone}`}>{status}</span>;
};

const LastRun = ({ report }: { report: RunReport }) => {
  return (
    <div className={callout}>
      <Link to={`/runs/${report.runId}`}>Run #{report.runId}</Link>
      {' '}
      <StatusBadge status={report.status} />
      {' '}
      {report.error
        ? reasonText(report.error.reason)
        : `${report.counts.movedIn} moved in, ${report.counts.movedOut} moved out, ${report.counts.flagged} flagged, ${report.changes.length} changes recorded.`}
    </div>
  );
};

const Runs = ({ loaderData, actionData }: Route.ComponentProps) => {
  const navigation = useNavigation();
  const running = navigation.state !== 'idle' && navigation.formMethod === 'POST' ? navigation.formData?.get('snapshot') : null;

  return (
    <>
      <h1>Sync runs</h1>

      <h2>Run a snapshot</h2>
      <p className={muted}>Run them in order. Running the same one again is safe and changes nothing. An older one after a newer one is refused.</p>
      <Form method="post" className={buttons}>
        {loaderData.snapshots.map((snapshot) => (
          <button key={snapshot} type="submit" name="snapshot" value={snapshot} disabled={Boolean(running)}>
            {running === snapshot ? `Running ${snapshot}…` : `Run ${snapshot}`}
          </button>
        ))}
      </Form>
      {actionData && <LastRun report={actionData} />}

      <h2>Runs</h2>
      {loaderData.runs.length === 0
        ? <p className={muted}>No runs yet.</p>
        : (
          <div className={scroll}>
            <table className={table}>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Snapshot</th>
                  <th>Generated at</th>
                  <th>Ran at</th>
                  <th>Status</th>
                  <th>Units upserted</th>
                  <th>Residents upserted</th>
                  <th>Moved in</th>
                  <th>Moved out</th>
                  <th>Skipped</th>
                  <th>Flagged</th>
                </tr>
              </thead>
              <tbody>
                {loaderData.runs.map((run) => (
                  <tr key={run.id}>
                    <td><Link to={`/runs/${run.id}`}>#{run.id}</Link></td>
                    <td>{run.snapshotFile}</td>
                    <td>{formatTime(run.generatedAt, run.timezone)}</td>
                    <td>{formatTime(run.startedAt, run.timezone)}</td>
                    <td>
                      <StatusBadge status={run.status} />
                      {run.error && <div className={muted}>{reasonText(run.error.reason)}</div>}
                    </td>
                    <td>{run.counts.unitsUpserted}</td>
                    <td>{run.counts.residentsUpserted}</td>
                    <td>{run.counts.movedIn}</td>
                    <td>{run.counts.movedOut}</td>
                    <td>{run.counts.skipped}</td>
                    <td>{run.counts.flagged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </>
  );
};

export default Runs;

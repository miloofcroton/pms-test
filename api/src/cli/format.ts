import type { RunReport } from '~/modules/sync/runner';

// What the CLI prints about a run.

const COUNT_LABELS = [
  ['unitsUpserted', 'units upserted'],
  ['residentsUpserted', 'residents upserted'],
  ['movedIn', 'moved in'],
  ['movedOut', 'moved out'],
  ['skipped', 'skipped'],
  ['flagged', 'flagged'],
] as const;

const PEOPLE = new Set(['moved_in', 'moved_out', 'flagged_for_review']);

const row = (label: string, value: string | number): string => {
  return `  ${label.padEnd(20)}${value}`;
};

export const formatReport = (report: RunReport, source: string): string => {
  const lines = [`Run ${report.runId} of ${source}: ${report.status}`, ''];
  if (report.error) {
    return [...lines, `  ${report.error.kind} error: ${report.error.reason}`, `  ${JSON.stringify(report.error.details)}`].join('\n');
  }

  lines.push(...COUNT_LABELS.map(([key, label]) => row(label, report.counts[key])));
  if (report.changes.length === 0) {
    return [...lines, '', 'No changes.'].join('\n');
  }

  // Moves and flags concern a person, so each is printed; everything else is summed by kind.
  const people = report.changes.filter((change) => PEOPLE.has(change.kind));
  if (people.length > 0) {
    lines.push('', 'Moves and flags:', ...people.map((change) => {
      const detail = change.kind === 'flagged_for_review' ? change.details.reason : `lease ${change.details.leaseRemoteId}`;
      return row(change.kind.replaceAll('_', ' '), `${change.unitRemoteId}/${change.residentRemoteId}  ${detail}`);
    }));
  }

  const others = new Map<string, number>();
  for (const change of report.changes.filter((candidate) => !PEOPLE.has(candidate.kind))) {
    others.set(change.kind, (others.get(change.kind) ?? 0) + 1);
  }
  if (others.size > 0) {
    lines.push('', 'Other changes:', ...[...others].map(([kind, count]) => row(kind.replaceAll('_', ' '), count)));
  }
  return lines.join('\n');
};

// Calendar days as ISO `YYYY-MM-DD` strings, which compare correctly as plain strings.

/** Today in the property's timezone, taking the snapshot's `generated_at` as now so runs are reproducible. */
export const localToday = (generatedAt: string, timezone: string): string => {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // Read the parts by name, so the result doesn't depend on how the locale orders them.
  const parts = new Map(format.formatToParts(new Date(generatedAt))
    .map((part) => [part.type, part.value]));
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
};

/** The calendar day `days` after `isoDate`, or before it when negative. */
export const addDays = (isoDate: string, days: number): string => {
  // In UTC, which has no daylight saving time, so every day is exactly one day long.
  const [year, month, day] = isoDate.split('-')
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
};

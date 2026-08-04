// Calendar dates picked in the app are stored as UTC midnight, because the app
// writes date-only inputs as new Date('YYYY-MM-DD').toISOString(). Formatting
// those values with the viewer's local time zone shifts them one day earlier
// for anyone west of UTC (a July 30 ride shows as Jul 29). Format the stored
// calendar date in UTC so what the user picked is what every list and detail
// view shows, in every time zone.
const DEFAULT_OPTS: Intl.DateTimeFormatOptions = {
	month: 'short',
	day: 'numeric',
	year: 'numeric'
};

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = DEFAULT_OPTS): string {
	return new Date(iso).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

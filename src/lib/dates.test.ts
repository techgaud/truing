import { describe, it, expect } from 'vitest';
import { formatDate } from './dates';

describe('formatDate', () => {
	// Picked calendar dates are stored as UTC midnight. Formatting them in local
	// time west of UTC rolls them back a day. These assertions pin explicit time
	// zones so the test is deterministic on any runner.
	const stored = '2026-07-30T00:00:00.000Z'; // what a "July 30" date picker stores

	it('would show one day early if formatted in a west-of-UTC local zone (the bug)', () => {
		const local = new Date(stored).toLocaleDateString('en-US', {
			day: 'numeric',
			timeZone: 'America/Los_Angeles'
		});
		expect(local).toBe('29');
	});

	it('formats the stored calendar date in UTC, so the picked day survives', () => {
		const out = formatDate(stored, { month: 'short', day: 'numeric', year: 'numeric' });
		expect(out).toContain('30');
		expect(out).toContain('2026');
	});
});

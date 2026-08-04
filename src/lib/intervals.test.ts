import { describe, it, expect } from 'vitest';
import {
	replacementDistanceMeters,
	replacementTimeDays,
	inspectionTimeDays,
	componentLabel,
	componentTypeLabel,
	timeBasisStart,
	daysSinceTimeBasis,
	timeIntervalFraction
} from './intervals';
import { getNotificationThresholds, findNewThresholdCrossings } from './notifications';
import type { Component } from './db';

function makeComponent(overrides: Partial<Component> = {}): Component {
	return {
		type: 'chain_11sp',
		initial_wear_meters: 0,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		...overrides
	};
}

describe('replacementDistanceMeters', () => {
	it('returns shipped default when no override', () => {
		expect(replacementDistanceMeters(makeComponent())).toBe(4023360);
	});

	it('returns component override when set', () => {
		expect(
			replacementDistanceMeters(
				makeComponent({ replacement_interval_distance_meters_override: 1000000 })
			)
		).toBe(1000000);
	});

	it('returns null for unknown type with no override', () => {
		expect(replacementDistanceMeters(makeComponent({ type: 'nonexistent_type' }))).toBeNull();
	});
});

describe('replacementTimeDays', () => {
	it('returns shipped default', () => {
		expect(replacementTimeDays(makeComponent())).toBe(365);
	});

	it('returns override over default', () => {
		expect(
			replacementTimeDays(makeComponent({ replacement_interval_time_days_override: 180 }))
		).toBe(180);
	});
});

describe('inspectionTimeDays', () => {
	it('returns shipped inspection interval', () => {
		expect(inspectionTimeDays(makeComponent())).toBe(30);
	});

	it('returns null for type without inspection interval', () => {
		expect(inspectionTimeDays(makeComponent({ type: 'derailleur_hanger' }))).toBeNull();
	});
});

describe('componentLabel', () => {
	it('uses component name when set', () => {
		expect(componentLabel(makeComponent({ name: 'My Chain' }))).toBe('My Chain');
	});

	it('falls back to shipped label', () => {
		expect(componentLabel(makeComponent())).toBe('Chain (11-speed)');
	});

	it('falls back to type key for unknown type', () => {
		expect(componentLabel(makeComponent({ type: 'custom_thing' }))).toBe('custom_thing');
	});
});

describe('componentTypeLabel', () => {
	it('returns shipped label', () => {
		expect(componentTypeLabel('chain_11sp')).toBe('Chain (11-speed)');
	});

	it('returns key for unknown type', () => {
		expect(componentTypeLabel('custom_thing')).toBe('custom_thing');
	});
});

describe('time-basis reset on service', () => {
	it('uses the install date when never serviced', () => {
		expect(timeBasisStart('2026-01-01T00:00:00Z', [])).toBe('2026-01-01T00:00:00Z');
	});

	it('advances to the most recent serviced date', () => {
		const basis = timeBasisStart('2026-01-01T00:00:00Z', [
			'2026-02-01T00:00:00Z',
			'2026-05-01T00:00:00Z',
			'2026-03-01T00:00:00Z'
		]);
		expect(basis).toBe('2026-05-01T00:00:00Z');
	});

	it('ignores serviced dates before the install date', () => {
		const basis = timeBasisStart('2026-06-01T00:00:00Z', ['2026-01-01T00:00:00Z']);
		expect(basis).toBe('2026-06-01T00:00:00Z');
	});

	it('measures days elapsed from the reset basis, not the install date', () => {
		const today = '2026-07-01T00:00:00Z';
		// installed 180 days ago, serviced 10 days ago
		const days = daysSinceTimeBasis('2026-01-02T00:00:00Z', ['2026-06-21T00:00:00Z'], today);
		expect(Math.round(days)).toBe(10);
	});

	it('drops a time interval back below its threshold once serviced', () => {
		const today = '2026-07-01T00:00:00Z';
		const installedAt = '2026-01-01T00:00:00Z'; // 181 days ago, past a 90 day interval
		const before = timeIntervalFraction(installedAt, [], 90, today);
		expect(before! > 1).toBe(true);
		const after = timeIntervalFraction(installedAt, ['2026-06-30T00:00:00Z'], 90, today);
		expect(after! < 0.1).toBe(true);
	});
});

// Regression for the re-notify loop: logging 'serviced' clears
// notified_thresholds, so if the time interval had NOT reset the next check
// would see the same overdue urgency and re-fire every alert. With the basis
// reset, a just-serviced time interval crosses no thresholds.
describe('serviced component does not immediately re-notify', () => {
	it('crosses no thresholds right after service', () => {
		const today = '2026-07-01T00:00:00Z';
		const installedAt = '2026-01-01T00:00:00Z';
		const thresholds = getNotificationThresholds(90);

		const overdueFraction = timeIntervalFraction(installedAt, [], 90, today)!;
		const overdueCrossings = findNewThresholdCrossings(overdueFraction * 100, thresholds, []);
		expect(overdueCrossings.length).toBeGreaterThan(0);

		// After service the thresholds are cleared (alreadyNotified = []), but the
		// urgency has reset, so nothing re-fires.
		const servicedFraction = timeIntervalFraction(
			installedAt,
			['2026-06-30T00:00:00Z'],
			90,
			today
		)!;
		const servicedCrossings = findNewThresholdCrossings(servicedFraction * 100, thresholds, []);
		expect(servicedCrossings).toEqual([]);
	});
});

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
	getNotificationThresholds,
	findNewThresholdCrossings,
	clearNotifiedThresholds
} from './notifications';

beforeEach(async () => {
	await db.components.clear();
});

describe('getNotificationThresholds', () => {
	it('returns default thresholds when no custom value', () => {
		expect(getNotificationThresholds(null, 90)).toEqual([90, 95, 99]);
		expect(getNotificationThresholds(undefined, 90)).toEqual([90, 95, 99]);
	});

	it('uses custom threshold as the first level', () => {
		expect(getNotificationThresholds(80, 90)).toEqual([80, 95, 99]);
	});

	it('filters out escalation thresholds below custom', () => {
		expect(getNotificationThresholds(96, 90)).toEqual([96, 99]);
	});

	it('returns single threshold when custom is 99', () => {
		expect(getNotificationThresholds(99, 90)).toEqual([99]);
	});

	it('deduplicates when custom matches an escalation point', () => {
		expect(getNotificationThresholds(95, 90)).toEqual([95, 99]);
	});

	it('uses global default when custom is null', () => {
		expect(getNotificationThresholds(null, 85)).toEqual([85, 95, 99]);
	});
});

describe('findNewThresholdCrossings', () => {
	it('returns empty when below all thresholds', () => {
		expect(findNewThresholdCrossings(50, [90, 95, 99], [])).toEqual([]);
	});

	it('returns crossed thresholds not yet notified', () => {
		expect(findNewThresholdCrossings(92, [90, 95, 99], [])).toEqual([90]);
	});

	it('returns multiple crossings when jumping past several', () => {
		expect(findNewThresholdCrossings(97, [90, 95, 99], [])).toEqual([90, 95]);
	});

	it('returns all three when at 100%', () => {
		expect(findNewThresholdCrossings(100, [90, 95, 99], [])).toEqual([90, 95, 99]);
	});

	it('skips already notified thresholds', () => {
		expect(findNewThresholdCrossings(97, [90, 95, 99], [90])).toEqual([95]);
	});

	it('returns empty when all crossed thresholds already notified', () => {
		expect(findNewThresholdCrossings(97, [90, 95, 99], [90, 95])).toEqual([]);
	});

	it('handles exact threshold boundary', () => {
		expect(findNewThresholdCrossings(90, [90, 95, 99], [])).toEqual([90]);
	});
});

describe('clearNotifiedThresholds', () => {
	it('resets notified_thresholds to empty array', async () => {
		const compId = (await db.components.add({
			type: 'chain_11sp',
			initial_wear_meters: 0,
			notified_thresholds: [90, 95],
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		await clearNotifiedThresholds(compId);
		const comp = await db.components.get(compId);
		expect(comp!.notified_thresholds).toEqual([]);
	});

	it('updates the updated_at timestamp', async () => {
		const compId = (await db.components.add({
			type: 'chain_11sp',
			initial_wear_meters: 0,
			notified_thresholds: [90],
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		await clearNotifiedThresholds(compId);
		const comp = await db.components.get(compId);
		expect(comp!.updated_at).not.toBe('2026-01-01T00:00:00Z');
	});
});

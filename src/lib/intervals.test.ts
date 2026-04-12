import { describe, it, expect } from 'vitest';
import {
	replacementDistanceMeters,
	replacementTimeDays,
	inspectionTimeDays,
	componentLabel,
	componentTypeLabel
} from './intervals';
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

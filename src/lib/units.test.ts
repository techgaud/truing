import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
	loadUnitPreference,
	setUnitPreference,
	getUnitPreference,
	formatDistance,
	formatDistanceInt,
	distanceLabel,
	parseDistanceToMeters,
	metersToDisplayUnit
} from './units';

beforeEach(async () => {
	await db.settings.clear();
	await setUnitPreference('imperial');
});

describe('unit preference', () => {
	it('defaults to imperial', async () => {
		await db.settings.clear();
		await loadUnitPreference();
		expect(getUnitPreference()).toBe('imperial');
	});

	it('persists metric preference', async () => {
		await setUnitPreference('metric');
		expect(getUnitPreference()).toBe('metric');
		await loadUnitPreference();
		expect(getUnitPreference()).toBe('metric');
	});
});

describe('formatDistance', () => {
	it('formats meters as miles in imperial', () => {
		expect(formatDistance(1609.344)).toBe('1.0 mi');
		expect(formatDistance(16093.44)).toBe('10.0 mi');
	});

	it('formats meters as km in metric', async () => {
		await setUnitPreference('metric');
		expect(formatDistance(1000)).toBe('1.0 km');
		expect(formatDistance(10000)).toBe('10.0 km');
	});

	it('handles zero', () => {
		expect(formatDistance(0)).toBe('0.0 mi');
	});
});

describe('formatDistanceInt', () => {
	it('rounds to integer miles', () => {
		expect(formatDistanceInt(16093.44)).toBe('10 mi');
	});

	it('rounds to integer km in metric', async () => {
		await setUnitPreference('metric');
		expect(formatDistanceInt(10500)).toBe('11 km');
	});
});

describe('distanceLabel', () => {
	it('returns miles for imperial', () => {
		expect(distanceLabel()).toBe('miles');
	});

	it('returns km for metric', async () => {
		await setUnitPreference('metric');
		expect(distanceLabel()).toBe('km');
	});
});

describe('parseDistanceToMeters', () => {
	it('converts miles to meters in imperial', () => {
		const meters = parseDistanceToMeters(1);
		expect(meters).toBeCloseTo(1609.344, 1);
	});

	it('converts km to meters in metric', async () => {
		await setUnitPreference('metric');
		expect(parseDistanceToMeters(1)).toBe(1000);
	});
});

describe('metersToDisplayUnit', () => {
	it('converts meters to miles in imperial', () => {
		expect(metersToDisplayUnit(1609.344)).toBeCloseTo(1.0, 3);
	});

	it('converts meters to km in metric', async () => {
		await setUnitPreference('metric');
		expect(metersToDisplayUnit(1000)).toBe(1.0);
	});

	it('round-trips with parseDistanceToMeters', () => {
		const miles = 25;
		const meters = parseDistanceToMeters(miles);
		const back = metersToDisplayUnit(meters);
		expect(back).toBeCloseTo(miles, 5);
	});
});

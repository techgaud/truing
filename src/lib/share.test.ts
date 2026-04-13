import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { setUnitPreference } from './units';
import {
	findCrossedMilestone,
	milestoneText,
	newBikeText,
	retiredBikeText,
	retiredComponentText,
	TIER_1_TYPES,
	TIER_2_TYPES,
	checkBikeMilestone,
	isSpecialMilestone
} from './share';

const MI = 1609.344;

beforeEach(async () => {
	await db.bikes.clear();
	await db.rides.clear();
	await db.settings.clear();
	await setUnitPreference('imperial');
});

describe('findCrossedMilestone', () => {
	it('returns null when no milestone crossed', () => {
		expect(findCrossedMilestone(100 * MI, 200 * MI)).toBeNull();
	});

	it('detects 500 mile milestone', () => {
		expect(findCrossedMilestone(490 * MI, 510 * MI)).toBe(500);
	});

	it('detects 1000 mile milestone', () => {
		expect(findCrossedMilestone(990 * MI, 1010 * MI)).toBe(1000);
	});

	it('returns highest milestone when multiple crossed', () => {
		expect(findCrossedMilestone(40 * MI, 110 * MI)).toBe(100);
	});

	it('detects 100k mile milestone', () => {
		expect(findCrossedMilestone(99990 * MI, 100010 * MI)).toBe(100000);
	});

	it('works with metric', async () => {
		await setUnitPreference('metric');
		expect(findCrossedMilestone(990 * 1000, 1010 * 1000)).toBe(1000);
	});

	it('detects 160k km milestone in metric', async () => {
		await setUnitPreference('metric');
		expect(findCrossedMilestone(159990 * 1000, 160010 * 1000)).toBe(160000);
	});
});

describe('milestoneText', () => {
	it('generates first milestone text', () => {
		const text = milestoneText('Topstone 2', 50);
		expect(text).toContain('50 miles');
		expect(text).toContain('Just getting started');
		expect(text).toContain('Tracked with Truing');
	});

	it('generates normal milestone text', () => {
		const text = milestoneText('Topstone 2', 5000);
		expect(text).toContain('5,000 miles');
		expect(text).toContain('Topstone 2');
		expect(text).not.toContain('Just getting started');
	});

	it('generates 100k special text', () => {
		const text = milestoneText('Old Faithful', 100000);
		expect(text).toContain('100,000 miles');
		expect(text).toContain('Four times around the Earth');
		expect(text).toContain('One bike');
	});

	it('generates metric milestone', async () => {
		await setUnitPreference('metric');
		const text = milestoneText('Topstone 2', 5000);
		expect(text).toContain('5,000 km');
	});

	it('generates 160k km special text', async () => {
		await setUnitPreference('metric');
		const text = milestoneText('Old Faithful', 160000);
		expect(text).toContain('160,000 km');
		expect(text).toContain('Four times around the Earth');
	});
});

describe('newBikeText', () => {
	it('generates basic new bike text', () => {
		const text = newBikeText('Topstone 2');
		expect(text).toContain('New bike day');
		expect(text).toContain('Topstone 2');
	});

	it('includes make/model/year when available', () => {
		const text = newBikeText('Topstone 2', {
			make: 'Cannondale',
			model: 'Topstone 2',
			year: 2025
		});
		expect(text).toContain('2025 Cannondale Topstone 2');
	});
});

describe('retiredBikeText', () => {
	it('generates basic retired text', () => {
		const text = retiredBikeText('Old Bike', 10000 * MI);
		expect(text).toContain('Old Bike');
		expect(text).toContain('retired');
		expect(text).toContain('10,000');
	});

	it('includes years when purchase date provided', () => {
		const twoYearsAgo = new Date(Date.now() - 2.5 * 365.25 * 86_400_000).toISOString();
		const text = retiredBikeText('Old Bike', 10000 * MI, twoYearsAgo);
		expect(text).toContain('2 years');
	});
});

describe('retiredComponentText', () => {
	it('includes cost per mile when price available', () => {
		const text = retiredComponentText('Shimano CN-HG601', 5000 * MI, 2500);
		expect(text).toContain('5,000 miles');
		expect(text).toContain('Shimano CN-HG601');
		expect(text).toContain('c/mi');
	});

	it('shows distance only without price', () => {
		const text = retiredComponentText('Chain', 3000 * MI);
		expect(text).toContain('3,000 miles');
		expect(text).not.toContain('c/mi');
	});

	it('includes bike name when provided', () => {
		const text = retiredComponentText('Chain', 3000 * MI, null, 'Topstone 2');
		expect(text).toContain('Topstone 2');
	});
});

describe('isSpecialMilestone', () => {
	it('100k miles is special in imperial', () => {
		expect(isSpecialMilestone(100000)).toBe(true);
	});

	it('50k miles is not special', () => {
		expect(isSpecialMilestone(50000)).toBe(false);
	});

	it('160k km is special in metric', async () => {
		await setUnitPreference('metric');
		expect(isSpecialMilestone(160000)).toBe(true);
	});
});

describe('checkBikeMilestone', () => {
	it('detects milestone after ride', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Test Bike',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		await db.rides.add({
			bike_id: bikeId,
			started_at: '2026-03-01T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: Math.round(510 * MI),
			conditions: [],
			source: 'manual',
			created_at: '2026-03-01T00:00:00Z',
			updated_at: '2026-03-01T00:00:00Z'
		});

		const result = await checkBikeMilestone(bikeId, Math.round(510 * MI));
		expect(result).not.toBeNull();
		expect(result!.milestone).toBe(500);
		expect(result!.text).toContain('500 miles');
	});

	it('returns null when no milestone crossed', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Test Bike',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		await db.rides.add({
			bike_id: bikeId,
			started_at: '2026-03-01T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: Math.round(30 * MI),
			conditions: [],
			source: 'manual',
			created_at: '2026-03-01T00:00:00Z',
			updated_at: '2026-03-01T00:00:00Z'
		});

		const result = await checkBikeMilestone(bikeId, Math.round(30 * MI));
		expect(result).toBeNull();
	});
});

describe('tier definitions', () => {
	it('tier 1 includes chains, tires, cassettes, brake pads, chainring, frame', () => {
		expect(TIER_1_TYPES).toContain('chain_11sp');
		expect(TIER_1_TYPES).toContain('tire_gravel');
		expect(TIER_1_TYPES).toContain('cassette_12sp');
		expect(TIER_1_TYPES).toContain('disc_pads_hydraulic');
		expect(TIER_1_TYPES).toContain('chainring');
		expect(TIER_1_TYPES).toContain('frame');
	});

	it('tier 2 includes saddle, pedals, cranks, bars', () => {
		expect(TIER_2_TYPES).toContain('saddle');
		expect(TIER_2_TYPES).toContain('pedal_bearings');
		expect(TIER_2_TYPES).toContain('crankset');
		expect(TIER_2_TYPES).toContain('handlebar');
	});

	it('tiers do not overlap', () => {
		for (const t of TIER_1_TYPES) {
			expect(TIER_2_TYPES).not.toContain(t);
		}
	});
});

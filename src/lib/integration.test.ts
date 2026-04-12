import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { componentWear } from './wear';
import { exportAll, importAll } from './backup';

beforeEach(async () => {
	await db.bikes.clear();
	await db.components.clear();
	await db.installations.clear();
	await db.rides.clear();
	await db.service_log.clear();
	await db.custom_component_types.clear();
	await db.settings.clear();
	await db.error_log.clear();
});

describe('archive bike flow', () => {
	it('archives a bike and its components remain intact', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Gravel',
			type: 'gravel',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		const compId = (await db.components.add({
			type: 'chain_11sp',
			initial_wear_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		await db.installations.add({
			component_id: compId,
			bike_id: bikeId,
			installed_at: '2026-01-01T00:00:00Z',
			installed_at_tz: 'UTC',
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		});

		await db.bikes.update(bikeId, {
			archived_at: '2026-06-01T00:00:00Z',
			updated_at: '2026-06-01T00:00:00Z'
		});

		const bike = await db.bikes.get(bikeId);
		expect(bike?.archived_at).toBe('2026-06-01T00:00:00Z');
		const comp = await db.components.get(compId);
		expect(comp).toBeDefined();
		const inst = await db.installations.where({ component_id: compId }).first();
		expect(inst).toBeDefined();
	});
});

describe('component movement between bikes', () => {
	it('accumulates wear across both installations', async () => {
		const bike1 = (await db.bikes.add({
			name: 'Bike 1',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		const bike2 = (await db.bikes.add({
			name: 'Bike 2',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		const compId = (await db.components.add({
			type: 'chain_11sp',
			initial_wear_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		await db.installations.add({
			component_id: compId,
			bike_id: bike1,
			installed_at: '2026-01-01T00:00:00Z',
			installed_at_tz: 'UTC',
			removed_at: '2026-03-01T00:00:00Z',
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-03-01T00:00:00Z'
		});
		await db.installations.add({
			component_id: compId,
			bike_id: bike2,
			installed_at: '2026-03-01T00:00:00Z',
			installed_at_tz: 'UTC',
			created_at: '2026-03-01T00:00:00Z',
			updated_at: '2026-03-01T00:00:00Z'
		});

		await db.rides.add({
			bike_id: bike1,
			started_at: '2026-02-01T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 10000,
			conditions: [],
			source: 'manual',
			created_at: '2026-02-01T00:00:00Z',
			updated_at: '2026-02-01T00:00:00Z'
		});
		await db.rides.add({
			bike_id: bike2,
			started_at: '2026-04-01T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 20000,
			conditions: [],
			source: 'manual',
			created_at: '2026-04-01T00:00:00Z',
			updated_at: '2026-04-01T00:00:00Z'
		});

		expect(await componentWear(compId)).toBe(30000);
	});
});

describe('strava sync dedupe', () => {
	it('skips rides with duplicate external_id', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Bike',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		await db.rides.add({
			bike_id: bikeId,
			started_at: '2026-01-15T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 5000,
			conditions: [],
			source: 'strava',
			external_id: '12345',
			created_at: '2026-01-15T00:00:00Z',
			updated_at: '2026-01-15T00:00:00Z'
		});

		const existing = await db.rides.where({ external_id: '12345' }).first();
		expect(existing).toBeDefined();

		// second insert with same external_id should be detected as duplicate
		const dup = await db.rides.where({ external_id: '12345' }).first();
		expect(dup?.distance_meters).toBe(5000);
		expect(await db.rides.count()).toBe(1);
	});
});

describe('full export/import round-trip', () => {
	it('preserves all data across export → clear → import', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Round Trip Bike',
			type: 'road',
			starting_odometer_meters: 1000,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		const compId = (await db.components.add({
			type: 'chain_11sp',
			name: 'Shimano 105',
			initial_wear_meters: 500,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		await db.installations.add({
			component_id: compId,
			bike_id: bikeId,
			installed_at: '2026-01-01T00:00:00Z',
			installed_at_tz: 'UTC',
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		});
		await db.rides.add({
			bike_id: bikeId,
			started_at: '2026-02-15T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 80000,
			conditions: [],
			source: 'manual',
			created_at: '2026-02-15T00:00:00Z',
			updated_at: '2026-02-15T00:00:00Z'
		});
		await db.service_log.add({
			component_id: compId,
			bike_id: bikeId,
			performed_at: '2026-03-01T00:00:00Z',
			performed_at_tz: 'UTC',
			action: 'serviced',
			notes: 'Cleaned and lubed',
			created_at: '2026-03-01T00:00:00Z',
			updated_at: '2026-03-01T00:00:00Z'
		});

		const json = await exportAll();

		// wipe everything
		await db.bikes.clear();
		await db.components.clear();
		await db.installations.clear();
		await db.rides.clear();
		await db.service_log.clear();
		expect(await db.bikes.count()).toBe(0);

		const result = await importAll(json);
		expect(result.bikes.added).toBe(1);
		expect(result.components.added).toBe(1);
		expect(result.rides.added).toBe(1);
		expect(result.serviceLog.added).toBe(1);

		const bike = await db.bikes.toCollection().first();
		expect(bike?.name).toBe('Round Trip Bike');
		expect(bike?.starting_odometer_meters).toBe(1000);

		const comp = await db.components.toCollection().first();
		expect(comp?.name).toBe('Shimano 105');
		expect(comp?.initial_wear_meters).toBe(500);

		const ride = await db.rides.toCollection().first();
		expect(ride?.distance_meters).toBe(80000);

		const log = await db.service_log.toCollection().first();
		expect(log?.action).toBe('serviced');
		expect(log?.notes).toBe('Cleaned and lubed');

		const inst = await db.installations.toCollection().first();
		expect(inst?.component_id).toBe(compId);
	});
});

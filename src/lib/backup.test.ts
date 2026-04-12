import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { exportAll, importAll } from './backup';

beforeEach(async () => {
	await db.bikes.clear();
	await db.components.clear();
	await db.installations.clear();
	await db.rides.clear();
	await db.service_log.clear();
	await db.custom_component_types.clear();
	await db.settings.clear();
});

describe('export/import round-trip', () => {
	it('exports empty database', async () => {
		const json = await exportAll();
		const data = JSON.parse(json);
		expect(data.schema_version).toBe(1);
		expect(data.bikes).toHaveLength(0);
		expect(data.rides).toHaveLength(0);
	});

	it('round-trips bikes and rides', async () => {
		const bikeId = (await db.bikes.add({
			name: 'Test Bike',
			type: 'gravel',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		await db.rides.add({
			bike_id: bikeId,
			started_at: '2026-01-15T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 50000,
			conditions: [],
			source: 'manual',
			created_at: '2026-01-15T00:00:00Z',
			updated_at: '2026-01-15T00:00:00Z'
		});

		const json = await exportAll();

		await db.bikes.clear();
		await db.rides.clear();
		expect(await db.bikes.count()).toBe(0);

		const counts = await importAll(json);
		expect(counts.bikes).toBe(1);
		expect(counts.rides).toBe(1);

		const bikes = await db.bikes.toArray();
		expect(bikes[0].name).toBe('Test Bike');
		expect(bikes[0].type).toBe('gravel');

		const rides = await db.rides.toArray();
		expect(rides[0].distance_meters).toBe(50000);
	});

	it('rejects invalid backup file', async () => {
		await expect(importAll('{}')).rejects.toThrow('schema_version');
	});

	it('replaces existing data on import', async () => {
		await db.bikes.add({
			name: 'Old Bike',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		});

		const backup = JSON.stringify({
			schema_version: 1,
			bikes: [
				{
					id: 1,
					name: 'New Bike',
					starting_odometer_meters: 0,
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z'
				}
			],
			components: [],
			installations: [],
			rides: [],
			service_log: [],
			custom_component_types: [],
			settings: []
		});

		await importAll(backup);
		const bikes = await db.bikes.toArray();
		expect(bikes).toHaveLength(1);
		expect(bikes[0].name).toBe('New Bike');
	});
});

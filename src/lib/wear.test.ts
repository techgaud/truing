import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { componentWear, rollingAverageMetersPerDay } from './wear';

beforeEach(async () => {
	await db.bikes.clear();
	await db.components.clear();
	await db.installations.clear();
	await db.rides.clear();
});

describe('componentWear', () => {
	it('returns 0 for nonexistent component', async () => {
		expect(await componentWear(999)).toBe(0);
	});

	it('returns initial_wear_meters when no rides exist', async () => {
		const compId = (await db.components.add({
			type: 'chain_11sp',
			initial_wear_meters: 5000,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		const bikeId = (await db.bikes.add({
			name: 'Test',
			starting_odometer_meters: 0,
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

		expect(await componentWear(compId)).toBe(5000);
	});

	it('sums ride distances within installation window', async () => {
		const compId = (await db.components.add({
			type: 'chain_11sp',
			initial_wear_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		const bikeId = (await db.bikes.add({
			name: 'Test',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		await db.installations.add({
			component_id: compId,
			bike_id: bikeId,
			installed_at: '2026-01-15T00:00:00Z',
			installed_at_tz: 'UTC',
			created_at: '2026-01-15T00:00:00Z',
			updated_at: '2026-01-15T00:00:00Z'
		});

		await db.rides.add({
			bike_id: bikeId,
			started_at: '2026-01-10T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 1000,
			conditions: [],
			source: 'manual',
			created_at: '2026-01-10T00:00:00Z',
			updated_at: '2026-01-10T00:00:00Z'
		});
		await db.rides.add({
			bike_id: bikeId,
			started_at: '2026-01-20T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 3000,
			conditions: [],
			source: 'manual',
			created_at: '2026-01-20T00:00:00Z',
			updated_at: '2026-01-20T00:00:00Z'
		});
		await db.rides.add({
			bike_id: bikeId,
			started_at: '2026-02-01T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 2000,
			conditions: [],
			source: 'manual',
			created_at: '2026-02-01T00:00:00Z',
			updated_at: '2026-02-01T00:00:00Z'
		});

		// ride on Jan 10 is BEFORE install on Jan 15, should be excluded
		// rides on Jan 20 and Feb 1 are within window
		expect(await componentWear(compId)).toBe(5000);
	});

	it('accumulates across multiple installations on different bikes', async () => {
		const compId = (await db.components.add({
			type: 'chain_11sp',
			initial_wear_meters: 100,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
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

		await db.installations.add({
			component_id: compId,
			bike_id: bike1,
			installed_at: '2026-01-01T00:00:00Z',
			installed_at_tz: 'UTC',
			removed_at: '2026-02-01T00:00:00Z',
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-02-01T00:00:00Z'
		});
		await db.installations.add({
			component_id: compId,
			bike_id: bike2,
			installed_at: '2026-02-01T00:00:00Z',
			installed_at_tz: 'UTC',
			created_at: '2026-02-01T00:00:00Z',
			updated_at: '2026-02-01T00:00:00Z'
		});

		await db.rides.add({
			bike_id: bike1,
			started_at: '2026-01-15T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 500,
			conditions: [],
			source: 'manual',
			created_at: '2026-01-15T00:00:00Z',
			updated_at: '2026-01-15T00:00:00Z'
		});
		await db.rides.add({
			bike_id: bike2,
			started_at: '2026-02-15T00:00:00Z',
			started_at_tz: 'UTC',
			distance_meters: 700,
			conditions: [],
			source: 'manual',
			created_at: '2026-02-15T00:00:00Z',
			updated_at: '2026-02-15T00:00:00Z'
		});

		// 100 initial + 500 bike1 + 700 bike2 = 1300
		expect(await componentWear(compId)).toBe(1300);
	});
});

describe('rollingAverageMetersPerDay', () => {
	it('returns null with fewer than 2 rides', () => {
		expect(
			rollingAverageMetersPerDay([], '2026-01-01T00:00:00Z', '2026-02-01T00:00:00Z')
		).toBeNull();

		expect(
			rollingAverageMetersPerDay(
				[
					{
						id: 1,
						bike_id: 1,
						started_at: '2026-01-15T00:00:00Z',
						started_at_tz: 'UTC',
						distance_meters: 1000,
						conditions: [],
						source: 'manual',
						created_at: '2026-01-15T00:00:00Z',
						updated_at: '2026-01-15T00:00:00Z'
					}
				],
				'2026-01-01T00:00:00Z',
				'2026-02-01T00:00:00Z'
			)
		).toBeNull();
	});

	it('computes average over the window', () => {
		const rides = [
			{
				id: 1,
				bike_id: 1,
				started_at: '2026-01-20T00:00:00Z',
				started_at_tz: 'UTC',
				distance_meters: 10000,
				conditions: [] as string[],
				source: 'manual' as const,
				created_at: '2026-01-20T00:00:00Z',
				updated_at: '2026-01-20T00:00:00Z'
			},
			{
				id: 2,
				bike_id: 1,
				started_at: '2026-01-25T00:00:00Z',
				started_at_tz: 'UTC',
				distance_meters: 15000,
				conditions: [] as string[],
				source: 'manual' as const,
				created_at: '2026-01-25T00:00:00Z',
				updated_at: '2026-01-25T00:00:00Z'
			}
		];
		const result = rollingAverageMetersPerDay(
			rides,
			'2026-01-01T00:00:00Z',
			'2026-01-31T00:00:00Z',
			30
		);
		expect(result).not.toBeNull();
		// 25000 meters over 30 days = 833.33 m/day
		expect(result!).toBeCloseTo(833.33, 0);
	});
});

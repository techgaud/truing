import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import Dexie from 'dexie';
import fixture from '../../test/fixtures/v0-snapshot.json';

// Synthetic v0 schema: 6 tables, no compound indexes on rides,
// no custom_component_types, settings, or error_log tables.
const V0_STORES = {
	bikes: '++id, name, type',
	components: '++id, type, retired_at',
	installations: '++id, component_id, bike_id, installed_at, removed_at',
	rides: '++id, bike_id, started_at, source',
	service_log: '++id, component_id, bike_id, performed_at, action',
	strava_auth: 'id'
};

// Current v1 schema (matches db.ts)
const V1_STORES = {
	bikes: '++id, name, archived_at, type, strava_gear_id',
	components: '++id, type, retired_at, replaced_by_component_id',
	installations:
		'++id, component_id, bike_id, installed_at, removed_at, [bike_id+removed_at], [component_id+removed_at]',
	rides: '++id, bike_id, started_at, [bike_id+started_at], external_id, source, *conditions',
	service_log:
		'++id, component_id, bike_id, performed_at, action, [bike_id+performed_at], [component_id+performed_at]',
	custom_component_types: 'type',
	strava_auth: 'id',
	settings: 'key',
	error_log: '++id, timestamp, code'
};

let testDb: Dexie;

afterEach(async () => {
	if (testDb?.isOpen()) testDb.close();
	await Dexie.delete('truing-migration-test');
});

async function seedV0(db: Dexie) {
	await db.table('bikes').bulkAdd(fixture.bikes);
	await db.table('components').bulkAdd(fixture.components);
	await db.table('installations').bulkAdd(fixture.installations);
	await db.table('rides').bulkAdd(fixture.rides);
	await db.table('service_log').bulkAdd(fixture.service_log);
}

describe('schema migration v0 → v1', () => {
	it('preserves all existing data after migration', async () => {
		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		await testDb.open();
		await seedV0(testDb);
		testDb.close();

		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		testDb
			.version(2)
			.stores(V1_STORES)
			.upgrade(async (tx) => {
				await tx
					.table('rides')
					.toCollection()
					.modify((ride: Record<string, unknown>) => {
						if (!ride.conditions) ride.conditions = [];
					});
			});
		await testDb.open();

		const bikes = await testDb.table('bikes').toArray();
		expect(bikes).toHaveLength(1);
		expect(bikes[0].name).toBe('Topstone 2');

		const components = await testDb.table('components').toArray();
		expect(components).toHaveLength(2);
		expect(components[0].type).toBe('chain_11sp');

		const installations = await testDb.table('installations').toArray();
		expect(installations).toHaveLength(2);

		const rides = await testDb.table('rides').toArray();
		expect(rides).toHaveLength(3);
		expect(rides[0].distance_meters).toBe(32000);

		const serviceLog = await testDb.table('service_log').toArray();
		expect(serviceLog).toHaveLength(1);
		expect(serviceLog[0].action).toBe('inspected');
	});

	it('adds conditions array to rides missing it', async () => {
		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		await testDb.open();
		await seedV0(testDb);
		testDb.close();

		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		testDb
			.version(2)
			.stores(V1_STORES)
			.upgrade(async (tx) => {
				await tx
					.table('rides')
					.toCollection()
					.modify((ride: Record<string, unknown>) => {
						if (!ride.conditions) ride.conditions = [];
					});
			});
		await testDb.open();

		const rides = await testDb.table('rides').toArray();
		for (const ride of rides) {
			expect(Array.isArray(ride.conditions)).toBe(true);
		}
	});

	it('creates new tables that are queryable after migration', async () => {
		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		await testDb.open();
		await seedV0(testDb);
		testDb.close();

		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		testDb
			.version(2)
			.stores(V1_STORES)
			.upgrade(async (tx) => {
				await tx
					.table('rides')
					.toCollection()
					.modify((ride: Record<string, unknown>) => {
						if (!ride.conditions) ride.conditions = [];
					});
			});
		await testDb.open();

		const settings = await testDb.table('settings').toArray();
		expect(settings).toHaveLength(0);

		await testDb.table('settings').put({
			key: 'test_key',
			value: 42,
			updated_at: new Date().toISOString()
		});
		const setting = await testDb.table('settings').get('test_key');
		expect(setting.value).toBe(42);

		const errorLog = await testDb.table('error_log').toArray();
		expect(errorLog).toHaveLength(0);

		const customTypes = await testDb.table('custom_component_types').toArray();
		expect(customTypes).toHaveLength(0);
	});

	it('compound indexes work after migration', async () => {
		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		await testDb.open();
		await seedV0(testDb);
		testDb.close();

		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		testDb
			.version(2)
			.stores(V1_STORES)
			.upgrade(async (tx) => {
				await tx
					.table('rides')
					.toCollection()
					.modify((ride: Record<string, unknown>) => {
						if (!ride.conditions) ride.conditions = [];
					});
			});
		await testDb.open();

		const rides = await testDb
			.table('rides')
			.where('[bike_id+started_at]')
			.between([1, '2026-03-10T00:00:00Z'], [1, '2026-03-16T00:00:00Z'])
			.toArray();
		expect(rides).toHaveLength(2);
		expect(rides[0].distance_meters).toBe(32000);
		expect(rides[1].distance_meters).toBe(48000);
	});

	it('handles empty database migration', async () => {
		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		await testDb.open();
		testDb.close();

		testDb = new Dexie('truing-migration-test');
		testDb.version(1).stores(V0_STORES);
		testDb
			.version(2)
			.stores(V1_STORES)
			.upgrade(async (tx) => {
				await tx
					.table('rides')
					.toCollection()
					.modify((ride: Record<string, unknown>) => {
						if (!ride.conditions) ride.conditions = [];
					});
			});
		await testDb.open();

		expect(await testDb.table('bikes').count()).toBe(0);
		expect(await testDb.table('settings').count()).toBe(0);
	});
});

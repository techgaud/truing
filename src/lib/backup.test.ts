import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { exportAll, importAll, backupFilename, getLastBackupAge } from './backup';

beforeEach(async () => {
	await db.bikes.clear();
	await db.components.clear();
	await db.installations.clear();
	await db.rides.clear();
	await db.service_log.clear();
	await db.custom_component_types.clear();
	await db.settings.clear();
});

describe('backupFilename', () => {
	it('returns a filename with date and time', () => {
		expect(backupFilename()).toMatch(/^truing-backup-\d{8}-\d{6}\.json$/);
	});
});

describe('export', () => {
	it('includes format, schema_version, checksum', async () => {
		const json = await exportAll();
		const data = JSON.parse(json);
		expect(data.format).toBe('truing-backup');
		expect(data.schema_version).toBe(1);
		expect(data.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
		expect(data.exported_at).toBeTruthy();
	});

	it('records last backup timestamp', async () => {
		await exportAll();
		const days = await getLastBackupAge();
		expect(days).toBe(0);
	});
});

describe('importAll replace mode', () => {
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

		const result = await importAll(json, 'replace');
		expect(result.bikes.added).toBe(1);
		expect(result.rides.added).toBe(1);
		expect(result.mode).toBe('replace');
		expect(await db.bikes.count()).toBe(1);
	});

	it('rejects invalid backup file', async () => {
		await expect(importAll('{}')).rejects.toThrow('schema_version');
	});

	it('rejects corrupted checksum', async () => {
		const json = await exportAll();
		const data = JSON.parse(json);
		data.checksum = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
		await expect(importAll(JSON.stringify(data))).rejects.toThrow('checksum');
	});
});

describe('importAll merge mode', () => {
	it('skips duplicate bikes by name', async () => {
		await db.bikes.add({
			name: 'Gravel Bike',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		});

		const backup = JSON.stringify({
			schema_version: 1,
			bikes: [
				{
					id: 99,
					name: 'Gravel Bike',
					starting_odometer_meters: 0,
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z'
				}
			],
			components: [],
			installations: [],
			rides: [],
			service_log: []
		});

		const result = await importAll(backup, 'merge');
		expect(result.bikes.skipped).toBe(1);
		expect(result.bikes.added).toBe(0);
		expect(await db.bikes.count()).toBe(1);
	});

	it('skips duplicate rides by external_id', async () => {
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
			external_id: 'strava_123',
			created_at: '2026-01-15T00:00:00Z',
			updated_at: '2026-01-15T00:00:00Z'
		});

		const backup = JSON.stringify({
			schema_version: 1,
			bikes: [],
			components: [],
			installations: [],
			rides: [
				{
					bike_id: bikeId,
					started_at: '2026-01-15T00:00:00Z',
					started_at_tz: 'UTC',
					distance_meters: 5000,
					conditions: [],
					source: 'strava',
					external_id: 'strava_123',
					created_at: '2026-01-15T00:00:00Z',
					updated_at: '2026-01-15T00:00:00Z'
				}
			],
			service_log: []
		});

		const result = await importAll(backup, 'merge');
		expect(result.rides.skipped).toBe(1);
		expect(result.rides.added).toBe(0);
		expect(await db.rides.count()).toBe(1);
	});

	it('merges a second-device backup whose primary keys collide, remapping ids', async () => {
		// Local database already occupies ids 1 for a bike, component, and
		// installation. A backup from another device carries its OWN id 1s.
		const localBikeId = (await db.bikes.add({
			name: 'Local Bike',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		const localCompId = (await db.components.add({
			type: 'chain_11sp',
			initial_wear_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;
		await db.installations.add({
			component_id: localCompId,
			bike_id: localBikeId,
			installed_at: '2026-01-01T00:00:00Z',
			installed_at_tz: 'UTC',
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		});

		const backup = JSON.stringify({
			schema_version: 1,
			bikes: [
				{
					id: 1,
					name: 'Road Bike',
					starting_odometer_meters: 0,
					created_at: '2026-02-01T00:00:00Z',
					updated_at: '2026-02-01T00:00:00Z'
				}
			],
			components: [
				{
					id: 1,
					type: 'chain_12sp',
					initial_wear_meters: 0,
					created_at: '2026-02-01T00:00:00Z',
					updated_at: '2026-02-01T00:00:00Z'
				}
			],
			installations: [
				{
					id: 1,
					component_id: 1,
					bike_id: 1,
					installed_at: '2026-02-01T00:00:00Z',
					installed_at_tz: 'UTC',
					created_at: '2026-02-01T00:00:00Z',
					updated_at: '2026-02-01T00:00:00Z'
				}
			],
			rides: [
				{
					id: 1,
					bike_id: 1,
					started_at: '2026-02-10T00:00:00Z',
					started_at_tz: 'UTC',
					distance_meters: 40000,
					conditions: [],
					source: 'manual',
					created_at: '2026-02-10T00:00:00Z',
					updated_at: '2026-02-10T00:00:00Z'
				}
			],
			service_log: []
		});

		// Before the id remap this threw a ConstraintError and aborted the whole
		// merge. It must now complete and add everything.
		const result = await importAll(backup, 'merge');
		expect(result.bikes.added).toBe(1);
		expect(result.components.added).toBe(1);
		expect(result.rides.added).toBe(1);
		expect(await db.bikes.count()).toBe(2);
		expect(await db.installations.count()).toBe(2);

		// The imported ride and installation follow the imported bike/component,
		// not the local id-1 rows.
		const roadBike = await db.bikes.where({ name: 'Road Bike' }).first();
		expect(roadBike?.id).toBeDefined();
		const importedRides = await db.rides.where({ bike_id: roadBike!.id! }).toArray();
		expect(importedRides).toHaveLength(1);
		const importedInstalls = await db.installations.where({ bike_id: roadBike!.id! }).toArray();
		expect(importedInstalls).toHaveLength(1);
		expect(importedInstalls[0]!.component_id).not.toBe(localCompId);
	});

	it('remaps rides onto a name-matched existing bike', async () => {
		const localBikeId = (await db.bikes.add({
			name: 'Commuter',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		})) as number;

		// Backup's bike uses a different id (7) but the same name, so it dedupes.
		// Its ride references bike_id 7 and must land on the local Commuter.
		const backup = JSON.stringify({
			schema_version: 1,
			bikes: [
				{
					id: 7,
					name: 'Commuter',
					starting_odometer_meters: 0,
					created_at: '2026-01-01T00:00:00Z',
					updated_at: '2026-01-01T00:00:00Z'
				}
			],
			components: [],
			installations: [],
			rides: [
				{
					id: 3,
					bike_id: 7,
					started_at: '2026-04-01T00:00:00Z',
					started_at_tz: 'UTC',
					distance_meters: 12000,
					conditions: [],
					source: 'manual',
					created_at: '2026-04-01T00:00:00Z',
					updated_at: '2026-04-01T00:00:00Z'
				}
			],
			service_log: []
		});

		const result = await importAll(backup, 'merge');
		expect(result.bikes.skipped).toBe(1);
		expect(result.rides.added).toBe(1);
		const rides = await db.rides.where({ bike_id: localBikeId }).toArray();
		expect(rides).toHaveLength(1);
	});

	it('adds new rides that do not match existing', async () => {
		const backup = JSON.stringify({
			schema_version: 1,
			bikes: [],
			components: [],
			installations: [],
			rides: [
				{
					bike_id: 1,
					started_at: '2026-03-01T00:00:00Z',
					started_at_tz: 'UTC',
					distance_meters: 30000,
					conditions: [],
					source: 'manual',
					created_at: '2026-03-01T00:00:00Z',
					updated_at: '2026-03-01T00:00:00Z'
				}
			],
			service_log: []
		});

		const result = await importAll(backup, 'merge');
		expect(result.rides.added).toBe(1);
		expect(await db.rides.count()).toBe(1);
	});
});

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

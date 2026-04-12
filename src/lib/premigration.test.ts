import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { verifyPostMigration } from './premigration';

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

describe('verifyPostMigration', () => {
	it('returns true when all tables are accessible', async () => {
		expect(await verifyPostMigration()).toBe(true);
	});

	it('returns true with populated tables', async () => {
		await db.bikes.add({
			name: 'Test',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		});
		await db.settings.put({
			key: 'test',
			value: 42,
			updated_at: '2026-01-01T00:00:00Z'
		});
		expect(await verifyPostMigration()).toBe(true);
	});
});

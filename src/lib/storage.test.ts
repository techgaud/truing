// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { checkStorage, writeCanary, startFresh } from './storage';

beforeEach(async () => {
	await db.settings.clear();
	await db.bikes.clear();
	await db.components.clear();
	await db.installations.clear();
	await db.rides.clear();
	await db.service_log.clear();
	localStorage.clear();
});

describe('checkStorage', () => {
	it('returns first_run and writes canary on fresh state', async () => {
		expect(await checkStorage()).toBe('first_run');
		const canary = await db.settings.get('_canary');
		expect(canary?.value).toBe('truing-v1-canary');
		expect(localStorage.getItem('truing_has_data')).toBe('true');
	});

	it('returns ok when canary exists', async () => {
		await writeCanary();
		expect(await checkStorage()).toBe('ok');
	});

	it('returns evicted when localStorage marker exists but canary is gone', async () => {
		localStorage.setItem('truing_has_data', 'true');
		expect(await checkStorage()).toBe('evicted');
	});
});

describe('startFresh', () => {
	it('clears all tables and rewrites canary', async () => {
		await db.bikes.add({
			name: 'Old',
			starting_odometer_meters: 0,
			created_at: '2026-01-01T00:00:00Z',
			updated_at: '2026-01-01T00:00:00Z'
		});
		expect(await db.bikes.count()).toBe(1);

		await startFresh();

		expect(await db.bikes.count()).toBe(0);
		const canary = await db.settings.get('_canary');
		expect(canary?.value).toBe('truing-v1-canary');
	});
});

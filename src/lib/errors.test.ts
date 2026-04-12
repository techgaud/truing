import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { TruingError, ERR, logError } from './errors';

beforeEach(async () => {
	await db.error_log.clear();
});

describe('TruingError', () => {
	it('constructs with code and message', () => {
		expect(() => {
			const err = new TruingError('E1001');
			expect(err.code).toBe('E1001');
			expect(err.message).toBe('E1001: Dexie failed to open database');
			expect(err.name).toBe('TruingError');
		}).not.toThrow();
	});

	it('accepts optional context', () => {
		expect(() => {
			const err = new TruingError('E1005', { url: 'https://strava.com' });
			expect(err.context?.url).toBe('https://strava.com');
		}).not.toThrow();
	});
});

describe('ERR', () => {
	it('has sequential codes that are never empty', () => {
		expect(() => {
			for (const [code, message] of Object.entries(ERR)) {
				expect(code).toMatch(/^E\d{4}$/);
				expect(message.length).toBeGreaterThan(0);
			}
		}).not.toThrow();
	});
});

describe('logError', () => {
	it('writes to error_log table', async () => {
		expect(await db.error_log.count()).toBe(0);
		await logError('E1001', 'test error');
		expect(await db.error_log.count()).toBe(1);
		const entry = await db.error_log.toCollection().first();
		expect(entry?.code).toBe('E1001');
		expect(entry?.message).toBe('test error');
	});

	it('ring-buffers at 50 entries', async () => {
		expect(await db.error_log.count()).toBe(0);
		for (let i = 0; i < 55; i++) {
			await logError('E1001', `error ${i}`);
		}
		expect(await db.error_log.count()).toBe(50);
	});
});

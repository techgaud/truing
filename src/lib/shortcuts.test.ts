// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import { setShortcutMode, getShortcutMode, loadShortcutMode } from './shortcuts';

beforeEach(async () => {
	await db.settings.clear();
});

describe('shortcut mode persistence', () => {
	it('defaults to none', async () => {
		await loadShortcutMode();
		expect(getShortcutMode()).toBe('none');
	});

	it('persists gmail mode', async () => {
		await setShortcutMode('gmail');
		expect(getShortcutMode()).toBe('gmail');
		const setting = await db.settings.get('keyboard_shortcut_mode');
		expect(setting?.value).toBe('gmail');
	});

	it('persists vim mode', async () => {
		await setShortcutMode('vim');
		expect(getShortcutMode()).toBe('vim');
	});

	it('loads persisted mode from db', async () => {
		await db.settings.put({
			key: 'keyboard_shortcut_mode',
			value: 'vim',
			updated_at: new Date().toISOString()
		});
		await loadShortcutMode();
		expect(getShortcutMode()).toBe('vim');
	});
});

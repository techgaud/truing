import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { toast, toasts, dismiss } from './toast';

beforeEach(() => {
	vi.useFakeTimers();
	const current = get(toasts);
	for (const t of current) dismiss(t.id);
});

afterEach(() => {
	vi.useRealTimers();
});

describe('toast', () => {
	it('adds a success toast', () => {
		toast.success('Saved.');
		const all = get(toasts);
		expect(all).toHaveLength(1);
		expect(all[0]?.type).toBe('success');
		expect(all[0]?.message).toBe('Saved.');
		expect(all[0]?.duration).toBe(4000);
	});

	it('adds an error toast with 8s duration', () => {
		toast.error('Something broke.');
		const all = get(toasts);
		expect(all).toHaveLength(1);
		expect(all[0]?.type).toBe('error');
		expect(all[0]?.duration).toBe(8000);
	});

	it('adds a warning toast with 6s duration', () => {
		toast.warning('Watch out.');
		const all = get(toasts);
		expect(all).toHaveLength(1);
		expect(all[0]?.type).toBe('warning');
		expect(all[0]?.duration).toBe(6000);
	});

	it('adds an info toast with 4s duration', () => {
		toast.info('FYI.');
		const all = get(toasts);
		expect(all).toHaveLength(1);
		expect(all[0]?.type).toBe('info');
		expect(all[0]?.duration).toBe(4000);
	});

	it('queues multiple toasts', () => {
		toast.success('One');
		toast.error('Two');
		toast.info('Three');
		expect(get(toasts)).toHaveLength(3);
	});

	it('auto-dismisses after duration', () => {
		toast.success('Gone soon.');
		expect(get(toasts)).toHaveLength(1);
		vi.advanceTimersByTime(4000);
		expect(get(toasts)).toHaveLength(0);
	});

	it('dismiss removes a specific toast', () => {
		const id = toast.success('Keep');
		toast.error('Remove me');
		const all = get(toasts);
		expect(all).toHaveLength(2);
		const second = all[1];
		expect(second).toBeDefined();
		if (second) dismiss(second.id);
		const remaining = get(toasts);
		expect(remaining).toHaveLength(1);
		expect(remaining[0]?.id).toBe(id);
	});

	it('supports action on toast', () => {
		const action = { label: 'Undo', onclick: vi.fn() };
		toast.success('Deleted.', action);
		const all = get(toasts);
		expect(all[0]?.action).toBeDefined();
		expect(all[0]?.action?.label).toBe('Undo');
	});
});

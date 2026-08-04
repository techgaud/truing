import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
	id: number;
	type: ToastType;
	message: string;
	duration: number;
	action?: { label: string; onclick: () => void } | undefined;
};

let nextId = 0;

const { subscribe, update } = writable<Toast[]>([]);

export const toasts = { subscribe };

function add(type: ToastType, message: string, duration = 4000, action?: Toast['action']) {
	const id = nextId++;
	update((all) => [...all, { id, type, message, duration, action }]);
	if (duration > 0) {
		setTimeout(() => dismiss(id), duration);
	}
	return id;
}

export function dismiss(id: number) {
	update((all) => all.filter((t) => t.id !== id));
}

export const toast = {
	success: (message: string, action?: Toast['action']) => add('success', message, 4000, action),
	error: (message: string, action?: Toast['action']) => add('error', message, 8000, action),
	warning: (message: string, action?: Toast['action']) => add('warning', message, 6000, action),
	info: (message: string, action?: Toast['action']) => add('info', message, 4000, action)
};

import { db } from './db';

const CANARY_KEY = '_canary';
const CANARY_VALUE = 'truing-v1-canary';
const LOCAL_MARKER = 'truing_has_data';

export type StorageCheckResult = 'ok' | 'first_run' | 'evicted';

export async function checkStorage(): Promise<StorageCheckResult> {
	const hadData = localStorage.getItem(LOCAL_MARKER) === 'true';
	const canary = await db.settings.get(CANARY_KEY);

	if (canary?.value === CANARY_VALUE) return 'ok';

	if (hadData) return 'evicted';

	await writeCanary();
	return 'first_run';
}

export async function writeCanary(): Promise<void> {
	await db.settings.put({
		key: CANARY_KEY,
		value: CANARY_VALUE,
		updated_at: new Date().toISOString()
	});
	localStorage.setItem(LOCAL_MARKER, 'true');
}

export async function requestPersist(): Promise<boolean> {
	if (navigator.storage?.persist) {
		return navigator.storage.persist();
	}
	return false;
}

export type StorageEstimate = {
	usageBytes: number;
	quotaBytes: number;
	usagePercent: number;
	persisted: boolean;
};

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
	if (!navigator.storage?.estimate) return null;
	const est = await navigator.storage.estimate();
	const usage = est.usage ?? 0;
	const quota = est.quota ?? 1;
	const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
	return {
		usageBytes: usage,
		quotaBytes: quota,
		usagePercent: Math.round((usage / quota) * 100),
		persisted
	};
}

export async function startFresh(): Promise<void> {
	await db.transaction(
		'rw',
		[
			db.bikes,
			db.components,
			db.installations,
			db.rides,
			db.service_log,
			db.custom_component_types,
			db.settings,
			db.error_log
		],
		async () => {
			await db.bikes.clear();
			await db.components.clear();
			await db.installations.clear();
			await db.rides.clear();
			await db.service_log.clear();
			await db.custom_component_types.clear();
			await db.settings.clear();
			await db.error_log.clear();
		}
	);
	await writeCanary();
}

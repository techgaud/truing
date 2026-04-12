const BACKUP_DB = 'truing_premigration';
const MAIN_DB = 'truing';
const BACKUP_TABLES = [
	'bikes',
	'components',
	'installations',
	'rides',
	'service_log',
	'custom_component_types',
	'settings'
];

function openRaw(name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(name);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function getAllFromStore(tx: IDBTransaction, storeName: string): Promise<unknown[]> {
	return new Promise((resolve, reject) => {
		const req = tx.objectStore(storeName).getAll();
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function deleteDatabase(name: string): Promise<void> {
	return new Promise((resolve) => {
		const req = indexedDB.deleteDatabase(name);
		req.onsuccess = () => resolve();
		req.onerror = () => resolve();
	});
}

function putInStore(dbName: string, storeName: string, value: string, key: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(dbName, 1);
		req.onupgradeneeded = () => {
			const idb = req.result;
			if (!idb.objectStoreNames.contains(storeName)) {
				idb.createObjectStore(storeName);
			}
		};
		req.onsuccess = () => {
			const idb = req.result;
			const tx = idb.transaction(storeName, 'readwrite');
			tx.objectStore(storeName).put(value, key);
			tx.oncomplete = () => {
				idb.close();
				resolve();
			};
			tx.onerror = () => {
				idb.close();
				reject(tx.error);
			};
		};
		req.onerror = () => reject(req.error);
	});
}

export async function ensurePremigrationBackup(): Promise<void> {
	if (typeof indexedDB === 'undefined') return;
	if (!indexedDB.databases) return;

	const databases = await indexedDB.databases();
	const existing = databases.find((d) => d.name === MAIN_DB);
	if (!existing?.version) return;

	const { db } = await import('./db');
	const expectedIdbVersion = db.verno * 10;
	if (existing.version >= expectedIdbVersion) return;

	try {
		const idb = await openRaw(MAIN_DB);
		const available = Array.from(idb.objectStoreNames);
		const stores = BACKUP_TABLES.filter((s) => available.includes(s));

		if (stores.length === 0) {
			idb.close();
			return;
		}

		const tx = idb.transaction(stores, 'readonly');
		const data: Record<string, unknown[]> = {};
		for (const name of stores) {
			data[name] = await getAllFromStore(tx, name);
		}
		idb.close();

		if (data.settings) {
			data.settings = (data.settings as Array<{ key: string }>).filter(
				(s) => !s.key.startsWith('_')
			);
		}

		const backup = JSON.stringify(
			{
				format: 'truing-backup',
				schema_version: 1,
				app_version: 'premigration',
				exported_at: new Date().toISOString(),
				premigration: true,
				from_idb_version: existing.version,
				to_idb_version: expectedIdbVersion,
				bikes: data.bikes ?? [],
				components: data.components ?? [],
				installations: data.installations ?? [],
				rides: data.rides ?? [],
				service_log: data.service_log ?? [],
				custom_component_types: data.custom_component_types ?? [],
				settings: data.settings ?? []
			},
			(_key, value) => (value instanceof Blob ? undefined : value)
		);

		await deleteDatabase(BACKUP_DB);
		await putInStore(BACKUP_DB, 'backup', backup, 'latest');
	} catch {
		// backup is best-effort
	}
}

export async function getPremigrationBackup(): Promise<{
	json: string;
	exportedAt: string;
	fromVersion: number;
	toVersion: number;
} | null> {
	if (typeof indexedDB === 'undefined') return null;
	if (!indexedDB.databases) return null;

	const databases = await indexedDB.databases();
	if (!databases.find((d) => d.name === BACKUP_DB)) return null;

	try {
		const idb = await openRaw(BACKUP_DB);
		if (!idb.objectStoreNames.contains('backup')) {
			idb.close();
			return null;
		}
		const tx = idb.transaction('backup', 'readonly');
		const result = await new Promise<string | undefined>((resolve, reject) => {
			const req = tx.objectStore('backup').get('latest');
			req.onsuccess = () => resolve(req.result as string | undefined);
			req.onerror = () => reject(req.error);
		});
		idb.close();

		if (!result) return null;

		const parsed = JSON.parse(result);
		return {
			json: result,
			exportedAt: parsed.exported_at,
			fromVersion: parsed.from_idb_version / 10,
			toVersion: parsed.to_idb_version / 10
		};
	} catch {
		return null;
	}
}

export async function clearPremigrationBackup(): Promise<void> {
	await deleteDatabase(BACKUP_DB);
}

export async function verifyPostMigration(): Promise<boolean> {
	try {
		const { db } = await import('./db');
		await Promise.all([
			db.bikes.count(),
			db.components.count(),
			db.installations.count(),
			db.rides.count(),
			db.service_log.count(),
			db.custom_component_types.count(),
			db.settings.count(),
			db.strava_auth.count(),
			db.error_log.count()
		]);
		return true;
	} catch {
		return false;
	}
}

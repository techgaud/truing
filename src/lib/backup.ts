import { db, type Bike, type Ride, type Component, type ServiceLogEntry } from './db';

async function sha256(text: string): Promise<string> {
	const buffer = new TextEncoder().encode(text);
	const hash = await crypto.subtle.digest('SHA-256', buffer);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export function backupFilename(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
	const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	return `truing-backup-${date}-${time}.json`;
}

export async function exportAll(): Promise<string> {
	const [bikes, components, installations, rides, serviceLog, customTypes, settings] =
		await Promise.all([
			db.bikes.toArray(),
			db.components.toArray(),
			db.installations.toArray(),
			db.rides.toArray(),
			db.service_log.toArray(),
			db.custom_component_types.toArray(),
			db.settings.toArray()
		]);

	const payload = JSON.stringify(
		{
			format: 'truing-backup',
			schema_version: 1,
			app_version: '0.0.1',
			exported_at: new Date().toISOString(),
			bikes,
			components,
			installations,
			rides,
			service_log: serviceLog,
			custom_component_types: customTypes,
			settings: settings.filter((s) => !s.key.startsWith('_'))
		},
		(_key, value) => (value instanceof Blob ? undefined : value)
	);

	const checksum = await sha256(payload);
	const data = JSON.parse(payload);
	data.checksum = `sha256:${checksum}`;

	await db.settings.put({
		key: '_last_backup_at',
		value: new Date().toISOString(),
		updated_at: new Date().toISOString()
	});

	return JSON.stringify(data, null, '\t');
}

export type ImportResult = {
	bikes: { added: number; skipped: number };
	components: { added: number; skipped: number };
	rides: { added: number; skipped: number };
	serviceLog: { added: number; skipped: number };
	mode: 'replace' | 'merge';
};

export async function importAll(
	json: string,
	mode: 'replace' | 'merge' = 'replace'
): Promise<ImportResult> {
	const data = JSON.parse(json);
	if (!data.schema_version) throw new Error('Invalid backup file. Missing schema_version.');

	if (data.checksum) {
		const claimed = data.checksum;
		const copy = { ...data };
		delete copy.checksum;
		const payload = JSON.stringify(copy);
		const actual = `sha256:${await sha256(payload)}`;
		if (claimed !== actual)
			throw new Error('Backup file checksum mismatch. File may be corrupted.');
	}

	if (mode === 'replace') {
		return importReplace(data);
	}
	return importMerge(data);
}

async function importReplace(data: Record<string, unknown>): Promise<ImportResult> {
	const bikes = (data.bikes as Bike[]) ?? [];
	const components = (data.components as Component[]) ?? [];
	const installations = (data.installations as unknown[]) ?? [];
	const rides = (data.rides as Ride[]) ?? [];
	const serviceLog = (data.service_log as ServiceLogEntry[]) ?? [];
	const customTypes = (data.custom_component_types as unknown[]) ?? [];
	const settings = (data.settings as unknown[]) ?? [];

	await db.transaction(
		'rw',
		[
			db.bikes,
			db.components,
			db.installations,
			db.rides,
			db.service_log,
			db.custom_component_types,
			db.settings
		],
		async () => {
			await db.bikes.clear();
			await db.components.clear();
			await db.installations.clear();
			await db.rides.clear();
			await db.service_log.clear();
			await db.custom_component_types.clear();
			const canary = await db.settings.get('_canary');
			await db.settings.clear();
			if (canary) await db.settings.put(canary);

			if (bikes.length) await db.bikes.bulkAdd(bikes);
			if (components.length) await db.components.bulkAdd(components);
			if (installations.length) await db.installations.bulkAdd(installations as never[]);
			if (rides.length) await db.rides.bulkAdd(rides);
			if (serviceLog.length) await db.service_log.bulkAdd(serviceLog);
			if (customTypes.length) await db.custom_component_types.bulkAdd(customTypes as never[]);
			if (settings.length) await db.settings.bulkAdd(settings as never[]);
		}
	);

	return {
		bikes: { added: bikes.length, skipped: 0 },
		components: { added: components.length, skipped: 0 },
		rides: { added: rides.length, skipped: 0 },
		serviceLog: { added: serviceLog.length, skipped: 0 },
		mode: 'replace'
	};
}

async function importMerge(data: Record<string, unknown>): Promise<ImportResult> {
	const result: ImportResult = {
		bikes: { added: 0, skipped: 0 },
		components: { added: 0, skipped: 0 },
		rides: { added: 0, skipped: 0 },
		serviceLog: { added: 0, skipped: 0 },
		mode: 'merge'
	};

	const importBikes = (data.bikes as Bike[]) ?? [];
	const importComponents = (data.components as Component[]) ?? [];
	const importInstallations = (data.installations as unknown[]) ?? [];
	const importRides = (data.rides as Ride[]) ?? [];
	const importServiceLog = (data.service_log as ServiceLogEntry[]) ?? [];

	await db.transaction(
		'rw',
		[db.bikes, db.components, db.installations, db.rides, db.service_log],
		async () => {
			const existingBikes = await db.bikes.toArray();

			for (const bike of importBikes) {
				const match = existingBikes.find((b) => b.name.toLowerCase() === bike.name.toLowerCase());
				if (match) {
					result.bikes.skipped++;
				} else {
					await db.bikes.add(bike);
					result.bikes.added++;
				}
			}

			for (const ride of importRides) {
				if (ride.external_id) {
					const existing = await db.rides.where({ external_id: ride.external_id }).first();
					if (existing) {
						result.rides.skipped++;
						continue;
					}
				} else {
					const sameDay = await db.rides
						.where({ bike_id: ride.bike_id })
						.filter(
							(r) =>
								r.started_at.slice(0, 10) === ride.started_at.slice(0, 10) &&
								Math.abs(r.distance_meters - ride.distance_meters) /
									Math.max(r.distance_meters, 1) <
									0.05
						)
						.first();
					if (sameDay) {
						result.rides.skipped++;
						continue;
					}
				}
				await db.rides.add(ride);
				result.rides.added++;
			}

			for (const entry of importServiceLog) {
				const existing = await db.service_log
					.where({ component_id: entry.component_id })
					.filter(
						(s) =>
							s.performed_at.slice(0, 10) === entry.performed_at.slice(0, 10) &&
							s.action === entry.action
					)
					.first();
				if (existing) {
					result.serviceLog.skipped++;
				} else {
					await db.service_log.add(entry);
					result.serviceLog.added++;
				}
			}

			for (const comp of importComponents) {
				result.components.added++;
				await db.components.add(comp);
			}

			for (const inst of importInstallations) {
				await db.installations.add(inst as never);
			}
		}
	);

	return result;
}

export async function getLastBackupAge(): Promise<number | null> {
	const setting = await db.settings.get('_last_backup_at');
	if (!setting?.value || typeof setting.value !== 'string') return null;
	const ms = Date.now() - Date.parse(setting.value);
	return Math.floor(ms / 86_400_000);
}

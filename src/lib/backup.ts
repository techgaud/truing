import {
	db,
	type Bike,
	type Ride,
	type Component,
	type ServiceLogEntry,
	type Installation,
	type CustomComponentType,
	type Setting
} from './db';
import { APP_VERSION } from './version';

// Drop a record's own primary key so Dexie assigns a fresh one on add. Reusing
// the exported key across databases either collides (ConstraintError) or
// silently overwrites an unrelated local row.
function withoutId<T extends { id?: number }>(record: T): T {
	const copy = { ...record };
	delete copy.id;
	return copy;
}

// Parse, don't validate. A backup file is untrusted input, so every record
// passes a shape check at the door and a malformed one is skipped and counted
// rather than cast blindly and bulk-added. The check covers the required and
// identity fields (the ones the rest of the app trusts); a passing record keeps
// all of its fields so a restore stays faithful.
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

type Validator = (r: Record<string, unknown>) => boolean;

const isBike: Validator = (r) =>
	isStr(r.name) && isNum(r.starting_odometer_meters) && isStr(r.created_at) && isStr(r.updated_at);
const isComponent: Validator = (r) =>
	isStr(r.type) && isNum(r.initial_wear_meters) && isStr(r.created_at) && isStr(r.updated_at);
const isInstallation: Validator = (r) =>
	isNum(r.component_id) &&
	isNum(r.bike_id) &&
	isStr(r.installed_at) &&
	isStr(r.installed_at_tz) &&
	isStr(r.created_at) &&
	isStr(r.updated_at);
const isRide: Validator = (r) =>
	isNum(r.bike_id) &&
	isStr(r.started_at) &&
	isStr(r.started_at_tz) &&
	isNum(r.distance_meters) &&
	Array.isArray(r.conditions) &&
	isStr(r.source) &&
	isStr(r.created_at) &&
	isStr(r.updated_at);
const isServiceLogEntry: Validator = (r) =>
	isNum(r.component_id) &&
	isNum(r.bike_id) &&
	isStr(r.performed_at) &&
	isStr(r.performed_at_tz) &&
	isStr(r.action) &&
	isStr(r.created_at) &&
	isStr(r.updated_at);
const isCustomType: Validator = (r) =>
	isStr(r.type) &&
	isStr(r.label) &&
	isStr(r.category) &&
	isStr(r.created_at) &&
	isStr(r.updated_at);
const isSetting: Validator = (r) => isStr(r.key) && isStr(r.updated_at);

type Parsed<T> = { valid: T[]; skipped: number };

function parseRecords<T>(raw: unknown, isValid: Validator): Parsed<T> {
	const items = Array.isArray(raw) ? raw : [];
	const valid: T[] = [];
	let skipped = 0;
	for (const item of items) {
		if (item && typeof item === 'object' && isValid(item as Record<string, unknown>)) {
			valid.push(item as T);
		} else {
			skipped++;
		}
	}
	return { valid, skipped };
}

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
			app_version: APP_VERSION,
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
	const bikes = parseRecords<Bike>(data.bikes, isBike);
	const components = parseRecords<Component>(data.components, isComponent);
	const installations = parseRecords<Installation>(data.installations, isInstallation);
	const rides = parseRecords<Ride>(data.rides, isRide);
	const serviceLog = parseRecords<ServiceLogEntry>(data.service_log, isServiceLogEntry);
	const customTypes = parseRecords<CustomComponentType>(data.custom_component_types, isCustomType);
	const settings = parseRecords<Setting>(data.settings, isSetting);

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

			if (bikes.valid.length) await db.bikes.bulkAdd(bikes.valid);
			if (components.valid.length) await db.components.bulkAdd(components.valid);
			if (installations.valid.length) await db.installations.bulkAdd(installations.valid);
			if (rides.valid.length) await db.rides.bulkAdd(rides.valid);
			if (serviceLog.valid.length) await db.service_log.bulkAdd(serviceLog.valid);
			if (customTypes.valid.length) await db.custom_component_types.bulkAdd(customTypes.valid);
			if (settings.valid.length) await db.settings.bulkAdd(settings.valid);
		}
	);

	return {
		bikes: { added: bikes.valid.length, skipped: bikes.skipped },
		components: { added: components.valid.length, skipped: components.skipped },
		rides: { added: rides.valid.length, skipped: rides.skipped },
		serviceLog: { added: serviceLog.valid.length, skipped: serviceLog.skipped },
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

	const importBikes = parseRecords<Bike>(data.bikes, isBike).valid;
	const importComponents = parseRecords<Component>(data.components, isComponent).valid;
	const importInstallations = parseRecords<Installation>(data.installations, isInstallation).valid;
	const importRides = parseRecords<Ride>(data.rides, isRide).valid;
	const importServiceLog = parseRecords<ServiceLogEntry>(data.service_log, isServiceLogEntry).valid;

	await db.transaction(
		'rw',
		[db.bikes, db.components, db.installations, db.rides, db.service_log],
		async () => {
			const existingBikes = await db.bikes.toArray();

			// Every foreign key from the backup is rewritten through these maps, so
			// rides and installations follow their real bike and component into the
			// local database instead of latching onto whatever local row happens to
			// share the exported id.
			const bikeIdMap = new Map<number, number>();
			const componentIdMap = new Map<number, number>();

			for (const bike of importBikes) {
				const oldId = bike.id;
				const match = existingBikes.find((b) => b.name.toLowerCase() === bike.name.toLowerCase());
				if (match && match.id !== undefined) {
					if (oldId !== undefined) bikeIdMap.set(oldId, match.id);
					result.bikes.skipped++;
				} else {
					const newId = await db.bikes.add(withoutId(bike));
					if (oldId !== undefined) bikeIdMap.set(oldId, newId);
					result.bikes.added++;
				}
			}

			for (const comp of importComponents) {
				const oldId = comp.id;
				const newId = await db.components.add(withoutId(comp));
				if (oldId !== undefined) componentIdMap.set(oldId, newId);
				result.components.added++;
			}

			for (const inst of importInstallations) {
				await db.installations.add(
					withoutId({
						...inst,
						bike_id: bikeIdMap.get(inst.bike_id) ?? inst.bike_id,
						component_id: componentIdMap.get(inst.component_id) ?? inst.component_id
					})
				);
			}

			for (const ride of importRides) {
				const bikeId = bikeIdMap.get(ride.bike_id) ?? ride.bike_id;
				if (ride.external_id) {
					const existing = await db.rides.where({ external_id: ride.external_id }).first();
					if (existing) {
						result.rides.skipped++;
						continue;
					}
				} else {
					const sameDay = await db.rides
						.where({ bike_id: bikeId })
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
				await db.rides.add(withoutId({ ...ride, bike_id: bikeId }));
				result.rides.added++;
			}

			for (const entry of importServiceLog) {
				const componentId = componentIdMap.get(entry.component_id) ?? entry.component_id;
				const bikeId = bikeIdMap.get(entry.bike_id) ?? entry.bike_id;
				const existing = await db.service_log
					.where({ component_id: componentId })
					.filter(
						(s) =>
							s.performed_at.slice(0, 10) === entry.performed_at.slice(0, 10) &&
							s.action === entry.action
					)
					.first();
				if (existing) {
					result.serviceLog.skipped++;
				} else {
					await db.service_log.add(
						withoutId({ ...entry, component_id: componentId, bike_id: bikeId })
					);
					result.serviceLog.added++;
				}
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

import { db } from './db';

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

	return JSON.stringify(
		{
			schema_version: 1,
			exported_at: new Date().toISOString(),
			bikes,
			components,
			installations,
			rides,
			service_log: serviceLog,
			custom_component_types: customTypes,
			settings
		},
		(_key, value) => (value instanceof Blob ? undefined : value),
		'\t'
	);
}

export async function importAll(
	json: string
): Promise<{ bikes: number; components: number; rides: number; serviceLog: number }> {
	const data = JSON.parse(json);
	if (!data.schema_version) throw new Error('Invalid backup file. Missing schema_version.');

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
			await db.settings.clear();

			if (data.bikes?.length) await db.bikes.bulkAdd(data.bikes);
			if (data.components?.length) await db.components.bulkAdd(data.components);
			if (data.installations?.length) await db.installations.bulkAdd(data.installations);
			if (data.rides?.length) await db.rides.bulkAdd(data.rides);
			if (data.service_log?.length) await db.service_log.bulkAdd(data.service_log);
			if (data.custom_component_types?.length)
				await db.custom_component_types.bulkAdd(data.custom_component_types);
			if (data.settings?.length) await db.settings.bulkAdd(data.settings);
		}
	);

	return {
		bikes: data.bikes?.length ?? 0,
		components: data.components?.length ?? 0,
		rides: data.rides?.length ?? 0,
		serviceLog: data.service_log?.length ?? 0
	};
}

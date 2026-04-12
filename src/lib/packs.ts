import { db } from './db';
import { getInterval } from './intervals';

export type PackComponent = {
	type: string;
	name: string;
	category: string;
	distance_meters: number | null;
	time_days: number | null;
	inspection_distance_meters: number | null;
	inspection_time_days: number | null;
	notes: string | null;
};

export type Pack = {
	format: 'truing-pack';
	version: 1;
	name: string;
	description: string | null;
	bike: {
		make: string | null;
		model: string | null;
		year: number | null;
		type: string | null;
	} | null;
	components: PackComponent[];
};

export function validatePack(data: unknown): Pack {
	const d = data as Record<string, unknown>;
	if (d.format !== 'truing-pack') throw new Error('Not a Truing data pack.');
	if (!d.name || typeof d.name !== 'string') throw new Error('Pack is missing a name.');
	if (!Array.isArray(d.components) || d.components.length === 0)
		throw new Error('Pack has no components.');
	return d as unknown as Pack;
}

export function findNewCustomTypes(pack: Pack): PackComponent[] {
	return pack.components.filter((c) => !getInterval(c.type));
}

export async function applyPack(
	bikeId: number,
	components: PackComponent[],
	newCustomTypes: PackComponent[]
): Promise<{ added: number }> {
	const now = new Date().toISOString();
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	let added = 0;

	await db.transaction(
		'rw',
		[db.components, db.installations, db.custom_component_types],
		async () => {
			for (const ct of newCustomTypes) {
				const existing = await db.custom_component_types.get(ct.type);
				if (!existing) {
					await db.custom_component_types.put({
						type: ct.type,
						label: ct.name,
						category: ct.category,
						default_distance_meters: ct.distance_meters,
						default_time_days: ct.time_days,
						default_inspection_distance_meters: ct.inspection_distance_meters,
						default_inspection_time_days: ct.inspection_time_days,
						notes: ct.notes ?? undefined,
						created_at: now,
						updated_at: now
					});
				}
			}

			const existingInstallations = await db.installations
				.where({ bike_id: bikeId })
				.filter((i) => !i.removed_at)
				.toArray();
			const existingComponentIds = existingInstallations.map((i) => i.component_id);
			const existingComponents = await db.components.bulkGet(existingComponentIds);
			const existingTypes = new Set(existingComponents.map((c) => c?.type).filter(Boolean));

			for (const comp of components) {
				if (existingTypes.has(comp.type)) continue;

				const hasOverride = comp.distance_meters !== null || comp.time_days !== null;
				const componentId = (await db.components.add({
					type: comp.type,
					name: comp.name,
					initial_wear_meters: 0,
					replacement_interval_distance_meters_override: hasOverride ? comp.distance_meters : null,
					replacement_interval_time_days_override: hasOverride ? comp.time_days : null,
					created_at: now,
					updated_at: now
				})) as number;

				await db.installations.add({
					component_id: componentId,
					bike_id: bikeId,
					installed_at: now,
					installed_at_tz: tz,
					created_at: now,
					updated_at: now
				});
				added++;
			}
		}
	);

	return { added };
}

export function exportBikeAsPack(
	bikeName: string,
	bikeInfo: { make?: string; model?: string; year?: number; type?: string },
	components: Array<{
		type: string;
		name: string;
		category: string;
		distance_meters: number | null;
		time_days: number | null;
		inspection_distance_meters: number | null;
		inspection_time_days: number | null;
		notes: string | null;
	}>
): string {
	const pack: Pack = {
		format: 'truing-pack',
		version: 1,
		name: `${bikeName}`,
		description: [bikeInfo.year, bikeInfo.make, bikeInfo.model].filter(Boolean).join(' ') || null,
		bike: {
			make: bikeInfo.make ?? null,
			model: bikeInfo.model ?? null,
			year: bikeInfo.year ?? null,
			type: bikeInfo.type ?? null
		},
		components
	};
	return JSON.stringify(pack, null, '\t');
}

import { db } from './db';
import { toast } from './toast';

export const RETIRE_REASONS = [
	{ value: 'sold', label: 'Sold' },
	{ value: 'traded', label: 'Traded' },
	{ value: 'donated', label: 'Donated' },
	{ value: 'retired', label: 'Retired' },
	{ value: 'stripped', label: 'Stripped for parts' },
	{ value: 'stolen', label: 'Stolen' },
	{ value: 'totaled', label: 'Totaled' }
] as const;

export function retireReasonLabel(reason?: string | null): string {
	return RETIRE_REASONS.find((r) => r.value === reason)?.label ?? 'Retired';
}

export async function reactivateBike(bikeId: number, bikeName: string): Promise<void> {
	await db.bikes.update(bikeId, {
		archived_at: null,
		archive_reason: null,
		updated_at: new Date().toISOString()
	});
	toast.success(`${bikeName} reactivated.`);
}

export async function deleteBike(bikeId: number, bikeName: string): Promise<boolean> {
	if (
		!confirm(
			`Permanently delete ${bikeName}? All rides, components, installations, and service history will be lost. This cannot be undone.`
		)
	)
		return false;
	try {
		await db.transaction(
			'rw',
			[db.bikes, db.rides, db.components, db.installations, db.service_log],
			async () => {
				await db.rides.where({ bike_id: bikeId }).delete();
				const installations = await db.installations.where({ bike_id: bikeId }).toArray();
				const componentIds = [...new Set(installations.map((i) => i.component_id))];
				await db.installations.where({ bike_id: bikeId }).delete();
				for (const cid of componentIds) {
					const otherInstalls = await db.installations.where({ component_id: cid }).count();
					if (otherInstalls === 0) {
						await db.service_log.where({ component_id: cid }).delete();
						await db.components.delete(cid);
					}
				}
				await db.bikes.delete(bikeId);
			}
		);
		toast.success(`${bikeName} permanently deleted.`);
		return true;
	} catch (err) {
		toast.error(`Delete failed. ${err instanceof Error ? err.message : String(err)}`);
		return false;
	}
}

export function bikeActions(
	bikeId: number,
	bikeName: string,
	isArchived: boolean,
	callbacks: {
		onRetire: () => void;
		onExportPack?: () => void;
		onReactivate?: () => void;
		onDelete?: () => void;
	}
): Array<{ label: string; onclick: () => void; danger?: boolean }> {
	if (isArchived) {
		return [
			...(callbacks.onExportPack
				? [{ label: 'Export as .truing pack', onclick: callbacks.onExportPack }]
				: []),
			{
				label: 'Reactivate',
				onclick: callbacks.onReactivate ?? (() => reactivateBike(bikeId, bikeName))
			},
			{
				label: 'Permanently delete',
				onclick: callbacks.onDelete ?? (() => deleteBike(bikeId, bikeName)),
				danger: true
			}
		];
	}
	return [
		...(callbacks.onExportPack
			? [{ label: 'Export as .truing pack', onclick: callbacks.onExportPack }]
			: []),
		{ label: 'Retire this bike', onclick: callbacks.onRetire, danger: true }
	];
}

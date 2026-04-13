import { db } from './db';
import { componentWear } from './wear';
import { componentLabel } from './intervals';
import { getUnitPreference, metersToDisplayUnit } from './units';

const METERS_PER_MILE = 1609.344;

const MILESTONES_MI = [50, 100, 250, 500, 750, 1000, 2500, 5000, 10000];
for (let i = 15000; i <= 100000; i += 5000) MILESTONES_MI.push(i);

const MILESTONES_KM = [100, 200, 500, 1000, 1500, 2000, 5000, 10000];
for (let i = 15000; i <= 160000; i += 5000) MILESTONES_KM.push(i);

export const TIER_1_TYPES = [
	'chain_8_9_10sp',
	'chain_11sp',
	'chain_12sp',
	'tire_road',
	'tire_gravel',
	'tire_mtb',
	'cassette_8_9_10sp',
	'cassette_11sp',
	'cassette_12sp',
	'disc_pads_hydraulic',
	'disc_pads_mechanical',
	'rim_brake_pads',
	'chainring',
	'frame'
];

export const TIER_2_TYPES = [
	'bottom_bracket_sealed',
	'brake_rotor',
	'derailleur_pulleys',
	'wheel_hub_sealed',
	'tubeless_sealant_standard',
	'tubeless_sealant_endurance',
	'headset_sealed',
	'saddle',
	'pedal_bearings',
	'crankset',
	'handlebar'
];

export function getMilestones(): number[] {
	return getUnitPreference() === 'metric' ? MILESTONES_KM : MILESTONES_MI;
}

export function findCrossedMilestone(oldMeters: number, newMeters: number): number | null {
	const milestones = getMilestones();
	const divisor = getUnitPreference() === 'metric' ? 1000 : METERS_PER_MILE;
	const oldDisplay = oldMeters / divisor;
	const newDisplay = newMeters / divisor;

	let highest: number | null = null;
	for (const ms of milestones) {
		if (oldDisplay < ms && newDisplay >= ms) {
			highest = ms;
		}
	}
	return highest;
}

function formatMilestone(value: number): string {
	return value >= 1000 ? value.toLocaleString() : String(value);
}

function unitLabel(): string {
	return getUnitPreference() === 'metric' ? 'km' : 'miles';
}

export function milestoneText(bikeName: string, milestone: number): string {
	const is100kMi = getUnitPreference() === 'imperial' && milestone === 100000;
	const is160kKm = getUnitPreference() === 'metric' && milestone === 160000;

	if (is100kMi) {
		return `100,000 miles. Four times around the Earth. One bike. ${bikeName}.\n\nTracked with Truing`;
	}
	if (is160kKm) {
		return `160,000 km. Four times around the Earth. One bike. ${bikeName}.\n\nTracked with Truing`;
	}

	const formatted = formatMilestone(milestone);
	const unit = unitLabel();

	if (milestone <= 50 || (getUnitPreference() === 'metric' && milestone <= 100)) {
		return `${formatted} ${unit} on ${bikeName}. Just getting started.\n\nTracked with Truing`;
	}

	return `${formatted} ${unit} on ${bikeName}.\n\nTracked with Truing`;
}

export function newBikeText(
	bikeName: string,
	bikeInfo?: { make?: string; model?: string; year?: number }
): string {
	if (bikeInfo?.year && bikeInfo?.make && bikeInfo?.model) {
		return `New bike day. ${bikeInfo.year} ${bikeInfo.make} ${bikeInfo.model}.\n\nTracked with Truing`;
	}
	return `New bike day. ${bikeName}.\n\nTracked with Truing`;
}

export function retiredBikeText(
	bikeName: string,
	totalMeters: number,
	purchaseDate?: string
): string {
	const dist = formatMilestone(Math.round(metersToDisplayUnit(totalMeters)));
	const unit = unitLabel();

	if (purchaseDate) {
		const years = Math.floor((Date.now() - Date.parse(purchaseDate)) / (365.25 * 86_400_000));
		if (years >= 1) {
			return `${bikeName}, retired after ${years} year${years !== 1 ? 's' : ''} and ${dist} ${unit}.\n\nTracked with Truing`;
		}
	}
	return `${bikeName}, retired at ${dist} ${unit}.\n\nTracked with Truing`;
}

export function retiredComponentText(
	name: string,
	totalMeters: number,
	purchasePriceCents?: number | null,
	bikeName?: string
): string {
	const dist = formatMilestone(Math.round(metersToDisplayUnit(totalMeters)));
	const unit = unitLabel();
	const bikeStr = bikeName ? ` ${bikeName}.` : '';

	if (purchasePriceCents && totalMeters > 0) {
		const displayDist = metersToDisplayUnit(totalMeters);
		const cpm = (purchasePriceCents / displayDist).toFixed(1);
		return `Got ${dist} ${unit} out of my ${name}. ${cpm}c/${getUnitPreference() === 'metric' ? 'km' : 'mi'}.${bikeStr}\n\nTracked with Truing`;
	}

	return `${dist} ${unit} on my ${name}.${bikeStr}\n\nTracked with Truing`;
}

export async function shareText(text: string): Promise<boolean> {
	if (typeof navigator !== 'undefined' && navigator.share) {
		try {
			await navigator.share({ text });
			return true;
		} catch {
			return false;
		}
	}
	if (typeof navigator !== 'undefined' && navigator.clipboard) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			return false;
		}
	}
	return false;
}

export async function getShareableTypes(): Promise<Set<string>> {
	const setting = await db.settings.get('shareable_component_types');
	if (setting?.value && Array.isArray(setting.value)) {
		return new Set(setting.value as string[]);
	}
	return new Set(TIER_1_TYPES);
}

export async function setShareableTypes(types: string[]): Promise<void> {
	await db.settings.put({
		key: 'shareable_component_types',
		value: types,
		updated_at: new Date().toISOString()
	});
}

export function isSpecialMilestone(milestone: number): boolean {
	const is100kMi = getUnitPreference() === 'imperial' && milestone === 100000;
	const is160kKm = getUnitPreference() === 'metric' && milestone === 160000;
	return is100kMi || is160kKm;
}

export async function bikeOdometer(bikeId: number): Promise<number> {
	const bike = await db.bikes.get(bikeId);
	if (!bike) return 0;
	const rides = await db.rides.where({ bike_id: bikeId }).toArray();
	return bike.starting_odometer_meters + rides.reduce((sum, r) => sum + r.distance_meters, 0);
}

export async function checkBikeMilestone(
	bikeId: number,
	addedMeters: number
): Promise<{ milestone: number; text: string } | null> {
	const totalMeters = await bikeOdometer(bikeId);
	const oldMeters = totalMeters - addedMeters;
	const milestone = findCrossedMilestone(oldMeters, totalMeters);
	if (!milestone) return null;

	const bike = await db.bikes.get(bikeId);
	if (!bike) return null;

	return { milestone, text: milestoneText(bike.name, milestone) };
}

export async function checkComponentShareable(
	componentId: number
): Promise<{ text: string } | null> {
	const component = await db.components.get(componentId);
	if (!component) return null;

	const shareableTypes = await getShareableTypes();
	if (!shareableTypes.has(component.type)) return null;

	const wearMeters = await componentWear(componentId);
	const minMeters = getUnitPreference() === 'metric' ? 1000 * 1000 : 1000 * METERS_PER_MILE;
	if (wearMeters < minMeters) return null;

	const installations = await db.installations.where({ component_id: componentId }).toArray();
	const lastInstall = installations.find((i) => i.removed_at || !i.removed_at);
	let bikeName: string | undefined;
	if (lastInstall) {
		const bike = await db.bikes.get(lastInstall.bike_id);
		bikeName = bike?.name;
	}

	const name = componentLabel(component);
	return {
		text: retiredComponentText(name, wearMeters, component.purchase_price_cents, bikeName)
	};
}

import { db } from './db';

export type UnitSystem = 'imperial' | 'metric';

let current: UnitSystem = 'imperial';

export async function loadUnitPreference(): Promise<void> {
	const setting = await db.settings.get('unit_system');
	current = (setting?.value as UnitSystem) ?? 'imperial';
}

export async function setUnitPreference(system: UnitSystem): Promise<void> {
	current = system;
	await db.settings.put({
		key: 'unit_system',
		value: system,
		updated_at: new Date().toISOString()
	});
}

export function getUnitPreference(): UnitSystem {
	return current;
}

const METERS_PER_MILE = 1609.344;

export function formatDistance(meters: number): string {
	if (current === 'metric') {
		const km = meters / 1000;
		return `${km.toFixed(1)} km`;
	}
	const mi = meters / METERS_PER_MILE;
	return `${mi.toFixed(1)} mi`;
}

export function formatDistanceInt(meters: number): string {
	if (current === 'metric') {
		return `${Math.round(meters / 1000).toLocaleString()} km`;
	}
	return `${Math.round(meters / METERS_PER_MILE).toLocaleString()} mi`;
}

export function distanceLabel(): string {
	return current === 'metric' ? 'km' : 'miles';
}

export function parseDistanceToMeters(value: number): number {
	if (current === 'metric') return value * 1000;
	return value * METERS_PER_MILE;
}

export function metersToDisplayUnit(meters: number): number {
	if (current === 'metric') return meters / 1000;
	return meters / METERS_PER_MILE;
}

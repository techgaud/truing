import type { Component, CustomComponentType } from '$lib/db';
import { db } from '$lib/db';
import serviceIntervals from '$lib/service_intervals.json';

export type ServiceScheduleEntry = {
	key: string;
	name: string;
	time_days: number | null;
	distance_meters: number | null;
};

export type ServiceInterval = {
	label: string;
	category: string;
	distance_meters: number | null;
	time_days: number | null;
	inspection_distance_meters: number | null;
	inspection_time_days: number | null;
	wear_multipliers_v2: Record<string, number>;
	notes: string;
	service_schedule?: ServiceScheduleEntry[];
};

const shipped = serviceIntervals as Record<string, ServiceInterval>;

let customCache: Record<string, CustomComponentType> = {};

export async function loadCustomTypes(): Promise<void> {
	const all = await db.custom_component_types.toArray();
	customCache = {};
	for (const ct of all) customCache[ct.type] = ct;
}

function getCustom(type: string): CustomComponentType | undefined {
	return customCache[type];
}

export function getInterval(type: string): ServiceInterval | undefined {
	return shipped[type];
}

export function replacementDistanceMeters(component: Component): number | null {
	if (component.replacement_interval_distance_meters_override != null)
		return component.replacement_interval_distance_meters_override;
	const s = shipped[component.type];
	if (s) return s.distance_meters;
	const c = getCustom(component.type);
	if (c) return c.default_distance_meters ?? null;
	return null;
}

export function replacementTimeDays(component: Component): number | null {
	if (component.replacement_interval_time_days_override != null)
		return component.replacement_interval_time_days_override;
	const s = shipped[component.type];
	if (s) return s.time_days;
	const c = getCustom(component.type);
	if (c) return c.default_time_days ?? null;
	return null;
}

export function inspectionDistanceMeters(component: Component): number | null {
	const s = shipped[component.type];
	if (s) return s.inspection_distance_meters;
	const c = getCustom(component.type);
	if (c) return c.default_inspection_distance_meters ?? null;
	return null;
}

export function inspectionTimeDays(component: Component): number | null {
	const s = shipped[component.type];
	if (s) return s.inspection_time_days;
	const c = getCustom(component.type);
	if (c) return c.default_inspection_time_days ?? null;
	return null;
}

// Time-based service intervals reset when a component is serviced. The clock
// for a time interval runs from whichever is latest: the current install date
// or the most recent 'serviced' event. These three helpers are pure: the
// serviced dates and today are passed in, so a test can pin any moment.
export function timeBasisStart(installedAt: string, servicedAt: readonly string[]): string {
	let basis = installedAt;
	let basisMs = Date.parse(installedAt);
	for (const s of servicedAt) {
		const ms = Date.parse(s);
		if (!Number.isNaN(ms) && ms > basisMs) {
			basis = s;
			basisMs = ms;
		}
	}
	return basis;
}

export function daysSinceTimeBasis(
	installedAt: string,
	servicedAt: readonly string[],
	today: string
): number {
	return (Date.parse(today) - Date.parse(timeBasisStart(installedAt, servicedAt))) / 86_400_000;
}

export function timeIntervalFraction(
	installedAt: string,
	servicedAt: readonly string[],
	timeIntervalDays: number | null,
	today: string
): number | null {
	if (timeIntervalDays == null || timeIntervalDays <= 0) return null;
	return daysSinceTimeBasis(installedAt, servicedAt, today) / timeIntervalDays;
}

// Edge helper: load the 'serviced' event dates for a set of components, keyed
// by component id, so the callers above can feed the pure functions.
export async function loadServicedDates(componentIds: number[]): Promise<Record<number, string[]>> {
	const map: Record<number, string[]> = {};
	if (componentIds.length === 0) return map;
	const entries = await db.service_log
		.where('component_id')
		.anyOf(componentIds)
		.and((e) => e.action === 'serviced')
		.toArray();
	for (const e of entries) {
		(map[e.component_id] ??= []).push(e.performed_at);
	}
	return map;
}

export function componentLabel(component: Component): string {
	if (component.name) return component.name;
	return componentTypeLabel(component.type);
}

export function serviceSchedule(type: string): ServiceScheduleEntry[] {
	return shipped[type]?.service_schedule ?? [];
}

const categoryLabels: Record<string, string> = {
	drivetrain: 'Drivetrain',
	brakes: 'Brakes',
	cables: 'Cables',
	wheels_tires: 'Wheels & Tires',
	bearings: 'Bearings',
	cockpit: 'Cockpit',
	frame: 'Frame',
	suspension: 'Suspension',
	ebike: 'E-Bike'
};

export function formatCategory(category: string): string {
	return (
		categoryLabels[category] ?? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

export function componentTypeLabel(type: string): string {
	const s = shipped[type];
	if (s) return s.label;
	const c = getCustom(type);
	if (c) return c.label;
	return type;
}

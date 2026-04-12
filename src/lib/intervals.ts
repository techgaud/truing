import type { Component, CustomComponentType } from '$lib/db';
import { db } from '$lib/db';
import serviceIntervals from '$lib/service_intervals.json';

export type ServiceInterval = {
	label: string;
	category: string;
	distance_meters: number | null;
	time_days: number | null;
	inspection_distance_meters: number | null;
	inspection_time_days: number | null;
	wear_multipliers_v2: Record<string, number>;
	notes: string;
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

export function componentLabel(component: Component): string {
	if (component.name) return component.name;
	return componentTypeLabel(component.type);
}

export function componentTypeLabel(type: string): string {
	const s = shipped[type];
	if (s) return s.label;
	const c = getCustom(type);
	if (c) return c.label;
	return type;
}

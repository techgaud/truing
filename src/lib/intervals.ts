import type { Component } from '$lib/db';
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

const intervals = serviceIntervals as Record<string, ServiceInterval>;

export function getInterval(type: string): ServiceInterval | undefined {
	return intervals[type];
}

export function replacementDistanceMeters(component: Component): number | null {
	return (
		component.replacement_interval_distance_meters_override ??
		intervals[component.type]?.distance_meters ??
		null
	);
}

export function replacementTimeDays(component: Component): number | null {
	return (
		component.replacement_interval_time_days_override ??
		intervals[component.type]?.time_days ??
		null
	);
}

export function inspectionDistanceMeters(component: Component): number | null {
	return intervals[component.type]?.inspection_distance_meters ?? null;
}

export function inspectionTimeDays(component: Component): number | null {
	return intervals[component.type]?.inspection_time_days ?? null;
}

export function componentLabel(component: Component): string {
	return component.name ?? intervals[component.type]?.label ?? component.type;
}

export function componentTypeLabel(type: string): string {
	return intervals[type]?.label ?? type;
}

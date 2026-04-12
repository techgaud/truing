import { db, type Ride } from '$lib/db';

export async function componentWear(componentId: number): Promise<number> {
	const component = await db.components.get(componentId);
	if (!component) return 0;
	const installations = await db.installations.where({ component_id: componentId }).toArray();

	let total = component.initial_wear_meters;
	for (const inst of installations) {
		const endAt = inst.removed_at ?? '9999-12-31T00:00:00Z';
		const rides = await db.rides
			.where('[bike_id+started_at]')
			.between([inst.bike_id, inst.installed_at], [inst.bike_id, endAt])
			.toArray();
		total += rides.reduce((sum, r) => sum + r.distance_meters, 0);
	}
	return total;
}

export function rollingAverageMetersPerDay(
	rides: Ride[],
	installationStart: string,
	now: string = new Date().toISOString(),
	windowDays: number = 30
): number | null {
	const windowStart = Math.max(
		Date.parse(installationStart),
		Date.parse(now) - windowDays * 86_400_000
	);
	const recent = rides.filter((r) => Date.parse(r.started_at) >= windowStart);
	if (recent.length < 2) return null;
	const totalMeters = recent.reduce((sum, r) => sum + r.distance_meters, 0);
	const spanDays = (Date.parse(now) - windowStart) / 86_400_000;
	return spanDays > 0 ? totalMeters / spanDays : null;
}

// TODO v2: projectedReplacementDate(component, rides) — needs helpers
// currentInstallationStartDate, currentWearMeters, intervalMeters, addDaysISO.

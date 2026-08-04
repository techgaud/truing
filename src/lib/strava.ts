import { db, type Bike } from './db';
import { decryptField, encryptField } from './crypto';

const STRAVA_API = 'https://www.strava.com/api/v3';

export type StravaGear = {
	id: string;
	name: string;
	distance: number;
};

export async function fetchStravaGear(): Promise<StravaGear[]> {
	const token = await getAccessToken();
	if (!token) throw new Error('Not connected to Strava.');
	const res = await fetch(`${STRAVA_API}/athlete`, {
		headers: { Authorization: `Bearer ${token}` }
	});
	if (!res.ok) throw new Error(`Strava API returned ${res.status}.`);
	const athlete = await res.json();
	return (athlete.bikes ?? []).map((b: { id: string; name: string; distance: number }) => ({
		id: b.id,
		name: b.name,
		distance: b.distance
	}));
}

async function getAccessToken(): Promise<string | null> {
	const auth = await db.strava_auth.get(1);
	if (!auth || auth.access_token.length === 0) return null;

	if (auth.expires_at > Date.now() / 1000 + 60) {
		return decryptField(auth.access_token);
	}

	const refreshToken = await decryptField(auth.refresh_token);
	const clientSecret = await decryptField(auth.client_secret);
	const body = new URLSearchParams({
		client_id: auth.client_id,
		client_secret: clientSecret,
		grant_type: 'refresh_token',
		refresh_token: refreshToken
	});

	const res = await fetch('/api/strava/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: body.toString()
	});

	if (!res.ok) return null;

	const data = await res.json();
	await db.strava_auth.update(1, {
		access_token: await encryptField(data.access_token),
		refresh_token: await encryptField(data.refresh_token),
		expires_at: data.expires_at
	});

	return data.access_token;
}

// Strava's activity feed mixes runs, hikes, and walks in with rides. Only
// cycling activity types belong on a bike, or a runner-cyclist's every run
// lands on their bike and inflates component wear.
const CYCLING_ACTIVITY_TYPES = new Set([
	'Ride',
	'VirtualRide',
	'GravelRide',
	'MountainBikeRide',
	'EBikeRide'
]);

export function isCyclingActivity(type: string): boolean {
	return CYCLING_ACTIVITY_TYPES.has(type);
}

type StravaActivity = {
	id: number;
	name: string;
	type: string;
	start_date: string;
	distance: number;
	moving_time: number;
	elapsed_time: number;
	total_elevation_gain: number;
	gear_id: string | null;
};

async function fetchActivities(token: string, after?: number): Promise<StravaActivity[]> {
	const all: StravaActivity[] = [];
	let page = 1;
	const perPage = 100;

	while (true) {
		const params = new URLSearchParams({
			per_page: String(perPage),
			page: String(page)
		});
		if (after) params.set('after', String(after));

		const res = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
			headers: { Authorization: `Bearer ${token}` }
		});

		if (!res.ok) break;

		const batch: StravaActivity[] = await res.json();
		all.push(...batch);
		if (batch.length < perPage) break;
		page++;
	}

	return all;
}

export type SyncResult = {
	imported: number;
	skipped: number;
	total: number;
};

export async function syncStrava(): Promise<SyncResult> {
	const token = await getAccessToken();
	if (!token) throw new Error('Not connected to Strava. Set up credentials in Settings.');

	const auth = await db.strava_auth.get(1);
	const after = auth?.last_sync_at ?? undefined;

	const activities = await fetchActivities(token, after);

	const bikes = await db.bikes.toArray();
	const bikeByGearId: Record<string, Bike> = {};
	for (const bike of bikes) {
		if (bike.strava_gear_id && bike.id !== undefined) {
			bikeByGearId[bike.strava_gear_id] = bike;
		}
	}
	const fallbackBike = bikes.find((b) => !b.archived_at);

	let imported = 0;
	let skipped = 0;

	for (const activity of activities) {
		if (!isCyclingActivity(activity.type)) {
			skipped++;
			continue;
		}
		const externalId = String(activity.id);
		const existing = await db.rides.where({ external_id: externalId }).first();
		if (existing) {
			skipped++;
			continue;
		}

		const bike = activity.gear_id ? bikeByGearId[activity.gear_id] : fallbackBike;
		if (!bike || bike.id === undefined) {
			skipped++;
			continue;
		}

		const now = new Date().toISOString();
		const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
		await db.rides.add({
			bike_id: bike.id,
			started_at: activity.start_date,
			started_at_tz: tz,
			distance_meters: Math.round(activity.distance),
			duration_seconds: activity.moving_time,
			elevation_gain_meters: activity.total_elevation_gain
				? Math.round(activity.total_elevation_gain)
				: null,
			conditions: [],
			source: 'strava',
			external_id: externalId,
			notes: activity.name,
			created_at: now,
			updated_at: now
		});
		imported++;
	}

	const latestTimestamp =
		activities.length > 0
			? Math.max(...activities.map((a) => Math.floor(new Date(a.start_date).getTime() / 1000)))
			: undefined;

	if (latestTimestamp) {
		await db.strava_auth.update(1, {
			last_sync_at: latestTimestamp,
			last_sync_error: null
		});
	}

	return { imported, skipped, total: activities.length };
}

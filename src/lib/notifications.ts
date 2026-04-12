import { db, type Bike } from '$lib/db';
import { componentWear } from '$lib/wear';
import {
	replacementDistanceMeters,
	replacementTimeDays,
	componentLabel,
	loadCustomTypes
} from '$lib/intervals';
import { metersToDisplayUnit, distanceLabel } from '$lib/units';
import { isCapacitorNative } from '$lib/platform';

const DEFAULT_THRESHOLD_PCT = 90;
const ESCALATION_THRESHOLDS = [95, 99];

export function getNotificationThresholds(
	customPct?: number | null,
	globalDefault: number = DEFAULT_THRESHOLD_PCT
): number[] {
	const first = customPct ?? globalDefault;
	const all = [first, ...ESCALATION_THRESHOLDS];
	return [...new Set(all)].filter((t) => t >= first && t <= 99).sort((a, b) => a - b);
}

export function findNewThresholdCrossings(
	urgencyPct: number,
	thresholds: number[],
	alreadyNotified: number[]
): number[] {
	return thresholds.filter((t) => urgencyPct >= t && !alreadyNotified.includes(t));
}

function notificationMessage(
	name: string,
	bikeName: string,
	pct: number,
	remainingDays: number | null,
	remainingDistance: number | null
): { title: string; body: string } {
	const remaining =
		remainingDistance !== null
			? `${Math.abs(remainingDistance).toLocaleString()} ${distanceLabel()} remaining`
			: remainingDays !== null
				? `${Math.abs(remainingDays)} days remaining`
				: '';

	if (pct >= 99) {
		return {
			title: `${name} is almost due`,
			body: `${name} on ${bikeName} needs service very soon. ${remaining}`.trim()
		};
	}
	if (pct >= 95) {
		return {
			title: `${name} will need service soon`,
			body: `${name} on ${bikeName} is at ${pct}% wear. ${remaining}`.trim()
		};
	}
	return {
		title: `${name} is approaching service`,
		body: `${name} on ${bikeName} is at ${pct}% wear. ${remaining}`.trim()
	};
}

async function fireNotification(
	componentId: number,
	pct: number,
	title: string,
	body: string
): Promise<void> {
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		const perms = await LocalNotifications.checkPermissions();
		if (perms.display !== 'granted') {
			const req = await LocalNotifications.requestPermissions();
			if (req.display !== 'granted') return;
		}
		await LocalNotifications.schedule({
			notifications: [
				{
					id: componentId * 1000 + pct,
					title,
					body,
					schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }
				}
			]
		});
	} catch {
		// notifications are best-effort
	}
}

export async function runNotificationCheck(): Promise<void> {
	if (!isCapacitorNative()) return;

	const enabledSetting = await db.settings.get('notifications_enabled');
	if (enabledSetting?.value === false) return;

	const globalThreshold =
		((await db.settings.get('notification_threshold_pct'))?.value as number) ??
		DEFAULT_THRESHOLD_PCT;

	await loadCustomTypes();
	const allBikes = await db.bikes.toArray();
	const activeBikes = allBikes.filter((b) => !b.archived_at && b.id !== undefined);
	if (activeBikes.length === 0) return;

	const bikeById: Record<number, Bike> = {};
	for (const b of activeBikes) bikeById[b.id!] = b;

	const allInstallations = await db.installations.toArray();
	const active = allInstallations.filter((i) => !i.removed_at && bikeById[i.bike_id]);
	if (active.length === 0) return;

	const components = await db.components.bulkGet(active.map((i) => i.component_id));
	const now = Date.now();

	for (let idx = 0; idx < active.length; idx++) {
		const inst = active[idx];
		const component = components[idx];
		if (!component || component.id === undefined || component.retired_at) continue;
		const bike = bikeById[inst.bike_id];
		if (!bike) continue;

		const wearMeters = await componentWear(component.id);
		const distInterval = replacementDistanceMeters(component);
		const timeInterval = replacementTimeDays(component);

		const distanceFraction =
			distInterval != null && distInterval > 0 ? wearMeters / distInterval : null;
		const daysSinceInstall = (now - Date.parse(inst.installed_at)) / 86_400_000;
		const timeFraction =
			timeInterval != null && timeInterval > 0 ? daysSinceInstall / timeInterval : null;
		const urgencyPct = Math.max(distanceFraction ?? 0, timeFraction ?? 0) * 100;

		const thresholds = getNotificationThresholds(
			component.notification_threshold_pct,
			globalThreshold
		);
		const alreadyNotified = component.notified_thresholds ?? [];
		const newCrossings = findNewThresholdCrossings(urgencyPct, thresholds, alreadyNotified);
		if (newCrossings.length === 0) continue;

		const remainingDistance =
			distInterval != null ? Math.round(metersToDisplayUnit(distInterval - wearMeters)) : null;
		const remainingDays = timeInterval != null ? Math.round(timeInterval - daysSinceInstall) : null;
		const name = componentLabel(component);

		for (const pct of newCrossings) {
			const msg = notificationMessage(name, bike.name, pct, remainingDays, remainingDistance);
			await fireNotification(component.id, pct, msg.title, msg.body);
		}

		await db.components.update(component.id, {
			notified_thresholds: [...alreadyNotified, ...newCrossings],
			updated_at: new Date().toISOString()
		});
	}

	await db.settings.put({
		key: '_last_notification_check_at',
		value: new Date().toISOString(),
		updated_at: new Date().toISOString()
	});
}

export async function clearNotifiedThresholds(componentId: number): Promise<void> {
	await db.components.update(componentId, {
		notified_thresholds: [],
		updated_at: new Date().toISOString()
	});
}

export async function sendTestNotification(): Promise<boolean> {
	if (!isCapacitorNative()) return false;
	try {
		const { LocalNotifications } = await import('@capacitor/local-notifications');
		const perms = await LocalNotifications.checkPermissions();
		if (perms.display !== 'granted') {
			const req = await LocalNotifications.requestPermissions();
			if (req.display !== 'granted') return false;
		}
		await LocalNotifications.schedule({
			notifications: [
				{
					id: 999999,
					title: 'Truing notifications working',
					body: 'You will receive alerts when components approach their service intervals.',
					schedule: { at: new Date(Date.now() + 2000), allowWhileIdle: true }
				}
			]
		});
		return true;
	} catch {
		return false;
	}
}

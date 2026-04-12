interface CapacitorWindow extends Window {
	Capacitor?: { isNativePlatform?: () => boolean };
}

function isNative(): boolean {
	return (
		typeof window !== 'undefined' && !!(window as CapacitorWindow).Capacitor?.isNativePlatform?.()
	);
}

export async function scheduleWearReminder(
	componentName: string,
	bikeName: string,
	daysUntilDue: number
): Promise<void> {
	if (!isNative()) return;
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
					id: Math.floor(Math.random() * 100000),
					title: `${componentName} is due soon`,
					body: `${componentName} on ${bikeName} is about ${daysUntilDue} days from needing service.`,
					schedule: {
						at: new Date(Date.now() + 24 * 60 * 60 * 1000),
						allowWhileIdle: true
					}
				}
			]
		});
	} catch {
		// notifications are best-effort
	}
}

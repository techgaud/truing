interface CapacitorWindow extends Window {
	Capacitor?: { isNativePlatform?: () => boolean };
}

function isNative(): boolean {
	return (
		typeof window !== 'undefined' && !!(window as CapacitorWindow).Capacitor?.isNativePlatform?.()
	);
}

export const haptic = {
	async selection() {
		if (!isNative()) return;
		try {
			const { Haptics } = await import('@capacitor/haptics');
			await Haptics.selectionStart();
			await Haptics.selectionEnd();
		} catch {
			// haptics are best-effort
		}
	},
	async impact(style: 'light' | 'medium' | 'heavy' = 'medium') {
		if (!isNative()) return;
		try {
			const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
			const map = {
				light: ImpactStyle.Light,
				medium: ImpactStyle.Medium,
				heavy: ImpactStyle.Heavy
			};
			await Haptics.impact({ style: map[style] });
		} catch {
			// haptics are best-effort
		}
	},
	async notification(type: 'success' | 'warning' | 'error' = 'success') {
		if (!isNative()) return;
		try {
			const { Haptics, NotificationType } = await import('@capacitor/haptics');
			const map = {
				success: NotificationType.Success,
				warning: NotificationType.Warning,
				error: NotificationType.Error
			};
			await Haptics.notification({ type: map[type] });
		} catch {
			// haptics are best-effort
		}
	}
};

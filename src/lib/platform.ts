interface CapacitorWindow extends Window {
	Capacitor?: { isNativePlatform?: () => boolean };
	navigator: Navigator & { standalone?: boolean };
}

export function isIOSSafari(): boolean {
	if (typeof window === 'undefined') return false;
	const ua = navigator.userAgent;
	const isIOS = /iPad|iPhone|iPod/.test(ua);
	const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua);
	return isIOS && isSafari;
}

export function isStandalonePWA(): boolean {
	if (typeof window === 'undefined') return false;
	return (
		(window as CapacitorWindow).navigator.standalone === true ||
		window.matchMedia('(display-mode: standalone)').matches
	);
}

export function isCapacitorNative(): boolean {
	if (typeof window === 'undefined') return false;
	return (window as CapacitorWindow).Capacitor?.isNativePlatform?.() === true;
}

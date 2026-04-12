<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import HelpOverlay from '$lib/components/HelpOverlay.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import EvictionModal from '$lib/components/EvictionModal.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import IOSInstallPrompt from '$lib/components/IOSInstallPrompt.svelte';
	import { installGlobalHandlers } from '$lib/errors';
	import { checkStorage, requestPersist } from '$lib/storage';
	import { handleShortcutKeyDown, loadShortcutMode } from '$lib/shortcuts';
	import { loadUnitPreference } from '$lib/units';
	import { isCapacitorNative } from '$lib/platform';
	import { runNotificationCheck } from '$lib/notifications';
	import { ensurePremigrationBackup } from '$lib/premigration';
	import { db } from '$lib/db';

	if (browser) {
		installGlobalHandlers();
		loadShortcutMode();
		loadUnitPreference();
	}

	async function checkNotificationsOnResume() {
		if (!isCapacitorNative()) return;
		const last = await db.settings.get('_last_notification_check_at');
		const lastTime = last?.value ? Date.parse(last.value as string) : 0;
		if (Date.now() - lastTime > 86_400_000) {
			runNotificationCheck();
		}
	}

	if (browser && isCapacitorNative()) {
		import('@capacitor/app').then(({ App }) => {
			App.addListener('resume', () => {
				checkNotificationsOnResume();
			});
		});
	}

	let evicted = $state(false);
	let storageReady = $state(!browser);

	if (browser) {
		ensurePremigrationBackup()
			.catch(() => {})
			.then(() => checkStorage())
			.then((result) => {
				evicted = result === 'evicted';
				storageReady = true;
				requestPersist();
			});
	}

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{#if storageReady}
	<div class="min-h-dvh pb-16 lg:pb-0 lg:pl-48">
		{@render children()}
	</div>
{/if}

{#if evicted}
	<EvictionModal onresolved={() => (evicted = false)} />
{/if}

<svelte:window onkeydown={handleShortcutKeyDown} />

<BottomNav />
<HelpOverlay />
<UpdateBanner />
<IOSInstallPrompt />
<ToastContainer />

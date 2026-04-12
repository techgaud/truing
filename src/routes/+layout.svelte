<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';
	import HelpOverlay from '$lib/components/HelpOverlay.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import EvictionModal from '$lib/components/EvictionModal.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';
	import IOSInstallPrompt from '$lib/components/IOSInstallPrompt.svelte';
	import { installGlobalHandlers } from '$lib/errors';
	import { checkStorage, requestPersist } from '$lib/storage';
	import { handleShortcutKeyDown, loadShortcutMode } from '$lib/shortcuts';
	import { loadUnitPreference } from '$lib/units';

	if (browser) {
		installGlobalHandlers();
		loadShortcutMode();
		loadUnitPreference();
	}

	let evicted = $state(false);
	let storageReady = $state(!browser);

	if (browser) {
		checkStorage().then((result) => {
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

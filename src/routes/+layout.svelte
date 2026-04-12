<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { browser } from '$app/environment';
	import Settings from 'lucide-svelte/icons/settings';
	import HelpOverlay from '$lib/components/HelpOverlay.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import EvictionModal from '$lib/components/EvictionModal.svelte';
	import { installGlobalHandlers } from '$lib/errors';
	import { checkStorage, requestPersist } from '$lib/storage';

	if (browser) installGlobalHandlers();

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

<a
	href={resolve('/settings')}
	aria-label="Settings"
	class="fixed top-4 right-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated"
>
	<Settings size={18} />
</a>

<BottomNav />
<HelpOverlay />

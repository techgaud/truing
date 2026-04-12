<script lang="ts">
	import Plus from 'lucide-svelte/icons/plus';
	import { haptic } from '$lib/haptics';

	let { href = '', onclick }: { href?: string; onclick?: () => void } = $props();
</script>

{#if href}
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		{href}
		onclick={() => haptic.impact('light')}
		aria-label="Add"
		class="fixed right-5 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg lg:bottom-6"
	>
		<Plus size={24} />
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else if onclick}
	<button
		type="button"
		{onclick}
		aria-label="Add"
		class="fixed right-5 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg lg:bottom-6"
	>
		<Plus size={24} />
	</button>
{/if}

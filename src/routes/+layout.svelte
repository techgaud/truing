<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import HelpOverlay from '$lib/components/HelpOverlay.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<HelpOverlay />

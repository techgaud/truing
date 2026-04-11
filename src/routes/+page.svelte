<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db } from '$lib/db';

	const bikes = liveQuery(() => db.bikes.toArray());
</script>

<svelte:head>
	<title>Truing</title>
</svelte:head>

<main class="mx-auto max-w-md px-6 py-8">
	{#if $bikes?.length === 0}
		<div class="flex min-h-[60dvh] flex-col items-center justify-center text-center">
			<h1 class="text-2xl font-semibold">Welcome to Truing</h1>
			<p class="mt-3 text-fg-muted">Track your bike's components and stay on top of maintenance.</p>
			<a
				href={resolve('/bikes/new')}
				class="mt-8 rounded-button bg-accent px-5 py-3 font-medium text-accent-fg"
			>
				Add your first bike
			</a>
		</div>
	{:else if $bikes}
		<h1 class="text-2xl font-semibold">Dashboard</h1>
		<p class="mt-3 text-fg-muted">
			{$bikes.length}
			{$bikes.length === 1 ? 'bike' : 'bikes'} tracked.
		</p>
		<a
			href={resolve('/bikes')}
			class="mt-6 inline-block rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
		>
			View bikes
		</a>
	{/if}
</main>

<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db } from '$lib/db';

	const bikes = liveQuery(() => db.bikes.toArray());
</script>

<svelte:head>
	<title>Bikes · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<h1 class="text-2xl font-semibold">Bikes</h1>

	{#if $bikes?.length === 0}
		<div class="mt-12 flex flex-col items-center text-center">
			<p class="text-fg-muted">No bikes yet.</p>
			<a
				href={resolve('/bikes/new')}
				class="mt-6 rounded-button bg-accent px-5 py-3 font-medium text-accent-fg"
			>
				Add a bike
			</a>
		</div>
	{:else if $bikes}
		<ul class="mt-6 space-y-2">
			{#each $bikes as bike (bike.id)}
				<li>
					<a
						href={resolve('/bikes/[id]', { id: String(bike.id) })}
						class="block rounded-card border border-border bg-surface-elevated px-4 py-3"
					>
						<p class="font-medium">{bike.name}</p>
						{#if bike.type}
							<p class="text-sm text-fg-muted capitalize">{bike.type}</p>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

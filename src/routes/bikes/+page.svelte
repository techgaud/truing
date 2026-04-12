<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db } from '$lib/db';

	const allBikes = liveQuery(() => db.bikes.toArray());

	let filter = $state<'active' | 'archived'>('active');

	const filteredBikes = $derived.by(() => {
		if (!$allBikes) return undefined;
		if (filter === 'active') return $allBikes.filter((b) => !b.archived_at);
		return $allBikes.filter((b) => !!b.archived_at);
	});

	const activeCount = $derived($allBikes?.filter((b) => !b.archived_at).length ?? 0);
	const archivedCount = $derived($allBikes?.filter((b) => !!b.archived_at).length ?? 0);
</script>

<svelte:head>
	<title>Bikes · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<h1 class="text-2xl font-semibold">Bikes</h1>

	{#if $allBikes && $allBikes.length > 0}
		<div class="mt-4 inline-flex rounded-button border border-border bg-surface-elevated p-1">
			<button
				type="button"
				onclick={() => (filter = 'active')}
				class="rounded-button px-4 py-1.5 text-sm font-medium {filter === 'active'
					? 'bg-accent text-accent-fg'
					: 'text-fg-muted'}"
			>
				Active ({activeCount})
			</button>
			<button
				type="button"
				onclick={() => (filter = 'archived')}
				class="rounded-button px-4 py-1.5 text-sm font-medium {filter === 'archived'
					? 'bg-accent text-accent-fg'
					: 'text-fg-muted'}"
			>
				Archived ({archivedCount})
			</button>
		</div>
	{/if}

	{#if filteredBikes?.length === 0}
		<div class="mt-12 flex flex-col items-center text-center">
			{#if filter === 'archived'}
				<p class="text-fg-muted">No archived bikes.</p>
			{:else if $allBikes?.length === 0}
				<p class="text-fg-muted">No bikes yet.</p>
				<a
					href={resolve('/bikes/new')}
					class="mt-6 rounded-button bg-accent px-5 py-3 font-medium text-accent-fg"
				>
					Add a bike
				</a>
			{:else}
				<p class="text-fg-muted">No active bikes.</p>
			{/if}
		</div>
	{:else if filteredBikes}
		<ul class="mt-6 space-y-2">
			{#each filteredBikes as bike (bike.id)}
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

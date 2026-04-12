<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db, type Bike, type Ride } from '$lib/db';

	const METERS_PER_MILE = 1609.344;

	type Row = { ride: Ride; bike: Bike | undefined };

	const rows = liveQuery<Row[]>(async () => {
		const rides = await db.rides.orderBy('started_at').reverse().toArray();
		if (rides.length === 0) return [];
		const bikeIds = [...new Set(rides.map((r) => r.bike_id))];
		const bikes = await db.bikes.bulkGet(bikeIds);
		const bikeById: Record<number, Bike> = {};
		for (const b of bikes) if (b?.id !== undefined) bikeById[b.id] = b;
		return rides.map((ride) => ({ ride, bike: bikeById[ride.bike_id] }));
	});

	function formatDistance(meters: number): string {
		const miles = meters / METERS_PER_MILE;
		return `${miles.toFixed(1)} mi`;
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Rides · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<header class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Rides</h1>
		{#if $rows && $rows.length > 0}
			<a
				href={resolve('/rides/new')}
				class="rounded-button bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
			>
				Add a ride
			</a>
		{/if}
	</header>

	{#if $rows?.length === 0}
		<div class="mt-12 flex flex-col items-center text-center">
			<p class="text-fg-muted">No rides yet.</p>
			<a
				href={resolve('/rides/new')}
				class="mt-6 rounded-button bg-accent px-5 py-3 font-medium text-accent-fg"
			>
				Add a ride
			</a>
		</div>
	{:else if $rows}
		<ul class="mt-6 space-y-2">
			{#each $rows as row (row.ride.id)}
				<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="font-medium">{formatDistance(row.ride.distance_meters)}</p>
							<p class="text-sm text-fg-muted">
								{row.bike?.name ?? 'Unknown bike'} · {formatDate(row.ride.started_at)}
							</p>
						</div>
						<span
							class="shrink-0 rounded-button border border-border px-2 py-0.5 text-xs text-fg-muted capitalize"
						>
							{row.ride.source}
						</span>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</main>

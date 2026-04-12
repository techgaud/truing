<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db, type Bike, type Ride } from '$lib/db';

	const METERS_PER_MILE = 1609.344;
	const SWIPE_THRESHOLD = 80;
	const SWIPE_MAX = 120;
	const UNDO_WINDOW_MS = 5000;

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

	let revealedRideId = $state<number | null>(null);
	let draggingRideId = $state<number | null>(null);
	let dragStartX = $state(0);
	let dragDeltaX = $state(0);
	let pendingDelete = $state<Ride | null>(null);
	let pendingTimer: ReturnType<typeof setTimeout> | null = null;

	function formatDistance(meters: number): string {
		return `${(meters / METERS_PER_MILE).toFixed(1)} mi`;
	}

	function formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function transformFor(rideId: number): number {
		if (draggingRideId === rideId) return Math.max(-SWIPE_MAX, Math.min(0, dragDeltaX));
		if (revealedRideId === rideId) return -SWIPE_THRESHOLD;
		return 0;
	}

	function handlePointerDown(e: PointerEvent, rideId: number) {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		draggingRideId = rideId;
		dragStartX = e.clientX;
		dragDeltaX = revealedRideId === rideId ? -SWIPE_THRESHOLD : 0;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent, rideId: number) {
		if (draggingRideId !== rideId) return;
		const offset = revealedRideId === rideId ? -SWIPE_THRESHOLD : 0;
		dragDeltaX = e.clientX - dragStartX + offset;
	}

	function handlePointerUp(e: PointerEvent, rideId: number) {
		if (draggingRideId !== rideId) return;
		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		} catch {
			// ignore if capture was never taken
		}
		revealedRideId = dragDeltaX < -SWIPE_THRESHOLD / 2 ? rideId : null;
		draggingRideId = null;
		dragDeltaX = 0;
	}

	function handleRowKeydown(e: KeyboardEvent, row: Row) {
		if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault();
			handleDelete(row);
		} else if (e.key === 'Escape') {
			revealedRideId = null;
		}
	}

	async function handleDelete(row: Row) {
		if (row.ride.id === undefined) return;
		if (pendingTimer) {
			clearTimeout(pendingTimer);
			pendingTimer = null;
			pendingDelete = null;
		}
		const rideCopy: Ride = { ...row.ride };
		try {
			await db.rides.delete(row.ride.id);
			pendingDelete = rideCopy;
			revealedRideId = null;
			pendingTimer = setTimeout(() => {
				pendingDelete = null;
				pendingTimer = null;
			}, UNDO_WINDOW_MS);
		} catch (err) {
			alert(`Delete failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handleUndo() {
		if (!pendingDelete) return;
		const toRestore = pendingDelete;
		if (pendingTimer) {
			clearTimeout(pendingTimer);
			pendingTimer = null;
		}
		pendingDelete = null;
		try {
			await db.rides.put(toRestore);
		} catch (err) {
			alert(`Undo failed. ${err instanceof Error ? err.message : String(err)}`);
		}
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
				{@const rideId = row.ride.id}
				{#if rideId !== undefined}
					<li class="relative overflow-hidden rounded-card">
						<button
							type="button"
							onclick={() => handleDelete(row)}
							aria-label="Delete ride"
							class="absolute top-0 right-0 bottom-0 flex items-center bg-danger px-5 font-medium text-accent-fg"
						>
							Delete
						</button>
						<div
							role="button"
							tabindex="0"
							aria-label="Ride row. Press Delete or Backspace to remove."
							onpointerdown={(e) => handlePointerDown(e, rideId)}
							onpointermove={(e) => handlePointerMove(e, rideId)}
							onpointerup={(e) => handlePointerUp(e, rideId)}
							onpointercancel={(e) => handlePointerUp(e, rideId)}
							onkeydown={(e) => handleRowKeydown(e, row)}
							class="relative touch-pan-y rounded-card border border-border bg-surface-elevated px-4 py-3 select-none {draggingRideId ===
							rideId
								? ''
								: 'transition-transform duration-150 ease-out'}"
							style="transform: translateX({transformFor(rideId)}px);"
						>
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
						</div>
					</li>
				{/if}
			{/each}
		</ul>
	{/if}
</main>

{#if pendingDelete}
	<div
		role="status"
		aria-live="polite"
		class="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-card border border-border bg-surface-elevated px-4 py-2 shadow-lg lg:bottom-6"
	>
		<span>Ride deleted.</span>
		<button type="button" onclick={handleUndo} class="text-sm font-medium text-accent">
			Undo
		</button>
	</div>
{/if}

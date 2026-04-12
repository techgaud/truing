<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db, type Bike, type Ride } from '$lib/db';
	import { parseFile } from '$lib/import/parse';
	import { syncStrava } from '$lib/strava';
	import { haptic } from '$lib/haptics';
	import { formatDistance } from '$lib/units';
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
		const revealed = dragDeltaX < -SWIPE_THRESHOLD / 2;
		if (revealed) haptic.impact('medium');
		revealedRideId = revealed ? rideId : null;
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
		haptic.notification('warning');
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

	let importStatus = $state('');
	let syncing = $state(false);

	const stravaAuth = liveQuery(() => db.strava_auth.get(1));
	const stravaConnected = $derived(
		$stravaAuth?.access_token != null && $stravaAuth.access_token.length > 0
	);

	async function handleStravaSync() {
		syncing = true;
		importStatus = '';
		try {
			const result = await syncStrava();
			importStatus = `Strava sync done. ${result.imported} new rides, ${result.skipped} skipped.`;
		} catch (err) {
			importStatus = `Sync failed. ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			syncing = false;
			setTimeout(() => (importStatus = ''), 8000);
		}
	}

	async function handleFileImport() {
		const activeBikes = await db.bikes.filter((b) => !b.archived_at).toArray();
		if (activeBikes.length === 0) {
			alert('Add a bike first, then import rides.');
			return;
		}

		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.gpx,.fit';
		input.multiple = true;
		input.onchange = async () => {
			const files = input.files;
			if (!files || files.length === 0) return;
			importStatus = `Importing ${files.length} file${files.length > 1 ? 's' : ''}…`;
			let imported = 0;
			let failed = 0;
			for (const file of files) {
				try {
					const parsed = await parseFile(file);
					const existing = parsed.external_id
						? await db.rides.where({ external_id: parsed.external_id }).first()
						: undefined;
					if (existing) continue;

					const bikeId =
						activeBikes.length === 1 ? activeBikes[0].id! : await pickBike(activeBikes, file.name);
					if (bikeId === null) continue;

					const now = new Date().toISOString();
					const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
					await db.rides.add({
						bike_id: bikeId,
						started_at: parsed.started_at,
						started_at_tz: tz,
						distance_meters: parsed.distance_meters,
						duration_seconds: parsed.duration_seconds,
						elevation_gain_meters: parsed.elevation_gain_meters ?? null,
						conditions: [],
						source: parsed.source,
						external_id: parsed.external_id,
						created_at: now,
						updated_at: now
					});
					imported++;
				} catch {
					failed++;
				}
			}
			importStatus = `Imported ${imported} ride${imported !== 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}.`;
			setTimeout(() => (importStatus = ''), 5000);
		};
		input.click();
	}

	function pickBike(bikes: Bike[], fileName: string): Promise<number | null> {
		const names = bikes.map((b, i) => `${i + 1}. ${b.name}`).join('\n');
		const choice = prompt(`Which bike for ${fileName}?\n\n${names}\n\nEnter the number.`);
		if (!choice) return Promise.resolve(null);
		const idx = parseInt(choice, 10) - 1;
		if (idx >= 0 && idx < bikes.length) return Promise.resolve(bikes[idx].id!);
		return Promise.resolve(null);
	}
</script>

<svelte:head>
	<title>Rides · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<header class="flex items-center justify-between">
		<h1 class="text-2xl font-semibold">Rides</h1>
		{#if $rows && $rows.length > 0}
			<div class="flex gap-2">
				{#if stravaConnected}
					<button
						type="button"
						onclick={handleStravaSync}
						disabled={syncing}
						class="rounded-button border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
					>
						{syncing ? 'Syncing…' : 'Sync Strava'}
					</button>
				{/if}
				<button
					type="button"
					onclick={handleFileImport}
					class="rounded-button border border-border px-4 py-2 text-sm font-medium"
				>
					Import
				</button>
				<a
					href={resolve('/rides/new')}
					class="rounded-button bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
				>
					Add a ride
				</a>
			</div>
		{/if}
	</header>

	{#if importStatus}
		<p class="mt-4 text-sm text-fg-muted" aria-live="polite">{importStatus}</p>
	{/if}

	{#if $rows?.length === 0}
		<div class="mt-12 flex flex-col items-center text-center">
			<p class="text-fg-muted">No rides yet.</p>
			<div class="mt-6 flex flex-col gap-3">
				<a
					href={resolve('/rides/new')}
					class="rounded-button bg-accent px-5 py-3 font-medium text-accent-fg"
				>
					Add a ride
				</a>
				<button
					type="button"
					onclick={handleFileImport}
					class="rounded-button border border-border px-5 py-3 font-medium"
				>
					Import GPX or FIT file
				</button>
			</div>
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
							onpointerdown={(e) => handlePointerDown(e, rideId)}
							onpointermove={(e) => handlePointerMove(e, rideId)}
							onpointerup={(e) => handlePointerUp(e, rideId)}
							onpointercancel={(e) => handlePointerUp(e, rideId)}
							class="relative touch-pan-y rounded-card border border-border bg-surface-elevated px-4 py-3 select-none {draggingRideId ===
							rideId
								? ''
								: 'transition-transform duration-150 ease-out'}"
							style="transform: translateX({transformFor(rideId)}px);"
						>
							<div class="flex items-start justify-between gap-3">
								<a
									href={resolve('/rides/[id]', { id: String(rideId) })}
									onkeydown={(e) => handleRowKeydown(e, row)}
									class="min-w-0 flex-1"
								>
									<p class="font-medium">{formatDistance(row.ride.distance_meters)}</p>
									<p class="text-sm text-fg-muted">
										{row.bike?.name ?? 'Unknown bike'} · {formatDate(row.ride.started_at)}
									</p>
								</a>
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

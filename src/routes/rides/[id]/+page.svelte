<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';

	const METERS_PER_MILE = 1609.344;
	const METERS_PER_FOOT = 0.3048;

	const rideId = $derived(Number(page.params.id));

	const data = liveQuery(async () => {
		const ride = await db.rides.get(rideId);
		if (!ride) return { notFound: true as const };
		const bike = await db.bikes.get(ride.bike_id);
		return { ride, bike };
	});

	let editing = $state(false);
	let editDistanceMiles = $state<number | ''>('');
	let editDate = $state('');
	let editDurationMinutes = $state<number | ''>('');
	let editElevationFeet = $state<number | ''>('');
	let editNotes = $state('');
	let editSaving = $state(false);
	let editError = $state('');

	function openEdit() {
		if (!$data || 'notFound' in $data) return;
		const r = $data.ride;
		editDistanceMiles = Math.round((r.distance_meters / METERS_PER_MILE) * 10) / 10;
		editDate = r.started_at.slice(0, 10);
		editDurationMinutes = r.duration_seconds != null ? Math.round(r.duration_seconds / 60) : '';
		editElevationFeet =
			r.elevation_gain_meters != null ? Math.round(r.elevation_gain_meters / METERS_PER_FOOT) : '';
		editNotes = r.notes ?? '';
		editError = '';
		editing = true;
	}

	async function handleSave(e: SubmitEvent) {
		e.preventDefault();
		if (editSaving || editDistanceMiles === '') return;
		editSaving = true;
		editError = '';
		try {
			const now = new Date().toISOString();
			await db.rides.update(rideId, {
				distance_meters: Math.round(editDistanceMiles * METERS_PER_MILE),
				started_at: new Date(editDate).toISOString(),
				duration_seconds:
					editDurationMinutes === '' ? undefined : Math.round(editDurationMinutes * 60),
				elevation_gain_meters:
					editElevationFeet === '' ? null : Math.round(editElevationFeet * METERS_PER_FOOT),
				notes: editNotes.trim() || undefined,
				updated_at: now
			});
			editing = false;
		} catch (err) {
			editError = err instanceof Error ? err.message : String(err);
		} finally {
			editSaving = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Delete this ride? This cannot be undone.')) return;
		try {
			await db.rides.delete(rideId);
			await goto(resolve('/rides'));
		} catch (err) {
			alert(`Delete failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Ride · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	{#if !$data}
		<p class="text-fg-muted">Loading…</p>
	{:else if 'notFound' in $data}
		<p class="text-fg-muted">Ride not found.</p>
		<a href={resolve('/rides')} class="mt-4 inline-block text-accent">← Back to rides</a>
	{:else}
		{@const ride = $data.ride}
		{@const bike = $data.bike}
		<header>
			<a href={resolve('/rides')} class="text-sm text-fg-muted">← Rides</a>
			<h1 class="mt-2 text-2xl font-semibold">
				{(ride.distance_meters / METERS_PER_MILE).toFixed(1)} mi
			</h1>
			<p class="text-fg-muted">{bike?.name ?? 'Unknown bike'} · {formatDate(ride.started_at)}</p>
		</header>

		{#if !editing}
			<section class="mt-8 rounded-card border border-border bg-surface-elevated p-5">
				<dl class="space-y-3 text-sm">
					<div class="flex justify-between">
						<dt class="text-fg-muted">Distance</dt>
						<dd>{(ride.distance_meters / METERS_PER_MILE).toFixed(1)} mi</dd>
					</div>
					<div class="flex justify-between">
						<dt class="text-fg-muted">Date</dt>
						<dd>{formatDate(ride.started_at)}</dd>
					</div>
					{#if ride.duration_seconds != null}
						<div class="flex justify-between">
							<dt class="text-fg-muted">Duration</dt>
							<dd>{Math.round(ride.duration_seconds / 60)} min</dd>
						</div>
					{/if}
					{#if ride.elevation_gain_meters != null}
						<div class="flex justify-between">
							<dt class="text-fg-muted">Elevation gain</dt>
							<dd>{Math.round(ride.elevation_gain_meters / METERS_PER_FOOT)} ft</dd>
						</div>
					{/if}
					<div class="flex justify-between">
						<dt class="text-fg-muted">Source</dt>
						<dd class="capitalize">{ride.source}</dd>
					</div>
				</dl>
				{#if ride.notes}
					<p class="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-fg-muted">
						{ride.notes}
					</p>
				{/if}
			</section>

			<div class="mt-6 flex gap-3">
				<button
					type="button"
					onclick={openEdit}
					class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
				>
					Edit
				</button>
				<button type="button" onclick={handleDelete} class="rounded-button px-5 py-2 text-danger">
					Delete
				</button>
			</div>
		{:else}
			<form onsubmit={handleSave} class="mt-8 space-y-4">
				<div>
					<label for="edit-distance" class="block text-sm font-medium">Distance (miles)</label>
					<input
						id="edit-distance"
						type="number"
						min="0"
						step="0.1"
						required
						bind:value={editDistanceMiles}
						class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
					/>
				</div>
				<div>
					<label for="edit-date" class="block text-sm font-medium">Date</label>
					<input
						id="edit-date"
						type="date"
						required
						bind:value={editDate}
						class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
					/>
				</div>
				<div>
					<label for="edit-duration" class="block text-sm font-medium">Duration (minutes)</label>
					<input
						id="edit-duration"
						type="number"
						min="0"
						step="1"
						bind:value={editDurationMinutes}
						class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
					/>
				</div>
				<div>
					<label for="edit-elevation" class="block text-sm font-medium">
						Elevation gain (feet)
					</label>
					<input
						id="edit-elevation"
						type="number"
						min="0"
						step="1"
						bind:value={editElevationFeet}
						class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
					/>
				</div>
				<div>
					<label for="edit-notes" class="block text-sm font-medium">Notes</label>
					<textarea
						id="edit-notes"
						rows="3"
						bind:value={editNotes}
						class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
					></textarea>
				</div>
				{#if editError}
					<p class="text-sm text-danger" aria-live="polite">{editError}</p>
				{/if}
				<div class="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={editSaving}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
					>
						{editSaving ? 'Saving…' : 'Save'}
					</button>
					<button
						type="button"
						onclick={() => (editing = false)}
						class="rounded-button px-5 py-2 font-medium text-fg-muted"
					>
						Cancel
					</button>
				</div>
			</form>
		{/if}
	{/if}
</main>

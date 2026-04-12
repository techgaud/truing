<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';

	const METERS_PER_MILE = 1609.344;
	const METERS_PER_FOOT = 0.3048;

	const bikes = liveQuery(() => db.bikes.filter((b) => !b.archived_at).toArray());

	let bikeId = $state<number | ''>('');
	let distanceMiles = $state<number | ''>('');
	let rideDate = $state(todayISO());
	let durationMinutes = $state<number | ''>('');
	let elevationFeet = $state<number | ''>('');
	let notes = $state('');
	let saving = $state(false);
	let error = $state('');

	function todayISO(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (saving || bikeId === '' || distanceMiles === '') return;
		saving = true;
		error = '';
		try {
			const now = new Date().toISOString();
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const startedAt = new Date(rideDate).toISOString();
			await db.rides.add({
				bike_id: bikeId,
				started_at: startedAt,
				started_at_tz: tz,
				distance_meters: Math.round(distanceMiles * METERS_PER_MILE),
				duration_seconds: durationMinutes === '' ? undefined : Math.round(durationMinutes * 60),
				elevation_gain_meters:
					elevationFeet === '' ? null : Math.round(elevationFeet * METERS_PER_FOOT),
				conditions: [],
				source: 'manual',
				notes: notes.trim() || undefined,
				created_at: now,
				updated_at: now
			});
			await goto(resolve('/rides'));
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Add a ride · Truing</title>
</svelte:head>

<main class="mx-auto max-w-md px-6 py-8">
	<h1 class="text-2xl font-semibold">Add a ride</h1>

	{#if $bikes && $bikes.length === 0}
		<p class="mt-6 text-fg-muted">Add a bike first, then come back to log rides for it.</p>
		<a
			href={resolve('/bikes/new')}
			class="mt-4 inline-block rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
		>
			Add a bike
		</a>
	{:else}
		<form onsubmit={handleSubmit} class="mt-6 space-y-4">
			<div>
				<label for="ride-bike" class="block text-sm font-medium">Bike</label>
				<select
					id="ride-bike"
					required
					bind:value={bikeId}
					class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
				>
					<option value="" disabled>Choose…</option>
					{#if $bikes}
						{#each $bikes as bike (bike.id)}
							<option value={bike.id}>{bike.name}</option>
						{/each}
					{/if}
				</select>
			</div>

			<div>
				<label for="ride-distance" class="block text-sm font-medium">Distance (miles)</label>
				<input
					id="ride-distance"
					type="number"
					min="0"
					step="0.1"
					required
					bind:value={distanceMiles}
					class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
				/>
			</div>

			<div>
				<label for="ride-date" class="block text-sm font-medium">Date</label>
				<input
					id="ride-date"
					type="date"
					required
					bind:value={rideDate}
					class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
				/>
			</div>

			<details class="rounded-card border border-border bg-surface-elevated px-4 py-3">
				<summary class="cursor-pointer text-sm font-medium">More details</summary>
				<div class="mt-4 space-y-4">
					<div>
						<label for="ride-duration" class="block text-sm font-medium">Duration (minutes)</label>
						<input
							id="ride-duration"
							type="number"
							min="0"
							step="1"
							bind:value={durationMinutes}
							class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
						/>
					</div>
					<div>
						<label for="ride-elevation" class="block text-sm font-medium">
							Elevation gain (feet)
						</label>
						<input
							id="ride-elevation"
							type="number"
							min="0"
							step="1"
							bind:value={elevationFeet}
							class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
						/>
					</div>
					<div>
						<label for="ride-notes" class="block text-sm font-medium">Notes</label>
						<textarea
							id="ride-notes"
							rows="3"
							bind:value={notes}
							class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
						></textarea>
					</div>
				</div>
			</details>

			{#if error}
				<p class="text-sm text-danger" aria-live="polite">{error}</p>
			{/if}

			<div class="flex gap-3 pt-2">
				<button
					type="submit"
					disabled={saving}
					class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Add ride'}
				</button>
				<a href={resolve('/rides')} class="rounded-button px-5 py-2 font-medium text-fg-muted">
					Cancel
				</a>
			</div>
		</form>
	{/if}
</main>

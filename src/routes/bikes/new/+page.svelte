<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { db, type BikeType } from '$lib/db';

	let name = $state('');
	let type = $state<BikeType | ''>('');
	let error = $state('');
	let saving = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (saving) return;
		saving = true;
		error = '';
		try {
			const now = new Date().toISOString();
			await db.bikes.add({
				name: name.trim(),
				type: type as BikeType,
				starting_odometer_meters: 0,
				created_at: now,
				updated_at: now
			});
			await goto(resolve('/'));
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Add a bike · Truing</title>
</svelte:head>

<main class="mx-auto max-w-md px-6 py-8">
	<h1 class="text-2xl font-semibold">Add a bike</h1>

	<form onsubmit={handleSubmit} class="mt-6 space-y-4">
		<div>
			<label for="bike-name" class="block text-sm font-medium">Name</label>
			<input
				id="bike-name"
				type="text"
				required
				bind:value={name}
				class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
			/>
		</div>

		<div>
			<label for="bike-type" class="block text-sm font-medium">Type</label>
			<select
				id="bike-type"
				required
				bind:value={type}
				class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
			>
				<option value="" disabled>Choose…</option>
				<option value="road">Road</option>
				<option value="gravel">Gravel</option>
				<option value="mtb">MTB</option>
				<option value="commuter">Commuter</option>
				<option value="ebike">E-bike</option>
				<option value="touring">Touring</option>
				<option value="other">Other</option>
			</select>
		</div>

		{#if error}
			<p class="text-sm text-danger" aria-live="polite">{error}</p>
		{/if}

		<div class="flex gap-3 pt-2">
			<button
				type="submit"
				disabled={saving}
				class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
			>
				{saving ? 'Saving…' : 'Add bike'}
			</button>
			<a href={resolve('/')} class="rounded-button px-5 py-2 font-medium text-fg-muted">Cancel</a>
		</div>
	</form>
</main>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { db, type BikeType } from '$lib/db';
	import { parseDistanceToMeters, distanceLabel } from '$lib/units';
	import { newBikeText, shareText } from '$lib/share';
	import { toast } from '$lib/toast';

	let name = $state('');
	let type = $state<BikeType | ''>('');
	let error = $state('');
	let saving = $state(false);

	let make = $state('');
	let model = $state('');
	let year = $state<number | ''>('');
	let purchaseDate = $state('');
	let purchasePrice = $state<number | ''>('');
	let purchaseCurrency = $state('USD');
	let startingOdometerMiles = $state<number | ''>('');

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
				make: make.trim() || undefined,
				model: model.trim() || undefined,
				year: year === '' ? undefined : year,
				purchase_date: purchaseDate || undefined,
				purchase_price_cents: purchasePrice === '' ? null : Math.round(purchasePrice * 100),
				purchase_currency: purchasePrice === '' ? null : purchaseCurrency,
				starting_odometer_meters:
					startingOdometerMiles === ''
						? 0
						: Math.round(parseDistanceToMeters(startingOdometerMiles)),
				created_at: now,
				updated_at: now
			});
			const text = newBikeText(name.trim(), {
				make: make.trim() || undefined,
				model: model.trim() || undefined,
				year: year === '' ? undefined : year
			});
			toast.success('Bike added!', { label: 'Share', onclick: () => shareText(text) });
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

		<details class="rounded-card border border-border bg-surface-elevated px-4 py-3">
			<summary class="cursor-pointer text-sm font-medium">More details</summary>
			<div class="mt-4 space-y-4">
				<div>
					<label for="bike-make" class="block text-sm font-medium">Make</label>
					<input
						id="bike-make"
						type="text"
						bind:value={make}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="bike-model" class="block text-sm font-medium">Model</label>
					<input
						id="bike-model"
						type="text"
						bind:value={model}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="bike-year" class="block text-sm font-medium">Year</label>
					<input
						id="bike-year"
						type="number"
						min="1900"
						max="2100"
						bind:value={year}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="bike-purchase-date" class="block text-sm font-medium">Purchase date</label>
					<input
						id="bike-purchase-date"
						type="date"
						bind:value={purchaseDate}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="bike-purchase-price" class="block text-sm font-medium">Purchase price</label>
					<div class="mt-1 flex gap-2">
						<input
							id="bike-purchase-price"
							type="number"
							min="0"
							step="0.01"
							bind:value={purchasePrice}
							class="flex-1 rounded-button border border-border bg-surface px-3 py-2"
						/>
						<select
							bind:value={purchaseCurrency}
							aria-label="Currency"
							class="rounded-button border border-border bg-surface px-3 py-2"
						>
							<option value="USD">USD</option>
							<option value="EUR">EUR</option>
							<option value="GBP">GBP</option>
							<option value="CAD">CAD</option>
							<option value="AUD">AUD</option>
							<option value="JPY">JPY</option>
						</select>
					</div>
				</div>
				<div>
					<label for="bike-odometer" class="block text-sm font-medium">
						Starting odometer ({distanceLabel()})
					</label>
					<input
						id="bike-odometer"
						type="number"
						min="0"
						step="1"
						bind:value={startingOdometerMiles}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
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
				{saving ? 'Saving…' : 'Add bike'}
			</button>
			<a href={resolve('/')} class="rounded-button px-5 py-2 font-medium text-fg-muted">Cancel</a>
		</div>
	</form>
</main>

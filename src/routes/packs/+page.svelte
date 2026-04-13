<script lang="ts">
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import { toast } from '$lib/toast';
	import {
		validatePack,
		findNewCustomTypes,
		applyPack,
		type Pack,
		type PackComponent
	} from '$lib/packs';

	type PackIndexEntry = {
		id: string;
		name: string;
		description: string;
		file: string;
		components: number;
	};

	let availablePacks = $state<PackIndexEntry[]>([]);
	let packsLoading = $state(false);

	let packData = $state<Pack | null>(null);
	let packChecked = $state<boolean[]>([]);
	let packNewTypes = $state<PackComponent[]>([]);
	let packNewTypesChecked = $state<boolean[]>([]);
	let packBikeId = $state<number | ''>('');
	let packCreateNew = $state(false);
	let packInstallDate = $state(todayISO());
	let packImporting = $state(false);

	const allBikes = liveQuery(() => db.bikes.filter((b) => !b.archived_at).toArray());

	function todayISO(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	async function loadAvailablePacks() {
		packsLoading = true;
		try {
			const res = await fetch('/packs/index.json');
			if (!res.ok) throw new Error(`${res.status}`);
			const data = await res.json();
			availablePacks = data.packs ?? [];
		} catch {
			toast.error('Could not load available packs.');
		} finally {
			packsLoading = false;
		}
	}

	async function downloadAndLoadPack(entry: PackIndexEntry) {
		try {
			const res = await fetch(`/packs/${entry.file}`);
			if (!res.ok) throw new Error(`${res.status}`);
			const text = await res.text();
			const data = JSON.parse(text);
			const pack = validatePack(data);
			packData = pack;
			packChecked = pack.components.map(() => true);
			const newTypes = findNewCustomTypes(pack);
			packNewTypes = newTypes;
			packNewTypesChecked = newTypes.map(() => true);
			packBikeId = '';
			packCreateNew = !!pack.bike;
			packInstallDate = todayISO();
			availablePacks = [];
		} catch (err) {
			toast.error(`Failed to load pack. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handlePackFileSelect() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.truing,.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				const pack = validatePack(data);
				packData = pack;
				packChecked = pack.components.map(() => true);
				const newTypes = findNewCustomTypes(pack);
				packNewTypes = newTypes;
				packNewTypesChecked = newTypes.map(() => true);
				packBikeId = '';
				packCreateNew = !!pack.bike;
				packInstallDate = todayISO();
			} catch (err) {
				toast.error(`Failed to load pack. ${err instanceof Error ? err.message : String(err)}`);
			}
		};
		input.click();
	}

	async function handlePackApply() {
		if (!packData) return;
		packImporting = true;
		try {
			let bikeId: number;
			if (packCreateNew && packData.bike) {
				const now = new Date().toISOString();
				bikeId = (await db.bikes.add({
					name: packData.name,
					make: packData.bike.make ?? undefined,
					model: packData.bike.model ?? undefined,
					year: packData.bike.year ?? undefined,
					type:
						(packData.bike.type as
							| 'road'
							| 'gravel'
							| 'mtb'
							| 'commuter'
							| 'ebike'
							| 'touring'
							| 'other') ?? undefined,
					starting_odometer_meters: 0,
					created_at: now,
					updated_at: now
				})) as number;
			} else {
				if (packBikeId === '') {
					toast.warning('Select a bike to apply the pack to.');
					packImporting = false;
					return;
				}
				bikeId = packBikeId;
			}
			const selectedComponents = packData.components.filter((_, i) => packChecked[i]);
			const selectedNewTypes = packNewTypes.filter((_, i) => packNewTypesChecked[i]);
			const result = await applyPack(bikeId, selectedComponents, selectedNewTypes, packInstallDate);
			toast.success(`Applied! ${result.added} component${result.added !== 1 ? 's' : ''} added.`);
			packData = null;
		} catch (err) {
			toast.error(`Apply failed. ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			packImporting = false;
		}
	}
</script>

<svelte:head>
	<title>Data Packs · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a href="/more" class="text-sm text-fg-muted">← More</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<h1 class="mt-2 text-2xl font-semibold">Data Packs</h1>
	<p class="mt-2 text-fg-muted">
		Import a .truing data pack to add components and service intervals for a specific bike build.
		Free packs are included. Paid packs with curated data for specific builds are coming soon.
	</p>

	{#if !packData}
		<div class="mt-6 flex flex-wrap gap-3">
			<button
				type="button"
				onclick={loadAvailablePacks}
				disabled={packsLoading}
				class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
			>
				{packsLoading ? 'Loading…' : 'Browse available packs'}
			</button>
			<button
				type="button"
				onclick={handlePackFileSelect}
				class="rounded-button border border-border px-5 py-2 font-medium"
			>
				Import from file
			</button>
		</div>

		{#if availablePacks.length > 0}
			<ul class="mt-6 space-y-3">
				{#each availablePacks as entry (entry.id)}
					<li class="rounded-card border border-border bg-surface-elevated p-4">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="font-medium">{entry.name}</p>
								<p class="mt-1 text-sm text-fg-muted">{entry.description}</p>
								<p class="mt-1 text-xs text-fg-muted">{entry.components} components</p>
							</div>
							<button
								type="button"
								onclick={() => downloadAndLoadPack(entry)}
								class="shrink-0 rounded-button bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg"
							>
								Use
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<div class="mt-6 rounded-card border border-border bg-surface-elevated p-4">
			<h2 class="text-lg font-semibold">{packData.name}</h2>
			{#if packData.description}
				<p class="text-sm text-fg-muted">{packData.description}</p>
			{/if}

			{#if packData.bike}
				<div class="mt-3 flex flex-wrap gap-3">
					<label class="flex items-center gap-2 text-sm">
						<input type="radio" bind:group={packCreateNew} value={true} />
						Create new bike
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="radio" bind:group={packCreateNew} value={false} />
						Apply to existing
					</label>
				</div>
			{/if}

			{#if !packCreateNew && $allBikes}
				<select
					bind:value={packBikeId}
					class="mt-2 w-full rounded-button border border-border bg-surface px-3 py-2 text-sm"
				>
					<option value="">Choose a bike…</option>
					{#each $allBikes as bike (bike.id)}
						<option value={bike.id}>{bike.name}</option>
					{/each}
				</select>
			{/if}

			<p class="mt-4 text-sm font-medium">
				Components ({packChecked.filter(Boolean).length} selected)
			</p>
			<ul class="mt-2 max-h-60 space-y-1 overflow-y-auto">
				{#each packData.components as comp, i (i)}
					<li>
						<label class="flex items-center gap-3 text-sm">
							<input type="checkbox" bind:checked={packChecked[i]} />
							<span>{comp.name}</span>
							<span class="text-fg-muted">({comp.category})</span>
						</label>
					</li>
				{/each}
			</ul>

			{#if packNewTypes.length > 0}
				<p class="mt-4 text-sm font-medium">
					New component types ({packNewTypesChecked.filter(Boolean).length} will be created)
				</p>
				<ul class="mt-2 space-y-1">
					{#each packNewTypes as ct, i (i)}
						<li>
							<label class="flex items-center gap-3 text-sm">
								<input type="checkbox" bind:checked={packNewTypesChecked[i]} />
								<span>{ct.name}</span>
								<span class="text-fg-muted">({ct.type})</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="mt-4">
				<label for="pack-install-date" class="block text-sm font-medium">Install date</label>
				<input
					id="pack-install-date"
					type="date"
					bind:value={packInstallDate}
					class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2 sm:w-64"
				/>
			</div>

			<div class="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					onclick={handlePackApply}
					disabled={packImporting}
					class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
				>
					{packImporting ? 'Applying…' : `Apply ${packChecked.filter(Boolean).length} components`}
				</button>
				<button
					type="button"
					onclick={() => (packData = null)}
					class="rounded-button px-5 py-2 font-medium text-fg-muted"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</main>

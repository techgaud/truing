<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db, type Component } from '$lib/db';
	import { componentTypeLabel } from '$lib/intervals';
	import { checkComponentShareable, shareText } from '$lib/share';
	import { toast } from '$lib/toast';
	import { formatDistanceInt } from '$lib/units';
	import { bikeActions, reactivateBike, deleteBike } from '$lib/bike-actions';
	import Fab from '$lib/components/Fab.svelte';
	import ActionMenu from '$lib/components/ActionMenu.svelte';
	import RetireBikeModal from '$lib/components/RetireBikeModal.svelte';
	import Pencil from 'lucide-svelte/icons/pencil';
	import { pickPhoto, resizeImage } from '$lib/photo';

	let retireBikeId = $state<number | null>(null);
	let retireBikeName = $state('');

	let editBikeId = $state<number | null>(null);
	let editName = $state('');
	let editType = $state('');
	let editMake = $state('');
	let editModel = $state('');
	let editYear = $state<number | ''>('');
	let editSaving = $state(false);
	let editPhotoPreview = $state<string | null>(null);
	let editPhotoBlob = $state<Blob | null>(null);

	function openQuickEdit(bike: BikeWithStats) {
		editBikeId = bike.id;
		editName = bike.name;
		editType = bike.type ?? '';
		editMake = bike.make ?? '';
		editModel = bike.model ?? '';
		editYear = bike.year ?? '';
		editPhotoPreview = null;
		editPhotoBlob = null;
	}

	async function handleEditPhoto() {
		try {
			const blob = await pickPhoto();
			if (!blob) return;
			const resized = await resizeImage(blob);
			editPhotoBlob = resized;
			editPhotoPreview = URL.createObjectURL(resized);
		} catch (err) {
			toast.error(`Photo failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	function removeEditPhoto() {
		if (editPhotoPreview) URL.revokeObjectURL(editPhotoPreview);
		editPhotoBlob = null;
		editPhotoPreview = null;
	}

	async function handleQuickEdit(e: SubmitEvent) {
		e.preventDefault();
		if (editSaving || !editBikeId || !editName.trim()) return;
		editSaving = true;
		try {
			const updates: Record<string, unknown> = {
				name: editName.trim(),
				type: (editType as BikeType) || undefined,
				make: editMake.trim() || undefined,
				model: editModel.trim() || undefined,
				year: editYear === '' ? undefined : editYear,
				updated_at: new Date().toISOString()
			};
			if (editPhotoBlob) {
				updates.photo_blob = editPhotoBlob;
			}
			await db.bikes.update(editBikeId, updates);
			editBikeId = null;
			toast.success('Bike updated.');
		} catch (err) {
			toast.error(`Update failed. ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			editSaving = false;
		}
	}

	import type { BikeType } from '$lib/db';

	type BikeWithStats = {
		id: number;
		name: string;
		type?: BikeType | undefined;
		make?: string | undefined;
		model?: string | undefined;
		year?: number | undefined;
		purchase_date?: string | undefined;
		archived_at?: string | null | undefined;
		odometerMeters: number;
		rideCount: number;
	};

	const allBikes = liveQuery<BikeWithStats[]>(async () => {
		const bikes = await db.bikes.toArray();
		const result: BikeWithStats[] = [];
		for (const bike of bikes) {
			if (bike.id === undefined) continue;
			const rides = await db.rides.where({ bike_id: bike.id }).toArray();
			const odometerMeters =
				bike.starting_odometer_meters + rides.reduce((sum, r) => sum + r.distance_meters, 0);
			result.push({
				id: bike.id,
				name: bike.name,
				type: bike.type,
				make: bike.make,
				model: bike.model,
				year: bike.year,
				purchase_date: bike.purchase_date,
				archived_at: bike.archived_at,
				odometerMeters,
				rideCount: rides.length
			});
		}
		return result;
	});

	const partsBin = liveQuery(async () => {
		const allComponents = await db.components.filter((c) => !c.retired_at).toArray();
		const result: Component[] = [];
		for (const comp of allComponents) {
			if (comp.id === undefined) continue;
			const activeInst = await db.installations
				.where({ component_id: comp.id })
				.filter((i) => !i.removed_at)
				.first();
			if (!activeInst) result.push(comp);
		}
		return result;
	});

	let filter = $state<'active' | 'archived'>('active');

	const filteredBikes = $derived.by(() => {
		if (!$allBikes) return undefined;
		if (filter === 'active') return $allBikes.filter((b) => !b.archived_at);
		return $allBikes.filter((b) => !!b.archived_at);
	});

	const activeCount = $derived($allBikes?.filter((b) => !b.archived_at).length ?? 0);
	const archivedCount = $derived($allBikes?.filter((b) => !!b.archived_at).length ?? 0);
	const activeBikes = $derived(
		$allBikes?.filter((b) => !b.archived_at && b.id !== undefined) ?? []
	);

	let installCompId = $state<number | null>(null);
	let installBikeId = $state<number | ''>('');
	let installDate = $state(todayISO());
	let installSaving = $state(false);

	function todayISO(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function openInstallModal(compId: number) {
		installCompId = compId;
		installBikeId = activeBikes.length === 1 ? (activeBikes[0]?.id ?? '') : '';
		installDate = todayISO();
		installSaving = false;
	}

	async function handleInstall() {
		if (!installCompId || installBikeId === '') return;
		installSaving = true;
		try {
			const now = new Date().toISOString();
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			await db.installations.add({
				component_id: installCompId,
				bike_id: installBikeId,
				installed_at: new Date(installDate).toISOString(),
				installed_at_tz: tz,
				created_at: now,
				updated_at: now
			});
			installCompId = null;
		} catch (err) {
			alert(`Install failed. ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			installSaving = false;
		}
	}

	async function handleRetire(compId: number) {
		if (!confirm('Retire this component? It will be removed from the parts bin permanently.'))
			return;
		const shareable = await checkComponentShareable(compId);
		await db.components.update(compId, {
			retired_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});
		if (shareable) {
			toast.success('Component retired.', {
				label: 'Share',
				onclick: () => shareText(shareable.text)
			});
		}
	}
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
				Retired ({archivedCount})
			</button>
		</div>
	{/if}

	{#if filteredBikes?.length === 0}
		<div class="mt-12 flex flex-col items-center text-center">
			{#if filter === 'archived'}
				<p class="text-fg-muted">No retired bikes.</p>
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
				<li class="flex items-center gap-2 rounded-card border border-border bg-surface-elevated">
					<a href={resolve('/bikes/[id]', { id: String(bike.id) })} class="block flex-1 px-4 py-3">
						<p class="font-medium">{bike.name}</p>
						<p class="text-sm text-fg-muted">
							{[bike.year, bike.make, bike.model].filter(Boolean).join(' ')}{bike.year ||
							bike.make ||
							bike.model
								? bike.type
									? ` · ${bike.type.charAt(0).toUpperCase() + bike.type.slice(1)}`
									: ''
								: bike.type
									? bike.type.charAt(0).toUpperCase() + bike.type.slice(1)
									: ''}
						</p>
						<p class="mt-1 text-sm text-fg-muted">
							{formatDistanceInt(bike.odometerMeters)} · {bike.rideCount} ride{bike.rideCount !== 1
								? 's'
								: ''}
						</p>
					</a>
					<button
						type="button"
						onclick={() => openQuickEdit(bike)}
						aria-label="Edit {bike.name}"
						class="shrink-0 p-3 text-fg-muted"
					>
						<Pencil size={16} />
					</button>
					<ActionMenu
						actions={bikeActions(bike.id, bike.name, !!bike.archived_at, {
							onRetire: () => {
								retireBikeId = bike.id;
								retireBikeName = bike.name;
							},
							onReactivate: () => reactivateBike(bike.id, bike.name),
							onDelete: () => deleteBike(bike.id, bike.name)
						})}
					/>
				</li>
			{/each}
		</ul>
	{/if}

	<Fab href={resolve('/bikes/new')} />

	{#if $partsBin && $partsBin.length > 0}
		<details class="mt-10">
			<summary class="cursor-pointer text-sm text-fg-muted">
				Parts bin ({$partsBin.length} uninstalled {$partsBin.length === 1
					? 'component'
					: 'components'})
			</summary>
			<ul class="mt-3 space-y-2">
				{#each $partsBin as comp (comp.id)}
					<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
						<div class="flex items-start justify-between gap-3">
							<a href={resolve('/components/[id]', { id: String(comp.id) })} class="min-w-0 flex-1">
								<p class="font-medium">{comp.name ?? componentTypeLabel(comp.type)}</p>
								<p class="text-sm text-fg-muted">{componentTypeLabel(comp.type)}</p>
							</a>
							<div class="flex shrink-0 gap-3">
								<button
									type="button"
									onclick={() => openInstallModal(comp.id!)}
									class="text-sm text-accent"
								>
									Install
								</button>
								<button
									type="button"
									onclick={() => handleRetire(comp.id!)}
									class="text-sm text-danger"
								>
									Retire
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</main>

{#if installCompId !== null}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="install-title"
			class="w-full max-w-md rounded-card bg-surface-elevated p-6"
		>
			<h2 id="install-title" class="text-lg font-semibold">Install on bike</h2>
			<div class="mt-4 space-y-4">
				<div>
					<label for="install-bike" class="block text-sm font-medium">Bike</label>
					<select
						id="install-bike"
						bind:value={installBikeId}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					>
						<option value="">Choose a bike…</option>
						{#each activeBikes as bike (bike.id)}
							<option value={bike.id}>{bike.name}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="install-date" class="block text-sm font-medium">Install date</label>
					<input
						id="install-date"
						type="date"
						bind:value={installDate}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={handleInstall}
						disabled={installSaving || installBikeId === ''}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
					>
						{installSaving ? 'Installing…' : 'Install'}
					</button>
					<button
						type="button"
						onclick={() => (installCompId = null)}
						class="rounded-button px-5 py-2 font-medium text-fg-muted"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

{#if editBikeId !== null}
	<div class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="quick-edit-title"
			class="w-full max-w-md rounded-card bg-surface-elevated p-6"
		>
			<h2 id="quick-edit-title" class="text-lg font-semibold">Edit bike</h2>
			<form onsubmit={handleQuickEdit} class="mt-4 space-y-4">
				<div>
					<label for="qe-name" class="block text-sm font-medium">Name</label>
					<input
						id="qe-name"
						type="text"
						required
						bind:value={editName}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="qe-type" class="block text-sm font-medium">Type</label>
					<select
						id="qe-type"
						bind:value={editType}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					>
						<option value="">None</option>
						<option value="road">Road</option>
						<option value="gravel">Gravel</option>
						<option value="mtb">MTB</option>
						<option value="commuter">Commuter</option>
						<option value="ebike">E-bike</option>
						<option value="touring">Touring</option>
						<option value="other">Other</option>
					</select>
				</div>
				<div>
					<label for="qe-make" class="block text-sm font-medium">Make</label>
					<input
						id="qe-make"
						type="text"
						bind:value={editMake}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="qe-model" class="block text-sm font-medium">Model</label>
					<input
						id="qe-model"
						type="text"
						bind:value={editModel}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="qe-year" class="block text-sm font-medium">Year</label>
					<input
						id="qe-year"
						type="number"
						min="1900"
						max="2100"
						bind:value={editYear}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<p class="block text-sm font-medium">Photo</p>
					{#if editPhotoPreview}
						<img
							src={editPhotoPreview}
							alt="Bike preview"
							class="mt-1 h-24 w-full rounded-card object-cover"
						/>
						<button type="button" onclick={removeEditPhoto} class="mt-1 text-sm text-danger">
							Remove
						</button>
					{:else}
						<button
							type="button"
							onclick={handleEditPhoto}
							class="mt-1 rounded-button border border-border px-4 py-2 text-sm font-medium"
						>
							Add photo
						</button>
					{/if}
				</div>
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
						onclick={() => (editBikeId = null)}
						class="rounded-button px-5 py-2 font-medium text-fg-muted"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if retireBikeId !== null}
	<RetireBikeModal
		bikeId={retireBikeId}
		bikeName={retireBikeName}
		onclose={() => (retireBikeId = null)}
	/>
{/if}

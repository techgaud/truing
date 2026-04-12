<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { liveQuery } from 'dexie';
	import { db } from '$lib/db';
	import serviceIntervals from '$lib/service_intervals.json';
	import templatesData from '$lib/component_templates.json';

	type ServiceInterval = {
		label: string;
		category: string;
		distance_meters: number | null;
		time_days: number | null;
		inspection_distance_meters: number | null;
		inspection_time_days: number | null;
		wear_multipliers_v2: Record<string, number>;
		notes: string;
	};
	type Template = {
		label: string;
		components: Array<{ type: string; default_name: string }>;
	};

	import {
		formatDistance,
		metersToDisplayUnit,
		parseDistanceToMeters,
		distanceLabel
	} from '$lib/units';
	import { formatCategory } from '$lib/intervals';
	import { exportBikeAsPack } from '$lib/packs';
	import ActionMenu from '$lib/components/ActionMenu.svelte';
	import Fab from '$lib/components/Fab.svelte';

	const intervals = serviceIntervals as Record<string, ServiceInterval>;
	const templates = templatesData as Record<string, Template>;

	const bikeId = $derived(Number(page.params.id));

	const bike = liveQuery(async () => (await db.bikes.get(bikeId)) ?? null);

	const installed = liveQuery(async () => {
		const insts = await db.installations.where({ bike_id: bikeId }).toArray();
		const active = insts.filter((i) => !i.removed_at);
		if (active.length === 0) return [];
		const comps = await db.components.bulkGet(active.map((i) => i.component_id));
		return active.map((inst, i) => ({ installation: inst, component: comps[i] }));
	});

	const recentRides = liveQuery(async () => {
		const rides = await db.rides.where({ bike_id: bikeId }).toArray();
		rides.sort((a, b) => b.started_at.localeCompare(a.started_at));
		return rides.slice(0, 5);
	});

	const currentTemplate = $derived.by(() => {
		const type = $bike?.type;
		if (!type || type === 'other') return null;
		const key = type === 'ebike' ? 'ebike' : `${type}_bike`;
		return templates[key] ?? null;
	});

	const groupedIntervals = Object.entries(
		Object.entries(intervals).reduce<Record<string, Array<[string, ServiceInterval]>>>(
			(acc, [key, entry]) => {
				(acc[entry.category] ??= []).push([key, entry]);
				return acc;
			},
			{}
		)
	);

	let showAddOne = $state(false);
	let showLoadTemplate = $state(false);

	let editingComponentId = $state<number | null>(null);
	let editingInstallationId = $state<number | null>(null);

	let addType = $state('');
	let addName = $state('');
	let addInstallDate = $state(todayISO());
	let addStartingWearMiles = $state<number | ''>('');
	let addIntervalDistanceMiles = $state<number | ''>('');
	let addIntervalTimeDays = $state<number | ''>('');
	let addPurchasePrice = $state<number | ''>('');
	let addPurchaseCurrency = $state('USD');
	let addNotes = $state('');
	let addSaving = $state(false);
	let addError = $state('');

	let templateChecked = $state<boolean[]>([]);
	let templateDates = $state<string[]>([]);
	let templateDefaultDate = $state(todayISO());
	let templateSaving = $state(false);
	let templateError = $state('');

	function todayISO(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	const MAX_PHOTO_DIM = 1024;
	const JPEG_QUALITY = 0.85;

	async function resizeImage(file: Blob): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			img.onload = () => {
				let { width, height } = img;
				if (width > MAX_PHOTO_DIM || height > MAX_PHOTO_DIM) {
					const scale = MAX_PHOTO_DIM / Math.max(width, height);
					width = Math.round(width * scale);
					height = Math.round(height * scale);
				}
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) return reject(new Error('Canvas not supported'));
				ctx.drawImage(img, 0, 0, width, height);
				canvas.toBlob(
					(blob) => (blob ? resolve(blob) : reject(new Error('Failed to create blob'))),
					'image/jpeg',
					JPEG_QUALITY
				);
			};
			img.onerror = () => reject(new Error('Failed to load image'));
			img.src = URL.createObjectURL(file);
		});
	}

	async function handlePhotoUpload() {
		try {
			const blob = await pickPhoto();
			if (!blob) return;
			const resized = await resizeImage(blob);
			await db.bikes.update(bikeId, {
				photo_blob: resized,
				updated_at: new Date().toISOString()
			});
		} catch (err) {
			alert(`Photo upload failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function pickPhoto(): Promise<Blob | null> {
		if (
			(
				window as { Capacitor?: { isNativePlatform?: () => boolean } }
			).Capacitor?.isNativePlatform?.()
		) {
			try {
				const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
				const photo = await Camera.getPhoto({
					quality: 90,
					allowEditing: false,
					resultType: CameraResultType.Uri,
					source: CameraSource.Prompt
				});
				if (!photo.webPath) return null;
				const res = await fetch(photo.webPath);
				return res.blob();
			} catch {
				// user cancelled or plugin unavailable
				return null;
			}
		}
		return new Promise((resolve) => {
			const input = document.createElement('input');
			input.type = 'file';
			input.accept = 'image/*';
			input.onchange = () => resolve(input.files?.[0] ?? null);
			input.click();
		});
	}

	async function handlePhotoRemove() {
		await db.bikes.update(bikeId, {
			photo_blob: null,
			updated_at: new Date().toISOString()
		});
	}

	function openAddOneModal() {
		editingComponentId = null;
		editingInstallationId = null;
		addType = '';
		addName = '';
		addInstallDate = todayISO();
		addStartingWearMiles = '';
		addIntervalDistanceMiles = '';
		addIntervalTimeDays = '';
		addPurchasePrice = '';
		addPurchaseCurrency = 'USD';
		addNotes = '';
		addError = '';
		showAddOne = true;
	}

	function openEditModal(componentId: number, installationId: number) {
		const row = $installed?.find((r) => r.installation.id === installationId);
		if (!row || !row.component) return;
		const c = row.component;
		editingComponentId = componentId;
		editingInstallationId = installationId;
		addType = c.type;
		addName = c.name ?? '';
		addInstallDate = row.installation.installed_at.slice(0, 10);
		addStartingWearMiles = c.initial_wear_meters ? metersToDisplayUnit(c.initial_wear_meters) : '';
		addIntervalDistanceMiles =
			c.replacement_interval_distance_meters_override != null
				? metersToDisplayUnit(c.replacement_interval_distance_meters_override)
				: '';
		addIntervalTimeDays = c.replacement_interval_time_days_override ?? '';
		addPurchasePrice = c.purchase_price_cents != null ? c.purchase_price_cents / 100 : '';
		addPurchaseCurrency = c.purchase_currency ?? 'USD';
		addNotes = c.notes ?? '';
		addError = '';
		showAddOne = true;
	}

	async function handleExportPack() {
		if (!$bike || !$installed) return;
		const comps = $installed
			.filter((r) => r.component)
			.map((r) => {
				const c = r.component!;
				const si = intervals[c.type];
				return {
					type: c.type,
					name: c.name ?? si?.label ?? c.type,
					category: si?.category ?? 'other',
					distance_meters:
						c.replacement_interval_distance_meters_override ?? si?.distance_meters ?? null,
					time_days: c.replacement_interval_time_days_override ?? si?.time_days ?? null,
					inspection_distance_meters: si?.inspection_distance_meters ?? null,
					inspection_time_days: si?.inspection_time_days ?? null,
					notes: si?.notes ?? null
				};
			});
		const json = exportBikeAsPack(
			$bike.name,
			{
				make: $bike.make,
				model: $bike.model,
				year: $bike.year,
				type: $bike.type
			},
			comps
		);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${$bike.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.truing`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleArchive() {
		if (!$bike) return;
		if (!confirm(`Archive ${$bike.name}? It will be hidden from the dashboard. Its history stays.`))
			return;
		try {
			const now = new Date().toISOString();
			await db.bikes.update(bikeId, { archived_at: now, updated_at: now });
			goto(resolve('/bikes'));
		} catch (err) {
			alert(`Archive failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handleUninstall(installationId: number) {
		if (
			!confirm(
				'Uninstall this component? It will move to your parts bin and can be reinstalled later.'
			)
		)
			return;
		try {
			const now = new Date().toISOString();
			await db.installations.update(installationId, {
				removed_at: now,
				updated_at: now
			});
		} catch (err) {
			alert(`Uninstall failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handleDelete(componentId: number) {
		if (!confirm('Delete this component? This cannot be undone.')) return;
		try {
			await db.transaction('rw', db.components, db.installations, async () => {
				await db.installations.where({ component_id: componentId }).delete();
				await db.components.delete(componentId);
			});
		} catch (err) {
			alert(`Delete failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	function openTemplateModal() {
		if (!currentTemplate) return;
		const today = todayISO();
		templateChecked = currentTemplate.components.map(() => true);
		templateDates = currentTemplate.components.map(() => today);
		templateDefaultDate = today;
		templateError = '';
		showLoadTemplate = true;
	}

	function applyDefaultToAllDates() {
		templateDates = templateDates.map(() => templateDefaultDate);
	}

	async function handleAddOne(e: SubmitEvent) {
		e.preventDefault();
		if (addSaving) return;
		addSaving = true;
		addError = '';
		try {
			const now = new Date().toISOString();
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const installedAt = new Date(addInstallDate).toISOString();
			const initialWearMeters =
				addStartingWearMiles === '' ? 0 : Math.round(parseDistanceToMeters(addStartingWearMiles));
			const intervalDistanceOverride =
				addIntervalDistanceMiles === ''
					? null
					: Math.round(parseDistanceToMeters(addIntervalDistanceMiles));
			const intervalTimeOverride = addIntervalTimeDays === '' ? null : addIntervalTimeDays;
			const priceCents = addPurchasePrice === '' ? null : Math.round(addPurchasePrice * 100);
			const currency = addPurchasePrice === '' ? null : addPurchaseCurrency;
			const notes = addNotes.trim() || undefined;
			if (editingComponentId !== null && editingInstallationId !== null) {
				const compId = editingComponentId;
				const instId = editingInstallationId;
				await db.transaction('rw', db.components, db.installations, async () => {
					await db.components.update(compId, {
						name: addName.trim() || undefined,
						initial_wear_meters: initialWearMeters,
						replacement_interval_distance_meters_override: intervalDistanceOverride,
						replacement_interval_time_days_override: intervalTimeOverride,
						purchase_price_cents: priceCents,
						purchase_currency: currency,
						notes,
						updated_at: now
					});
					await db.installations.update(instId, {
						installed_at: installedAt,
						updated_at: now
					});
				});
			} else {
				await db.transaction('rw', db.components, db.installations, async () => {
					const componentId = (await db.components.add({
						type: addType,
						name: addName.trim() || undefined,
						initial_wear_meters: initialWearMeters,
						replacement_interval_distance_meters_override: intervalDistanceOverride,
						replacement_interval_time_days_override: intervalTimeOverride,
						purchase_price_cents: priceCents,
						purchase_currency: currency,
						notes,
						created_at: now,
						updated_at: now
					})) as number;
					await db.installations.add({
						component_id: componentId,
						bike_id: bikeId,
						installed_at: installedAt,
						installed_at_tz: tz,
						created_at: now,
						updated_at: now
					});
				});
			}
			showAddOne = false;
		} catch (err) {
			addError = err instanceof Error ? err.message : String(err);
		} finally {
			addSaving = false;
		}
	}

	async function handleApplyTemplate() {
		if (templateSaving || !currentTemplate) return;
		const selectedEntries = currentTemplate.components
			.map((entry, i) => ({ entry, dateStr: templateDates[i] }))
			.filter((_, i) => templateChecked[i]);
		if (selectedEntries.length === 0) {
			templateError = 'Select at least one component.';
			return;
		}
		templateSaving = true;
		templateError = '';
		try {
			const now = new Date().toISOString();
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			await db.transaction('rw', db.components, db.installations, async () => {
				for (const { entry, dateStr } of selectedEntries) {
					const componentId = (await db.components.add({
						type: entry.type,
						name: entry.default_name,
						initial_wear_meters: 0,
						created_at: now,
						updated_at: now
					})) as number;
					await db.installations.add({
						component_id: componentId,
						bike_id: bikeId,
						installed_at: new Date(dateStr).toISOString(),
						installed_at_tz: tz,
						created_at: now,
						updated_at: now
					});
				}
			});
			showLoadTemplate = false;
		} catch (err) {
			templateError = err instanceof Error ? err.message : String(err);
		} finally {
			templateSaving = false;
		}
	}
</script>

<svelte:head>
	<title>{$bike?.name ?? 'Bike'} · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	{#if $bike === null}
		<p class="text-fg-muted">Bike not found.</p>
		<a href={resolve('/bikes')} class="mt-4 inline-block text-accent">← Back to bikes</a>
	{:else if $bike}
		<header>
			<a href={resolve('/bikes')} class="text-sm text-fg-muted">← Bikes</a>

			{#if $bike.photo_blob}
				{@const photoUrl = URL.createObjectURL($bike.photo_blob)}
				<img
					src={photoUrl}
					alt="Photo of {$bike.name}"
					class="mt-3 h-40 w-full rounded-card object-cover"
				/>
				<button type="button" onclick={handlePhotoRemove} class="mt-1 text-xs text-fg-muted">
					Remove photo
				</button>
			{:else}
				<button
					type="button"
					onclick={handlePhotoUpload}
					class="mt-3 flex h-24 w-full items-center justify-center rounded-card border-2 border-dashed border-border text-sm text-fg-muted"
				>
					Add photo
				</button>
			{/if}

			<div class="mt-3 flex items-start justify-between gap-3">
				<div>
					<h1 class="text-2xl font-semibold">{$bike.name}</h1>
					{#if $bike.type}
						<p class="text-fg-muted capitalize">{$bike.type}</p>
					{/if}
					{#if $installed}
						{@const totalSpendCents = $installed.reduce(
							(sum, r) => sum + (r.component?.purchase_price_cents ?? 0),
							0
						)}
						{#if totalSpendCents > 0}
							{@const partCount = $installed.filter(
								(r) => r.component?.purchase_price_cents
							).length}
							<p class="mt-1 text-sm text-fg-muted">
								Total components ${(totalSpendCents / 100).toFixed(2)} across {partCount} part{partCount !==
								1
									? 's'
									: ''}.
							</p>
						{/if}
					{/if}
					{#if $bike.archived_at}
						<p class="mt-2 text-sm text-fg-muted">Archived.</p>
					{/if}
				</div>
				<ActionMenu
					actions={[
						...(($installed?.length ?? 0) > 0
							? [{ label: 'Export as .truing pack', onclick: handleExportPack }]
							: []),
						...(!$bike.archived_at
							? [{ label: 'Archive this bike', onclick: handleArchive, danger: true }]
							: [])
					]}
				/>
			</div>
		</header>

		<section class="mt-8">
			<h2 class="text-lg font-semibold">Components</h2>

			{#if $installed?.length === 0}
				<div class="mt-6 rounded-card border border-border bg-surface-elevated p-6 text-center">
					<p class="text-fg-muted">No components yet. Add components to start tracking wear.</p>
					<div class="mt-6 flex flex-col gap-3">
						{#if currentTemplate}
							<button
								type="button"
								onclick={openTemplateModal}
								class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
							>
								Load typical {currentTemplate.label.toLowerCase()} list ({currentTemplate.components
									.length})
							</button>
						{/if}
						<button
							type="button"
							onclick={openAddOneModal}
							class="rounded-button border border-border px-5 py-2 font-medium"
						>
							Add one component
						</button>
					</div>
				</div>
			{:else if $installed}
				<ul class="mt-4 space-y-2">
					{#each $installed as row (row.installation.id)}
						{#if row.component && row.component.id !== undefined && row.installation.id !== undefined}
							{@const component = row.component}
							{@const installation = row.installation}
							<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
								<div class="flex items-start justify-between gap-3">
									<a
										href={resolve('/components/[id]', { id: String(component.id!) })}
										class="min-w-0 flex-1"
									>
										<p class="font-medium">
											{component.name ?? intervals[component.type]?.label ?? component.type}
										</p>
										<p class="text-sm text-fg-muted">
											{intervals[component.type]?.label ?? component.type}
										</p>
									</a>
									<div class="flex shrink-0 gap-3">
										<button
											type="button"
											onclick={() => openEditModal(component.id!, installation.id!)}
											class="text-sm text-accent"
										>
											Edit
										</button>
										<button
											type="button"
											onclick={() => handleUninstall(installation.id!)}
											class="text-sm text-fg-muted"
										>
											Uninstall
										</button>
										<button
											type="button"
											onclick={() => handleDelete(component.id!)}
											class="text-sm text-danger"
										>
											Delete
										</button>
									</div>
								</div>
							</li>
						{/if}
					{/each}
				</ul>
				<button
					type="button"
					onclick={openAddOneModal}
					class="mt-4 rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
				>
					Add one component
				</button>
			{/if}
		</section>

		<section class="mt-10">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold">Recent rides</h2>
				{#if $recentRides && $recentRides.length > 0}
					<a href={resolve('/rides')} class="text-sm text-accent">See all</a>
				{/if}
			</div>

			{#if $recentRides?.length === 0}
				<p class="mt-3 text-fg-muted">No rides yet for this bike.</p>
			{:else if $recentRides}
				<ul class="mt-3 space-y-2">
					{#each $recentRides as ride (ride.id)}
						<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium">
										{formatDistance(ride.distance_meters)}
									</p>
									<p class="text-sm text-fg-muted">
										{new Date(ride.started_at).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}
									</p>
								</div>
								<span
									class="shrink-0 rounded-button border border-border px-2 py-0.5 text-xs text-fg-muted capitalize"
								>
									{ride.source}
								</span>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>

{#if $bike && !$bike.archived_at}
	<Fab onclick={openAddOneModal} />
{/if}

{#if showAddOne}
	<div
		class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12"
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-one-title"
			class="w-full max-w-md rounded-card bg-surface-elevated p-6"
		>
			<h2 id="add-one-title" class="text-lg font-semibold">
				{editingComponentId !== null ? 'Edit component' : 'Add component'}
			</h2>
			<form onsubmit={handleAddOne} class="mt-4 space-y-4">
				<div>
					<label for="add-type" class="block text-sm font-medium">Type</label>
					{#if editingComponentId !== null}
						<p class="mt-1 text-fg-muted">{intervals[addType]?.label ?? addType}</p>
					{:else}
						<select
							id="add-type"
							required
							bind:value={addType}
							class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
						>
							<option value="" disabled>Choose…</option>
							{#each groupedIntervals as [category, items] (category)}
								<optgroup label={formatCategory(category)}>
									{#each items as [key, entry] (key)}
										<option value={key}>{entry.label}</option>
									{/each}
								</optgroup>
							{/each}
						</select>
					{/if}
				</div>
				<div>
					<label for="add-name" class="block text-sm font-medium">Name</label>
					<input
						id="add-name"
						type="text"
						bind:value={addName}
						placeholder="Optional"
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="add-date" class="block text-sm font-medium">Install date</label>
					<input
						id="add-date"
						type="date"
						required
						bind:value={addInstallDate}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<details class="rounded-card border border-border bg-surface px-3 py-2">
					<summary class="cursor-pointer text-sm font-medium">More details</summary>
					<div class="mt-4 space-y-4">
						<div>
							<label for="add-starting-wear" class="block text-sm font-medium">
								Starting wear ({distanceLabel()})
							</label>
							<p class="text-xs text-fg-muted">
								Prior wear when you added this component to Truing. Leave blank for brand new parts.
							</p>
							<input
								id="add-starting-wear"
								type="number"
								min="0"
								step="1"
								bind:value={addStartingWearMiles}
								class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
							/>
						</div>
						<div>
							<label for="add-interval-distance" class="block text-sm font-medium">
								Interval override, distance ({distanceLabel()})
							</label>
							<p class="text-xs text-fg-muted">
								Overrides the shipped default for this component type.
							</p>
							<input
								id="add-interval-distance"
								type="number"
								min="0"
								step="1"
								bind:value={addIntervalDistanceMiles}
								class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
							/>
						</div>
						<div>
							<label for="add-interval-time" class="block text-sm font-medium">
								Interval override, time (days)
							</label>
							<input
								id="add-interval-time"
								type="number"
								min="0"
								step="1"
								bind:value={addIntervalTimeDays}
								class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
							/>
						</div>
						<div>
							<label for="add-price" class="block text-sm font-medium">Purchase price</label>
							<div class="mt-1 flex gap-2">
								<input
									id="add-price"
									type="number"
									min="0"
									step="0.01"
									bind:value={addPurchasePrice}
									class="flex-1 rounded-button border border-border bg-surface-elevated px-3 py-2"
								/>
								<select
									bind:value={addPurchaseCurrency}
									aria-label="Currency"
									class="rounded-button border border-border bg-surface-elevated px-3 py-2"
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
							<label for="add-notes" class="block text-sm font-medium">Notes</label>
							<textarea
								id="add-notes"
								rows="3"
								bind:value={addNotes}
								class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
							></textarea>
						</div>
					</div>
				</details>
				{#if addError}
					<p class="text-sm text-danger" aria-live="polite">{addError}</p>
				{/if}
				<div class="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={addSaving}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
					>
						{addSaving ? 'Saving…' : editingComponentId !== null ? 'Save' : 'Add'}
					</button>
					<button
						type="button"
						onclick={() => (showAddOne = false)}
						class="rounded-button px-5 py-2 font-medium text-fg-muted"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if showLoadTemplate && currentTemplate}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="template-title"
			class="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card bg-surface-elevated p-6"
		>
			<h2 id="template-title" class="text-lg font-semibold">
				Typical {currentTemplate.label.toLowerCase()} components
			</h2>
			<p class="mt-2 text-sm text-fg-muted">
				Uncheck anything that doesn't apply. Each row has its own install date.
			</p>
			<div class="mt-4 rounded-card border border-border bg-surface p-3">
				<label for="template-default-date" class="block text-sm font-medium">
					Default install date
				</label>
				<div class="mt-1 flex gap-2">
					<input
						id="template-default-date"
						type="date"
						bind:value={templateDefaultDate}
						class="flex-1 rounded-button border border-border bg-surface-elevated px-3 py-2"
					/>
					<button
						type="button"
						onclick={applyDefaultToAllDates}
						class="rounded-button border border-border px-3 py-2 text-sm"
					>
						Apply to all
					</button>
				</div>
			</div>
			<ul class="mt-4 space-y-3">
				{#each currentTemplate.components as entry, i (i)}
					<li class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
						<label class="flex min-w-0 flex-1 items-center gap-3">
							<input type="checkbox" bind:checked={templateChecked[i]} />
							<span class="truncate">{entry.default_name}</span>
						</label>
						<input
							type="date"
							bind:value={templateDates[i]}
							disabled={!templateChecked[i]}
							class="rounded-button border border-border bg-surface px-2 py-1 text-sm disabled:opacity-50"
						/>
					</li>
				{/each}
			</ul>
			{#if templateError}
				<p class="mt-2 text-sm text-danger" aria-live="polite">{templateError}</p>
			{/if}
			<div class="mt-6 flex gap-3">
				<button
					type="button"
					onclick={handleApplyTemplate}
					disabled={templateSaving}
					class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
				>
					{templateSaving ? 'Saving…' : `Add ${templateChecked.filter(Boolean).length} selected`}
				</button>
				<button
					type="button"
					onclick={() => (showLoadTemplate = false)}
					class="rounded-button px-5 py-2 font-medium text-fg-muted"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
	import { page } from '$app/state';
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

	let addType = $state('');
	let addName = $state('');
	let addInstallDate = $state(todayISO());
	let addSaving = $state(false);
	let addError = $state('');

	let templateChecked = $state<boolean[]>([]);
	let templateInstallDate = $state(todayISO());
	let templateSaving = $state(false);
	let templateError = $state('');

	function todayISO(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function openAddOneModal() {
		addType = '';
		addName = '';
		addInstallDate = todayISO();
		addError = '';
		showAddOne = true;
	}

	function openTemplateModal() {
		if (!currentTemplate) return;
		templateChecked = currentTemplate.components.map(() => true);
		templateInstallDate = todayISO();
		templateError = '';
		showLoadTemplate = true;
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
			await db.transaction('rw', db.components, db.installations, async () => {
				const componentId = (await db.components.add({
					type: addType,
					name: addName.trim() || undefined,
					initial_wear_meters: 0,
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
			showAddOne = false;
		} catch (err) {
			addError = err instanceof Error ? err.message : String(err);
		} finally {
			addSaving = false;
		}
	}

	async function handleApplyTemplate() {
		if (templateSaving || !currentTemplate) return;
		const selected = currentTemplate.components.filter((_, i) => templateChecked[i]);
		if (selected.length === 0) {
			templateError = 'Select at least one component.';
			return;
		}
		templateSaving = true;
		templateError = '';
		try {
			const now = new Date().toISOString();
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const installedAt = new Date(templateInstallDate).toISOString();
			await db.transaction('rw', db.components, db.installations, async () => {
				for (const entry of selected) {
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
						installed_at: installedAt,
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
			<h1 class="mt-2 text-2xl font-semibold">{$bike.name}</h1>
			{#if $bike.type}
				<p class="text-fg-muted capitalize">{$bike.type}</p>
			{/if}
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
						{#if row.component}
							<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
								<p class="font-medium">
									{row.component.name ?? intervals[row.component.type]?.label ?? row.component.type}
								</p>
								<p class="text-sm text-fg-muted">
									{intervals[row.component.type]?.label ?? row.component.type}
								</p>
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
	{/if}
</main>

{#if showAddOne}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-one-title"
			class="w-full max-w-md rounded-card bg-surface-elevated p-6"
		>
			<h2 id="add-one-title" class="text-lg font-semibold">Add component</h2>
			<form onsubmit={handleAddOne} class="mt-4 space-y-4">
				<div>
					<label for="add-type" class="block text-sm font-medium">Type</label>
					<select
						id="add-type"
						required
						bind:value={addType}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					>
						<option value="" disabled>Choose…</option>
						{#each groupedIntervals as [category, items] (category)}
							<optgroup label={category}>
								{#each items as [key, entry] (key)}
									<option value={key}>{entry.label}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
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
				{#if addError}
					<p class="text-sm text-danger" aria-live="polite">{addError}</p>
				{/if}
				<div class="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={addSaving}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
					>
						{addSaving ? 'Saving…' : 'Add'}
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
			<p class="mt-2 text-sm text-fg-muted">Uncheck anything that doesn't apply.</p>
			<ul class="mt-4 space-y-2">
				{#each currentTemplate.components as entry, i (i)}
					<li>
						<label class="flex items-center gap-3">
							<input type="checkbox" bind:checked={templateChecked[i]} />
							<span>{entry.default_name}</span>
						</label>
					</li>
				{/each}
			</ul>
			<div class="mt-4">
				<label for="template-date" class="block text-sm font-medium">Install date</label>
				<input
					id="template-date"
					type="date"
					required
					bind:value={templateInstallDate}
					class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
				/>
			</div>
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

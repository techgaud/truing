<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db, type CustomComponentType } from '$lib/db';

	const types = liveQuery(() => db.custom_component_types.toArray());

	let showForm = $state(false);
	let editingType = $state<string | null>(null);
	let formType = $state('');
	let formLabel = $state('');
	let formCategory = $state('');
	let formDistanceMeters = $state<number | ''>('');
	let formTimeDays = $state<number | ''>('');
	let formNotes = $state('');
	let formSaving = $state(false);
	let formError = $state('');

	import { formatDistanceInt, metersToDisplayUnit, parseDistanceToMeters } from '$lib/units';

	function openAddForm() {
		editingType = null;
		formType = '';
		formLabel = '';
		formCategory = '';
		formDistanceMeters = '';
		formTimeDays = '';
		formNotes = '';
		formError = '';
		showForm = true;
	}

	function openEditForm(ct: CustomComponentType) {
		editingType = ct.type;
		formType = ct.type;
		formLabel = ct.label;
		formCategory = ct.category;
		formDistanceMeters =
			ct.default_distance_meters != null
				? Math.round(metersToDisplayUnit(ct.default_distance_meters))
				: '';
		formTimeDays = ct.default_time_days ?? '';
		formNotes = ct.notes ?? '';
		formError = '';
		showForm = true;
	}

	async function handleSave(e: SubmitEvent) {
		e.preventDefault();
		if (formSaving) return;
		const key = formType
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_|_$/g, '');
		if (!key || !formLabel.trim()) {
			formError = 'Type key and label are required.';
			return;
		}
		formSaving = true;
		formError = '';
		try {
			const now = new Date().toISOString();
			const data: CustomComponentType = {
				type: key,
				label: formLabel.trim(),
				category: formCategory.trim() || 'other',
				default_distance_meters:
					formDistanceMeters === '' ? null : Math.round(parseDistanceToMeters(formDistanceMeters)),
				default_time_days: formTimeDays === '' ? null : formTimeDays,
				notes: formNotes.trim() || undefined,
				created_at: editingType
					? ((await db.custom_component_types.get(key))?.created_at ?? now)
					: now,
				updated_at: now
			};
			await db.custom_component_types.put(data);
			showForm = false;
		} catch (err) {
			formError = err instanceof Error ? err.message : String(err);
		} finally {
			formSaving = false;
		}
	}

	async function handleDelete(key: string) {
		if (
			!confirm('Delete this custom type? Existing components using it will show as unknown type.')
		)
			return;
		await db.custom_component_types.delete(key);
	}
</script>

<svelte:head>
	<title>Custom Types · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<a href={resolve('/settings')} class="text-sm text-fg-muted">← Settings</a>
	<h1 class="mt-2 text-2xl font-semibold">Custom component types</h1>
	<p class="mt-2 text-sm text-fg-muted">
		Add component types that aren't in the shipped defaults. Useful for pannier racks, lights,
		fenders, and other accessories.
	</p>

	{#if $types && $types.length > 0}
		<ul class="mt-6 space-y-2">
			{#each $types as ct (ct.type)}
				<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<p class="font-medium">{ct.label}</p>
							<p class="text-sm text-fg-muted">
								{ct.category}
								{#if ct.default_distance_meters != null}
									· {formatDistanceInt(ct.default_distance_meters)}
								{/if}
								{#if ct.default_time_days != null}
									· {ct.default_time_days} days
								{/if}
							</p>
						</div>
						<div class="flex shrink-0 gap-3">
							<button type="button" onclick={() => openEditForm(ct)} class="text-sm text-accent">
								Edit
							</button>
							<button
								type="button"
								onclick={() => handleDelete(ct.type)}
								class="text-sm text-danger"
							>
								Delete
							</button>
						</div>
					</div>
				</li>
			{/each}
		</ul>
	{:else if $types}
		<p class="mt-6 text-fg-muted">No custom types yet.</p>
	{/if}

	{#if !showForm}
		<button
			type="button"
			onclick={openAddForm}
			class="mt-6 rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
		>
			Add custom type
		</button>
	{/if}
</main>

{#if showForm}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="ct-title"
			class="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card bg-surface-elevated p-6"
		>
			<h2 id="ct-title" class="text-lg font-semibold">
				{editingType ? 'Edit custom type' : 'Add custom type'}
			</h2>
			<form onsubmit={handleSave} class="mt-4 space-y-4">
				<div>
					<label for="ct-type" class="block text-sm font-medium">
						Type key (lowercase, underscores)
					</label>
					<input
						id="ct-type"
						type="text"
						required
						disabled={editingType !== null}
						bind:value={formType}
						placeholder="pannier_rack"
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2 disabled:opacity-50"
					/>
				</div>
				<div>
					<label for="ct-label" class="block text-sm font-medium">Display name</label>
					<input
						id="ct-label"
						type="text"
						required
						bind:value={formLabel}
						placeholder="Rear pannier rack"
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="ct-category" class="block text-sm font-medium">Category</label>
					<input
						id="ct-category"
						type="text"
						bind:value={formCategory}
						placeholder="accessories"
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="ct-distance" class="block text-sm font-medium">
						Default distance interval (miles)
					</label>
					<input
						id="ct-distance"
						type="number"
						min="0"
						step="1"
						bind:value={formDistanceMeters}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="ct-time" class="block text-sm font-medium">
						Default time interval (days)
					</label>
					<input
						id="ct-time"
						type="number"
						min="0"
						step="1"
						bind:value={formTimeDays}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="ct-notes" class="block text-sm font-medium">Notes</label>
					<textarea
						id="ct-notes"
						rows="2"
						bind:value={formNotes}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					></textarea>
				</div>
				{#if formError}
					<p class="text-sm text-danger" aria-live="polite">{formError}</p>
				{/if}
				<div class="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={formSaving}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
					>
						{formSaving ? 'Saving…' : editingType ? 'Save' : 'Add'}
					</button>
					<button
						type="button"
						onclick={() => (showForm = false)}
						class="rounded-button px-5 py-2 font-medium text-fg-muted"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

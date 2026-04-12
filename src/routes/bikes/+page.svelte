<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db, type Component } from '$lib/db';
	import { componentTypeLabel } from '$lib/intervals';

	const allBikes = liveQuery(() => db.bikes.toArray());

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
		installBikeId = activeBikes.length === 1 ? activeBikes[0].id! : '';
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
		await db.components.update(compId, {
			retired_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		});
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
				Archived ({archivedCount})
			</button>
		</div>
	{/if}

	{#if filteredBikes?.length === 0}
		<div class="mt-12 flex flex-col items-center text-center">
			{#if filter === 'archived'}
				<p class="text-fg-muted">No archived bikes.</p>
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
				<li>
					<a
						href={resolve('/bikes/[id]', { id: String(bike.id) })}
						class="block rounded-card border border-border bg-surface-elevated px-4 py-3"
					>
						<p class="font-medium">{bike.name}</p>
						{#if bike.type}
							<p class="text-sm text-fg-muted capitalize">{bike.type}</p>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	{/if}

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

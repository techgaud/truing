<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db, type Component } from '$lib/db';
	import { componentTypeLabel } from '$lib/intervals';
	import { checkComponentShareable, shareText } from '$lib/share';
	import { toast } from '$lib/toast';

	const allBikes = liveQuery(() => db.bikes.filter((b) => !b.archived_at).toArray());

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

	let installCompId = $state<number | null>(null);
	let installBikeId = $state<number | ''>('');
	let installDate = $state(todayISO());
	let installSaving = $state(false);

	function todayISO(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function openInstallModal(compId: number) {
		const bikes = $allBikes ?? [];
		installCompId = compId;
		const only = bikes.length === 1 ? bikes[0] : undefined;
		installBikeId = only?.id ?? '';
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
	<title>Parts Bin · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<h1 class="text-2xl font-semibold">Parts Bin</h1>
	<p class="mt-2 text-sm text-fg-muted">
		Components that have been uninstalled but not retired. Install them on a bike or retire them
		when they are done.
	</p>

	{#if $partsBin?.length === 0}
		<p class="mt-8 text-center text-fg-muted">
			No loose parts. Everything is installed or retired.
		</p>
	{:else if $partsBin}
		<ul class="mt-6 space-y-2">
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
			<h2 id="install-title" class="text-lg font-semibold">Install on Bike</h2>
			<div class="mt-4 space-y-4">
				<div>
					<label for="install-bike" class="block text-sm font-medium">Bike</label>
					<select
						id="install-bike"
						bind:value={installBikeId}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					>
						<option value="">Choose a bike…</option>
						{#if $allBikes}
							{#each $allBikes as bike (bike.id)}
								<option value={bike.id}>{bike.name}</option>
							{/each}
						{/if}
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

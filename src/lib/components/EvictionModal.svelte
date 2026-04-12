<script lang="ts">
	import { importAll } from '$lib/backup';
	import { writeCanary, startFresh } from '$lib/storage';
	import { isIOSSafari, isStandalonePWA } from '$lib/platform';

	let { onresolved }: { onresolved: () => void } = $props();
	let importing = $state(false);
	let status = $state('');

	async function handleRestore() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			importing = true;
			status = '';
			try {
				const text = await file.text();
				await importAll(text);
				await writeCanary();
				onresolved();
			} catch (err) {
				status = `Restore failed. ${err instanceof Error ? err.message : String(err)}`;
				importing = false;
			}
		};
		input.click();
	}

	async function handleStartFresh() {
		if (!confirm('Start over with no data? This cannot be undone.')) return;
		await startFresh();
		onresolved();
	}
</script>

<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
	<div
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="eviction-title"
		class="w-full max-w-md rounded-card bg-surface-elevated p-6"
	>
		<h2 id="eviction-title" class="text-lg font-semibold">Your data was cleared</h2>
		<p class="mt-3 text-sm text-fg-muted">
			This can happen if your browser ran low on space, you cleared site data, or you haven't
			visited in a while. You can restore from a backup file or start over.
		</p>

		{#if isIOSSafari() && !isStandalonePWA()}
			<p class="mt-3 rounded-card bg-warning/10 p-3 text-sm">
				To prevent this in the future, install Truing as a PWA. Tap the share button below and
				select "Add to Home Screen." Installed apps keep their data.
			</p>
		{/if}

		{#if status}
			<p class="mt-3 text-sm text-danger" aria-live="polite">{status}</p>
		{/if}

		<div class="mt-6 flex flex-col gap-3">
			<button
				type="button"
				onclick={handleRestore}
				disabled={importing}
				class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
			>
				{importing ? 'Restoring…' : 'Restore from backup file'}
			</button>
			<button
				type="button"
				onclick={handleStartFresh}
				class="rounded-button border border-border px-5 py-2 font-medium"
			>
				Start fresh
			</button>
		</div>
	</div>
</div>

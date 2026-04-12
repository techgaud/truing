<script lang="ts">
	import { exportAll, importAll } from '$lib/backup';

	let importing = $state(false);
	let exportStatus = $state('');
	let importStatus = $state('');

	async function handleExport() {
		exportStatus = '';
		try {
			const json = await exportAll();
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `truing-backup-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			exportStatus = 'Backup downloaded.';
		} catch (err) {
			exportStatus = `Export failed. ${err instanceof Error ? err.message : String(err)}`;
		}
	}

	async function handleImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			if (!confirm('Importing will replace all your current data. Continue?')) return;
			importing = true;
			importStatus = '';
			try {
				const text = await file.text();
				const counts = await importAll(text);
				importStatus = `Imported ${counts.bikes} bikes, ${counts.components} components, ${counts.rides} rides, ${counts.serviceLog} service log entries.`;
			} catch (err) {
				importStatus = `Import failed. ${err instanceof Error ? err.message : String(err)}`;
			} finally {
				importing = false;
			}
		};
		input.click();
	}
</script>

<svelte:head>
	<title>Settings · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<h1 class="text-2xl font-semibold">Settings</h1>

	<section class="mt-8">
		<h2 class="text-lg font-semibold">Data</h2>
		<p class="mt-2 text-sm text-fg-muted">
			Export your data as a JSON file for backup. Import to restore from a previous backup.
		</p>
		<div class="mt-4 flex flex-wrap gap-3">
			<button
				type="button"
				onclick={handleExport}
				class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
			>
				Export backup
			</button>
			<button
				type="button"
				onclick={handleImport}
				disabled={importing}
				class="rounded-button border border-border px-5 py-2 font-medium disabled:opacity-50"
			>
				{importing ? 'Importing…' : 'Import backup'}
			</button>
		</div>
		{#if exportStatus}
			<p class="mt-3 text-sm text-fg-muted" aria-live="polite">{exportStatus}</p>
		{/if}
		{#if importStatus}
			<p class="mt-3 text-sm text-fg-muted" aria-live="polite">{importStatus}</p>
		{/if}
	</section>
</main>

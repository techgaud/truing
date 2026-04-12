<script lang="ts">
	import { importAll } from '$lib/backup';
	import { writeCanary, startFresh } from '$lib/storage';
	import { getPremigrationBackup, clearPremigrationBackup } from '$lib/premigration';

	let { onresolved }: { onresolved: () => void } = $props();
	let restoring = $state(false);
	let status = $state('');
	let hasAutoBackup = $state(false);
	let autoBackupDate = $state('');

	getPremigrationBackup().then((b) => {
		if (b) {
			hasAutoBackup = true;
			autoBackupDate = new Date(b.exportedAt).toLocaleDateString();
		}
	});

	async function handleRestoreAutoBackup() {
		restoring = true;
		status = '';
		try {
			const backup = await getPremigrationBackup();
			if (!backup) {
				status = 'Auto-backup not found.';
				restoring = false;
				return;
			}
			await importAll(backup.json, 'replace');
			await writeCanary();
			await clearPremigrationBackup();
			onresolved();
		} catch (err) {
			status = `Restore failed. ${err instanceof Error ? err.message : String(err)}`;
			restoring = false;
		}
	}

	async function handleRestoreFromFile() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			restoring = true;
			status = '';
			try {
				const text = await file.text();
				await importAll(text, 'replace');
				await writeCanary();
				onresolved();
			} catch (err) {
				status = `Restore failed. ${err instanceof Error ? err.message : String(err)}`;
				restoring = false;
			}
		};
		input.click();
	}

	async function handleStartFresh() {
		if (!confirm('Start over with no data? This cannot be undone.')) return;
		await startFresh();
		await clearPremigrationBackup();
		onresolved();
	}
</script>

<div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
	<div
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="migration-title"
		class="w-full max-w-md rounded-card bg-surface-elevated p-6"
	>
		<h2 id="migration-title" class="text-lg font-semibold">Database upgrade failed</h2>
		<p class="mt-3 text-sm text-fg-muted">
			Something went wrong while upgrading the database to the latest version. Your data may be
			incomplete or corrupted.
		</p>

		{#if hasAutoBackup}
			<p class="mt-3 rounded-card bg-accent/10 p-3 text-sm">
				An automatic backup was saved before the upgrade ({autoBackupDate}). Restoring it is the
				safest option.
			</p>
		{/if}

		{#if status}
			<p class="mt-3 text-sm text-danger" aria-live="polite">{status}</p>
		{/if}

		<div class="mt-6 flex flex-col gap-3">
			{#if hasAutoBackup}
				<button
					type="button"
					onclick={handleRestoreAutoBackup}
					disabled={restoring}
					class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
				>
					{restoring ? 'Restoring…' : 'Restore auto-backup'}
				</button>
			{/if}
			<button
				type="button"
				onclick={handleRestoreFromFile}
				disabled={restoring}
				class="rounded-button border border-border px-5 py-2 font-medium disabled:opacity-50"
			>
				{restoring ? 'Restoring…' : 'Restore from backup file'}
			</button>
			<button
				type="button"
				onclick={handleStartFresh}
				class="rounded-button border border-border px-5 py-2 font-medium text-fg-muted"
			>
				Start fresh
			</button>
		</div>
	</div>
</div>

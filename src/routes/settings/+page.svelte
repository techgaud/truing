<script lang="ts">
	import { liveQuery } from 'dexie';
	import { exportAll, importAll } from '$lib/backup';
	import { db } from '$lib/db';
	import { encryptField } from '$lib/crypto';

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

	const stravaAuth = liveQuery(() => db.strava_auth.get(1));

	let stravaClientId = $state('');
	let stravaClientSecret = $state('');
	let stravaSaving = $state(false);
	let stravaStatus = $state('');

	const stravaConnected = $derived(
		$stravaAuth?.access_token != null && $stravaAuth.access_token.length > 0
	);

	async function handleStravaSave() {
		if (!stravaClientId.trim() || !stravaClientSecret.trim()) {
			stravaStatus = 'Both fields are required.';
			return;
		}
		stravaSaving = true;
		stravaStatus = '';
		try {
			const encrypted = await encryptField(stravaClientSecret.trim());
			await db.strava_auth.put({
				id: 1,
				client_id: stravaClientId.trim(),
				client_secret: encrypted,
				access_token: new Uint8Array(),
				refresh_token: new Uint8Array(),
				expires_at: 0,
				athlete_id: 0,
				athlete_username: '',
				measurement_preference: 'feet'
			});
			stravaStatus = 'Credentials saved. Now connect to authorize.';
		} catch (err) {
			stravaStatus = `Save failed. ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			stravaSaving = false;
		}
	}

	function handleStravaConnect() {
		if (!$stravaAuth?.client_id) {
			stravaStatus = 'Save your credentials first.';
			return;
		}
		const params = new URLSearchParams({
			client_id: $stravaAuth.client_id,
			redirect_uri: `${window.location.origin}/strava-callback`,
			response_type: 'code',
			scope: 'activity:read_all',
			approval_prompt: 'auto'
		});
		window.location.href = `https://www.strava.com/oauth/authorize?${params}`;
	}

	async function handleStravaDisconnect() {
		if (
			!confirm('Disconnect from Strava? Your synced rides will stay but no new syncs will happen.')
		)
			return;
		await db.strava_auth.delete(1);
		stravaClientId = '';
		stravaClientSecret = '';
		stravaStatus = 'Disconnected.';
	}

	$effect(() => {
		if ($stravaAuth) {
			stravaClientId = $stravaAuth.client_id ?? '';
		}
	});
</script>

<svelte:head>
	<title>Settings · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<h1 class="text-2xl font-semibold">Settings</h1>

	<section class="mt-8">
		<h2 class="text-lg font-semibold">Strava</h2>
		{#if stravaConnected}
			<div class="mt-3 rounded-card border border-border bg-surface-elevated p-4">
				<p class="text-sm">
					Connected as <span class="font-medium">{$stravaAuth?.athlete_username || 'unknown'}</span
					>.
				</p>
				<button type="button" onclick={handleStravaDisconnect} class="mt-3 text-sm text-danger">
					Disconnect
				</button>
			</div>
		{:else}
			<p class="mt-2 text-sm text-fg-muted">
				Truing uses a bring-your-own-token model. You create your own Strava API app and paste the
				credentials here. No shared server, no rate limits, full control.
			</p>
			<details class="mt-3 rounded-card border border-border bg-surface-elevated px-4 py-3">
				<summary class="cursor-pointer text-sm font-medium">How to set up Strava</summary>
				<ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-fg-muted">
					<li>
						Go to <a
							href="https://www.strava.com/settings/api"
							target="_blank"
							rel="noopener"
							class="text-accent">strava.com/settings/api</a
						>
					</li>
					<li>Create an application (any name and website are fine)</li>
					<li>Set "Authorization Callback Domain" to <span class="font-mono">truing.app</span></li>
					<li>Copy the Client ID and Client Secret below</li>
					<li>Save, then click Connect</li>
				</ol>
			</details>
			<div class="mt-4 space-y-4">
				<div>
					<label for="strava-client-id" class="block text-sm font-medium">Client ID</label>
					<input
						id="strava-client-id"
						type="text"
						bind:value={stravaClientId}
						class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
					/>
				</div>
				<div>
					<label for="strava-client-secret" class="block text-sm font-medium">Client Secret</label>
					<input
						id="strava-client-secret"
						type="password"
						bind:value={stravaClientSecret}
						placeholder="Paste from Strava"
						class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2"
					/>
				</div>
				<div class="flex flex-wrap gap-3">
					<button
						type="button"
						onclick={handleStravaSave}
						disabled={stravaSaving}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
					>
						{stravaSaving ? 'Saving…' : 'Save credentials'}
					</button>
					{#if $stravaAuth?.client_id}
						<button
							type="button"
							onclick={handleStravaConnect}
							class="rounded-button border border-border px-5 py-2 font-medium"
						>
							Connect to Strava
						</button>
					{/if}
				</div>
			</div>
		{/if}
		{#if stravaStatus}
			<p class="mt-3 text-sm text-fg-muted" aria-live="polite">{stravaStatus}</p>
		{/if}
	</section>

	<section class="mt-10">
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

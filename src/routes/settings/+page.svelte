<script lang="ts">
	import { liveQuery } from 'dexie';
	import { exportAll, importAll, backupFilename, getLastBackupAge } from '$lib/backup';
	import { db } from '$lib/db';
	import { encryptField, hasSessionKey, unlockWithPassphrase } from '$lib/crypto';
	import { getStorageEstimate, type StorageEstimate } from '$lib/storage';
	import { fetchStravaGear, type StravaGear } from '$lib/strava';
	import { setShortcutMode, getShortcutMode, type ShortcutMode } from '$lib/shortcuts';
	import {
		setUnitPreference,
		getUnitPreference,
		loadUnitPreference,
		formatDistanceInt,
		type UnitSystem
	} from '$lib/units';

	loadUnitPreference();

	let storageInfo = $state<StorageEstimate | null>(null);
	getStorageEstimate().then((est) => (storageInfo = est));

	let importing = $state(false);
	let exportStatus = $state('');
	let importStatus = $state('');
	let lastBackupDays = $state<number | null>(null);
	getLastBackupAge().then((d) => (lastBackupDays = d));

	async function handleExport() {
		exportStatus = '';
		try {
			const json = await exportAll();
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = backupFilename();
			a.click();
			URL.revokeObjectURL(url);
			exportStatus = 'Backup downloaded.';
			lastBackupDays = 0;
		} catch (err) {
			exportStatus = `Export failed. ${err instanceof Error ? err.message : String(err)}`;
		}
	}

	async function handleImport(mode: 'replace' | 'merge') {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			if (mode === 'replace') {
				if (!confirm('This will replace all your current data with the backup file. Continue?'))
					return;
			}
			importing = true;
			importStatus = '';
			try {
				const text = await file.text();
				const result = await importAll(text, mode);
				if (mode === 'replace') {
					importStatus = `Restored ${result.bikes.added} bikes, ${result.rides.added} rides, ${result.serviceLog.added} service log entries.`;
				} else {
					const parts = [];
					if (result.bikes.added) parts.push(`${result.bikes.added} new bikes`);
					if (result.bikes.skipped) parts.push(`${result.bikes.skipped} bikes skipped`);
					if (result.rides.added) parts.push(`${result.rides.added} new rides`);
					if (result.rides.skipped) parts.push(`${result.rides.skipped} rides skipped`);
					if (result.serviceLog.added) parts.push(`${result.serviceLog.added} new service entries`);
					if (result.serviceLog.skipped)
						parts.push(`${result.serviceLog.skipped} service entries skipped`);
					importStatus =
						parts.length > 0 ? `Merged. ${parts.join(', ')}.` : 'Nothing new to import.';
				}
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
	let passphrase = $state('');
	let keyUnlocked = $state(hasSessionKey());

	let stravaGear = $state<StravaGear[]>([]);
	let gearLoading = $state(false);
	let gearMapping = $state<Record<string, number | ''>>({});

	const allBikes = liveQuery(() => db.bikes.filter((b) => !b.archived_at).toArray());

	async function loadStravaGear() {
		gearLoading = true;
		try {
			stravaGear = await fetchStravaGear();
			const bikes = (await db.bikes.toArray()).filter((b) => !b.archived_at);
			gearMapping = {};
			for (const gear of stravaGear) {
				const linked = bikes.find((b) => b.strava_gear_id === gear.id);
				gearMapping[gear.id] = linked?.id ?? '';
			}
		} catch (err) {
			stravaStatus = `Failed to load gear. ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			gearLoading = false;
		}
	}

	async function saveGearMapping() {
		const bikes = await db.bikes.toArray();
		const now = new Date().toISOString();
		for (const bike of bikes) {
			if (bike.id === undefined) continue;
			const linkedGearId = Object.entries(gearMapping).find(
				([, bikeId]) => bikeId === bike.id
			)?.[0];
			if (bike.strava_gear_id !== (linkedGearId ?? null)) {
				await db.bikes.update(bike.id, {
					strava_gear_id: linkedGearId ?? null,
					updated_at: now
				});
			}
		}
		stravaStatus = 'Gear mapping saved.';
	}

	const stravaConnected = $derived(
		$stravaAuth?.access_token != null && $stravaAuth.access_token.length > 0
	);

	async function handleUnlock() {
		if (!passphrase) return;
		try {
			await unlockWithPassphrase(passphrase);
			keyUnlocked = true;
			passphrase = '';
			stravaStatus = 'Unlocked.';
		} catch (err) {
			stravaStatus = `Unlock failed. ${err instanceof Error ? err.message : String(err)}`;
		}
	}

	async function handleStravaSave() {
		if (!keyUnlocked) {
			stravaStatus = 'Unlock with your passphrase first.';
			return;
		}
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
		<h2 class="text-lg font-semibold">General</h2>
		<div class="mt-3">
			<label for="unit-system" class="block text-sm font-medium">Distance units</label>
			<select
				id="unit-system"
				value={getUnitPreference()}
				onchange={(e) => setUnitPreference((e.target as HTMLSelectElement).value as UnitSystem)}
				class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2 sm:w-64"
			>
				<option value="imperial">Miles</option>
				<option value="metric">Kilometers</option>
			</select>
		</div>
		<div class="mt-4">
			<p class="text-sm font-medium">Timezone</p>
			<p class="mt-1 text-sm text-fg-muted">{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
			<p class="mt-1 text-xs text-fg-muted">
				Truing uses your device timezone for all dates. This is detected automatically.
			</p>
		</div>
		<div class="mt-4">
			<label for="shortcut-mode" class="block text-sm font-medium">Keyboard shortcuts</label>
			<select
				id="shortcut-mode"
				value={getShortcutMode()}
				onchange={(e) => setShortcutMode((e.target as HTMLSelectElement).value as ShortcutMode)}
				class="mt-1 w-full rounded-button border border-border bg-surface-elevated px-3 py-2 sm:w-64"
			>
				<option value="none">None</option>
				<option value="gmail">Gmail-style (g d, g b, c, etc.)</option>
				<option value="vim">Vim-style (j/k, h/l, gg, o, etc.)</option>
			</select>
			<p class="mt-1 text-xs text-fg-muted">Press ? on any screen to see available shortcuts.</p>
		</div>
	</section>

	<section class="mt-10">
		<h2 class="text-lg font-semibold">Strava</h2>
		{#if stravaConnected}
			<div class="mt-3 rounded-card border border-border bg-surface-elevated p-4">
				<p class="text-sm">
					Connected as <span class="font-medium">{$stravaAuth?.athlete_username || 'unknown'}</span
					>.
				</p>
				<div class="mt-3 flex flex-wrap gap-3">
					<button
						type="button"
						onclick={loadStravaGear}
						disabled={gearLoading}
						class="rounded-button border border-border px-4 py-1.5 text-sm font-medium disabled:opacity-50"
					>
						{gearLoading ? 'Loading…' : 'Link bikes to Strava gear'}
					</button>
					<button type="button" onclick={handleStravaDisconnect} class="text-sm text-danger">
						Disconnect
					</button>
				</div>
			</div>

			{#if stravaGear.length > 0 && $allBikes}
				<div class="mt-4 space-y-3">
					<p class="text-sm text-fg-muted">
						Match each Strava bike to a Truing bike so rides get assigned correctly.
					</p>
					{#each stravaGear as gear (gear.id)}
						<div class="rounded-card border border-border bg-surface-elevated px-4 py-3">
							<p class="text-sm font-medium">{gear.name}</p>
							<p class="text-xs text-fg-muted">
								{formatDistanceInt(gear.distance)} on Strava
							</p>
							<select
								bind:value={gearMapping[gear.id]}
								class="mt-2 w-full rounded-button border border-border bg-surface px-3 py-1.5 text-sm"
							>
								<option value="">Not linked</option>
								{#each $allBikes as bike (bike.id)}
									<option value={bike.id}>{bike.name}</option>
								{/each}
							</select>
						</div>
					{/each}
					<button
						type="button"
						onclick={saveGearMapping}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
					>
						Save mapping
					</button>
				</div>
			{/if}
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
			{#if !keyUnlocked}
				<div class="mt-4 rounded-card border border-border bg-surface-elevated p-4">
					<p class="text-sm text-fg-muted">
						Enter a passphrase to encrypt your Strava credentials. You will need this passphrase
						each time you open Truing in a new tab.
					</p>
					<div class="mt-3 flex gap-2">
						<input
							type="password"
							bind:value={passphrase}
							placeholder="Passphrase"
							class="flex-1 rounded-button border border-border bg-surface px-3 py-2 text-sm"
						/>
						<button
							type="button"
							onclick={handleUnlock}
							class="rounded-button bg-accent px-4 py-2 text-sm font-medium text-accent-fg"
						>
							Unlock
						</button>
					</div>
				</div>
			{/if}

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
		<h2 class="text-lg font-semibold">Components</h2>
		<p class="mt-2 text-sm text-fg-muted">
			Add custom component types for parts not covered by the shipped defaults.
		</p>
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href="/settings/custom-types"
			class="mt-3 inline-block rounded-button border border-border px-5 py-2 text-sm font-medium"
		>
			Manage custom types
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</section>

	<section class="mt-10">
		<h2 class="text-lg font-semibold">Data</h2>
		<p class="mt-2 text-sm text-fg-muted">
			Export your data as a JSON file for backup. Import to restore or merge from a previous backup.
		</p>
		{#if lastBackupDays !== null}
			<p class="mt-1 text-xs text-fg-muted">
				Last backup {lastBackupDays === 0
					? 'today'
					: `${lastBackupDays} day${lastBackupDays === 1 ? '' : 's'} ago`}.
			</p>
		{/if}
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
				onclick={() => handleImport('replace')}
				disabled={importing}
				class="rounded-button border border-border px-5 py-2 font-medium disabled:opacity-50"
			>
				{importing ? 'Importing…' : 'Restore (replace all)'}
			</button>
			<button
				type="button"
				onclick={() => handleImport('merge')}
				disabled={importing}
				class="rounded-button border border-border px-5 py-2 font-medium disabled:opacity-50"
			>
				{importing ? 'Importing…' : 'Merge (keep existing)'}
			</button>
		</div>
		{#if exportStatus}
			<p class="mt-3 text-sm text-fg-muted" aria-live="polite">{exportStatus}</p>
		{/if}
		{#if importStatus}
			<p class="mt-3 text-sm text-fg-muted" aria-live="polite">{importStatus}</p>
		{/if}
	</section>

	{#if storageInfo}
		<section class="mt-10">
			<h2 class="text-lg font-semibold">Storage</h2>
			<div class="mt-3 space-y-2 text-sm">
				<p>
					Using {(storageInfo.usageBytes / 1024 / 1024).toFixed(1)} MB of {(
						storageInfo.quotaBytes /
						1024 /
						1024
					).toFixed(0)} MB ({storageInfo.usagePercent}%).
				</p>
				<p class="text-fg-muted">
					{storageInfo.persisted
						? 'Storage is persistent. Your browser will not clear it automatically.'
						: 'Storage is not persistent. Your browser may clear data under disk pressure.'}
				</p>
				{#if storageInfo.usagePercent >= 85}
					<p class="text-warning">
						Storage is getting full. Export a backup and consider clearing old data.
					</p>
				{/if}
			</div>
		</section>
	{/if}
</main>

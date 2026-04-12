<script lang="ts">
	import { liveQuery } from 'dexie';
	import { exportAll, importAll, backupFilename, getLastBackupAge } from '$lib/backup';
	import { toast } from '$lib/toast';
	import { db } from '$lib/db';
	import { encryptField, hasSessionKey, unlockWithPassphrase } from '$lib/crypto';
	import { getStorageEstimate, type StorageEstimate } from '$lib/storage';
	import {
		validatePack,
		findNewCustomTypes,
		applyPack,
		type Pack,
		type PackComponent
	} from '$lib/packs';
	import { fetchStravaGear, type StravaGear } from '$lib/strava';
	import { setShortcutMode, getShortcutMode, type ShortcutMode } from '$lib/shortcuts';
	import {
		setUnitPreference,
		getUnitPreference,
		loadUnitPreference,
		formatDistanceInt,
		type UnitSystem
	} from '$lib/units';
	import { isCapacitorNative } from '$lib/platform';
	import { sendTestNotification } from '$lib/notifications';
	import { getPremigrationBackup, clearPremigrationBackup } from '$lib/premigration';

	loadUnitPreference();

	const isNative = isCapacitorNative();
	let notificationsEnabled = $state(true);
	let notificationThreshold = $state(90);
	let testingSending = $state(false);

	if (typeof window !== 'undefined') {
		db.settings.get('notifications_enabled').then((s) => {
			if (s?.value === false) notificationsEnabled = false;
		});
		db.settings.get('notification_threshold_pct').then((s) => {
			if (typeof s?.value === 'number') notificationThreshold = s.value;
		});
	}

	async function saveNotificationEnabled(enabled: boolean) {
		notificationsEnabled = enabled;
		await db.settings.put({
			key: 'notifications_enabled',
			value: enabled,
			updated_at: new Date().toISOString()
		});
		toast.success(enabled ? 'Notifications enabled.' : 'Notifications disabled.');
	}

	async function saveNotificationThreshold() {
		const clamped = Math.min(99, Math.max(50, notificationThreshold));
		notificationThreshold = clamped;
		await db.settings.put({
			key: 'notification_threshold_pct',
			value: clamped,
			updated_at: new Date().toISOString()
		});
		toast.success(`Threshold set to ${clamped}%.`);
	}

	async function handleTestNotification() {
		testingSending = true;
		try {
			const ok = await sendTestNotification();
			if (ok) {
				toast.success('Test notification sent. Check your notification shade.');
			} else {
				toast.warning('Notification permission was denied or not available.');
			}
		} finally {
			testingSending = false;
		}
	}

	type PackIndexEntry = {
		id: string;
		name: string;
		description: string;
		file: string;
		components: number;
	};
	let availablePacks = $state<PackIndexEntry[]>([]);
	let packsLoading = $state(false);

	async function loadAvailablePacks() {
		packsLoading = true;
		try {
			const res = await fetch('/packs/index.json');
			if (!res.ok) throw new Error(`${res.status}`);
			const data = await res.json();
			availablePacks = data.packs ?? [];
		} catch {
			toast.error('Could not load available packs.');
		} finally {
			packsLoading = false;
		}
	}

	async function downloadAndLoadPack(entry: PackIndexEntry) {
		try {
			const res = await fetch(`/packs/${entry.file}`);
			if (!res.ok) throw new Error(`${res.status}`);
			const text = await res.text();
			const data = JSON.parse(text);
			const pack = validatePack(data);
			packData = pack;
			packChecked = pack.components.map(() => true);
			const newTypes = findNewCustomTypes(pack);
			packNewTypes = newTypes;
			packNewTypesChecked = newTypes.map(() => true);
			packBikeId = '';
			packCreateNew = !!pack.bike;
			packInstallDate = todayISO();
			availablePacks = [];
		} catch (err) {
			toast.error(`Failed to load pack. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	let packData = $state<Pack | null>(null);
	let packChecked = $state<boolean[]>([]);
	let packNewTypes = $state<PackComponent[]>([]);
	let packNewTypesChecked = $state<boolean[]>([]);
	let packBikeId = $state<number | ''>('');
	let packCreateNew = $state(false);
	let packInstallDate = $state(todayISO());
	let packImporting = $state(false);

	function todayISO(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	async function handlePackFileSelect() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.truing,.json';
		input.onchange = async () => {
			const file = input.files?.[0];
			if (!file) return;
			try {
				const text = await file.text();
				const data = JSON.parse(text);
				const pack = validatePack(data);
				packData = pack;
				packChecked = pack.components.map(() => true);
				const newTypes = findNewCustomTypes(pack);
				packNewTypes = newTypes;
				packNewTypesChecked = newTypes.map(() => true);
				packBikeId = '';
				packCreateNew = !!pack.bike;
				packInstallDate = todayISO();
			} catch (err) {
				toast.error(`Failed to load pack. ${err instanceof Error ? err.message : String(err)}`);
			}
		};
		input.click();
	}

	async function handlePackApply() {
		if (!packData) return;
		packImporting = true;
		try {
			let bikeId: number;
			if (packCreateNew && packData.bike) {
				const now = new Date().toISOString();
				bikeId = (await db.bikes.add({
					name: packData.name,
					make: packData.bike.make ?? undefined,
					model: packData.bike.model ?? undefined,
					year: packData.bike.year ?? undefined,
					type:
						(packData.bike.type as
							| 'road'
							| 'gravel'
							| 'mtb'
							| 'commuter'
							| 'ebike'
							| 'touring'
							| 'other') ?? undefined,
					starting_odometer_meters: 0,
					created_at: now,
					updated_at: now
				})) as number;
			} else {
				if (packBikeId === '') {
					toast.warning('Select a bike to apply the pack to.');
					packImporting = false;
					return;
				}
				bikeId = packBikeId;
			}
			const selectedComponents = packData.components.filter((_, i) => packChecked[i]);
			const selectedNewTypes = packNewTypes.filter((_, i) => packNewTypesChecked[i]);
			const result = await applyPack(bikeId, selectedComponents, selectedNewTypes, packInstallDate);
			toast.success(`Applied! ${result.added} component${result.added !== 1 ? 's' : ''} added.`);
			packData = null;
		} catch (err) {
			toast.error(`Apply failed. ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			packImporting = false;
		}
	}

	let premigrationBackup = $state<{
		exportedAt: string;
		fromVersion: number;
		toVersion: number;
		json: string;
	} | null>(null);
	let premigrationRestoring = $state(false);
	getPremigrationBackup().then((b) => (premigrationBackup = b));

	async function handlePremigrationRestore() {
		if (!premigrationBackup) return;
		if (!confirm('This will replace all current data with the pre-migration backup. Continue?'))
			return;
		premigrationRestoring = true;
		try {
			const result = await importAll(premigrationBackup.json, 'replace');
			toast.success(
				`Restored ${result.bikes.added} bikes, ${result.rides.added} rides, ${result.serviceLog.added} service entries.`
			);
			await clearPremigrationBackup();
			premigrationBackup = null;
		} catch (err) {
			toast.error(`Restore failed. ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			premigrationRestoring = false;
		}
	}

	async function handlePremigrationDismiss() {
		await clearPremigrationBackup();
		premigrationBackup = null;
		toast.info('Pre-migration backup cleared.');
	}

	let storageInfo = $state<StorageEstimate | null>(null);
	getStorageEstimate().then((est) => (storageInfo = est));

	let importing = $state(false);
	let lastBackupDays = $state<number | null>(null);
	getLastBackupAge().then((d) => (lastBackupDays = d));

	async function handleExport() {
		try {
			const json = await exportAll();
			const blob = new Blob([json], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = backupFilename();
			a.click();
			URL.revokeObjectURL(url);
			toast.success('Backup downloaded.');
			lastBackupDays = 0;
		} catch (err) {
			toast.error(`Export failed. ${err instanceof Error ? err.message : String(err)}`);
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
			try {
				const text = await file.text();
				const result = await importAll(text, mode);
				if (mode === 'replace') {
					toast.success(
						`Restored ${result.bikes.added} bikes, ${result.rides.added} rides, ${result.serviceLog.added} service log entries.`
					);
				} else {
					const parts = [];
					if (result.bikes.added) parts.push(`${result.bikes.added} new bikes`);
					if (result.bikes.skipped) parts.push(`${result.bikes.skipped} bikes skipped`);
					if (result.rides.added) parts.push(`${result.rides.added} new rides`);
					if (result.rides.skipped) parts.push(`${result.rides.skipped} rides skipped`);
					if (result.serviceLog.added) parts.push(`${result.serviceLog.added} new service entries`);
					if (result.serviceLog.skipped)
						parts.push(`${result.serviceLog.skipped} service entries skipped`);
					toast.success(
						parts.length > 0 ? `Merged. ${parts.join(', ')}.` : 'Nothing new to import.'
					);
				}
			} catch (err) {
				toast.error(`Import failed. ${err instanceof Error ? err.message : String(err)}`);
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
			toast.error(`Failed to load gear. ${err instanceof Error ? err.message : String(err)}`);
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
		toast.success('Gear mapping saved.');
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
			toast.success('Unlocked.');
		} catch (err) {
			toast.error(`Unlock failed. ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	async function handleStravaSave() {
		if (!keyUnlocked) {
			toast.warning('Unlock with your passphrase first.');
			return;
		}
		if (!stravaClientId.trim() || !stravaClientSecret.trim()) {
			toast.warning('Both fields are required.');
			return;
		}
		stravaSaving = true;
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
			toast.success('Credentials saved. Now connect to authorize.');
		} catch (err) {
			toast.error(`Save failed. ${err instanceof Error ? err.message : String(err)}`);
		} finally {
			stravaSaving = false;
		}
	}

	function handleStravaConnect() {
		if (!$stravaAuth?.client_id) {
			toast.warning('Save your credentials first.');
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
		toast.info('Disconnected.');
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
		<h2 class="text-lg font-semibold">Notifications</h2>
		{#if isNative}
			<div class="mt-3 flex items-center gap-3">
				<label class="text-sm font-medium" for="notif-toggle">Wear notifications</label>
				<button
					id="notif-toggle"
					type="button"
					role="switch"
					aria-checked={notificationsEnabled}
					onclick={() => saveNotificationEnabled(!notificationsEnabled)}
					class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors {notificationsEnabled
						? 'bg-accent'
						: 'bg-border'}"
				>
					<span
						class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform {notificationsEnabled
							? 'translate-x-5'
							: 'translate-x-0'}"
					></span>
				</button>
			</div>
			{#if notificationsEnabled}
				<div class="mt-4">
					<label for="notif-threshold" class="block text-sm font-medium">
						Early warning threshold
					</label>
					<div class="mt-1 flex items-center gap-3">
						<input
							id="notif-threshold"
							type="number"
							min="50"
							max="99"
							bind:value={notificationThreshold}
							onchange={saveNotificationThreshold}
							class="w-20 rounded-button border border-border bg-surface-elevated px-3 py-2 text-sm"
						/>
						<span class="text-sm text-fg-muted">%</span>
					</div>
					<p class="mt-1 text-xs text-fg-muted">
						You will be notified at this threshold, then again at 95% and 99%. Per-component
						overrides can be set on each component's detail page.
					</p>
				</div>
				<div class="mt-4">
					<button
						type="button"
						onclick={handleTestNotification}
						disabled={testingSending}
						class="rounded-button border border-border px-5 py-2 text-sm font-medium disabled:opacity-50"
					>
						{testingSending ? 'Sending…' : 'Send test notification'}
					</button>
				</div>
			{/if}
		{:else}
			<p class="mt-3 text-sm text-fg-muted">
				Notifications are only available in the installed app. Install Truing on your Android device
				to receive wear alerts.
			</p>
		{/if}
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
	</section>

	{#if premigrationBackup}
		<section class="mt-6 rounded-card border border-warning bg-surface-elevated p-4">
			<p class="text-sm font-medium">Pre-migration backup available</p>
			<p class="mt-1 text-xs text-fg-muted">
				Created {new Date(premigrationBackup.exportedAt).toLocaleDateString()} before upgrading from schema
				v{premigrationBackup.fromVersion} to v{premigrationBackup.toVersion}. If something went
				wrong with the upgrade, you can restore this backup.
			</p>
			<div class="mt-3 flex gap-3">
				<button
					type="button"
					onclick={handlePremigrationRestore}
					disabled={premigrationRestoring}
					class="rounded-button border border-border px-4 py-1.5 text-sm font-medium disabled:opacity-50"
				>
					{premigrationRestoring ? 'Restoring…' : 'Restore'}
				</button>
				<button type="button" onclick={handlePremigrationDismiss} class="text-sm text-fg-muted">
					Dismiss
				</button>
			</div>
		</section>
	{/if}

	<section class="mt-10">
		<h2 class="text-lg font-semibold">Data packs</h2>
		<p class="mt-2 text-sm text-fg-muted">
			Import a .truing data pack to add components and service intervals for a specific bike build.
		</p>
		{#if !packData}
			<div class="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					onclick={loadAvailablePacks}
					disabled={packsLoading}
					class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
				>
					{packsLoading ? 'Loading…' : 'Browse available packs'}
				</button>
				<button
					type="button"
					onclick={handlePackFileSelect}
					class="rounded-button border border-border px-5 py-2 font-medium"
				>
					Import from file
				</button>
			</div>

			{#if availablePacks.length > 0}
				<ul class="mt-4 space-y-2">
					{#each availablePacks as entry (entry.id)}
						<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium">{entry.name}</p>
									<p class="text-sm text-fg-muted">{entry.description}</p>
									<p class="text-xs text-fg-muted">{entry.components} components</p>
								</div>
								<button
									type="button"
									onclick={() => downloadAndLoadPack(entry)}
									class="shrink-0 rounded-button bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg"
								>
									Use
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<div class="mt-4 rounded-card border border-border bg-surface-elevated p-4">
				<h3 class="font-semibold">{packData.name}</h3>
				{#if packData.description}
					<p class="text-sm text-fg-muted">{packData.description}</p>
				{/if}

				{#if packData.bike}
					<div class="mt-3 flex gap-3">
						<label class="flex items-center gap-2 text-sm">
							<input type="radio" bind:group={packCreateNew} value={true} />
							Create new bike
						</label>
						<label class="flex items-center gap-2 text-sm">
							<input type="radio" bind:group={packCreateNew} value={false} />
							Apply to existing
						</label>
					</div>
				{/if}

				{#if !packCreateNew && $allBikes}
					<select
						bind:value={packBikeId}
						class="mt-2 w-full rounded-button border border-border bg-surface px-3 py-2 text-sm"
					>
						<option value="">Choose a bike…</option>
						{#each $allBikes as bike (bike.id)}
							<option value={bike.id}>{bike.name}</option>
						{/each}
					</select>
				{/if}

				<p class="mt-4 text-sm font-medium">
					Components ({packChecked.filter(Boolean).length} selected)
				</p>
				<ul class="mt-2 max-h-60 space-y-1 overflow-y-auto">
					{#each packData.components as comp, i (i)}
						<li>
							<label class="flex items-center gap-3 text-sm">
								<input type="checkbox" bind:checked={packChecked[i]} />
								<span>{comp.name}</span>
								<span class="text-fg-muted">({comp.category})</span>
							</label>
						</li>
					{/each}
				</ul>

				{#if packNewTypes.length > 0}
					<p class="mt-4 text-sm font-medium">
						New component types ({packNewTypesChecked.filter(Boolean).length} will be created)
					</p>
					<ul class="mt-2 space-y-1">
						{#each packNewTypes as ct, i (i)}
							<li>
								<label class="flex items-center gap-3 text-sm">
									<input type="checkbox" bind:checked={packNewTypesChecked[i]} />
									<span>{ct.name}</span>
									<span class="text-fg-muted">({ct.type})</span>
								</label>
							</li>
						{/each}
					</ul>
				{/if}

				<div class="mt-4">
					<label for="pack-install-date" class="block text-sm font-medium">Install date</label>
					<input
						id="pack-install-date"
						type="date"
						bind:value={packInstallDate}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2 sm:w-64"
					/>
				</div>

				<div class="mt-4 flex gap-3">
					<button
						type="button"
						onclick={handlePackApply}
						disabled={packImporting}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
					>
						{packImporting ? 'Applying…' : `Apply ${packChecked.filter(Boolean).length} components`}
					</button>
					<button
						type="button"
						onclick={() => (packData = null)}
						class="rounded-button px-5 py-2 font-medium text-fg-muted"
					>
						Cancel
					</button>
				</div>
			</div>
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

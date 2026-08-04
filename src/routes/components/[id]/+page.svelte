<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { liveQuery } from 'dexie';
	import { db, type Bike, type Component, type Installation, type ServiceAction } from '$lib/db';
	import { componentWear } from '$lib/wear';
	import { clearNotifiedThresholds } from '$lib/notifications';
	import { isCapacitorNative } from '$lib/platform';
	import { toast } from '$lib/toast';
	import {
		replacementDistanceMeters,
		replacementTimeDays,
		componentLabel,
		componentTypeLabel,
		serviceSchedule
	} from '$lib/intervals';
	import {
		formatDistance,
		metersToDisplayUnit,
		parseDistanceToMeters,
		distanceLabel
	} from '$lib/units';
	import { formatDate } from '$lib/dates';

	const componentId = $derived(Number(page.params.id));

	type Snapshot = {
		component: Component;
		installations: Array<{ installation: Installation; bike: Bike | undefined }>;
		currentBike: Bike | undefined;
		wearMeters: number;
		replacementDistanceMi: number | null;
		replacementTimeDaysValue: number | null;
		remainingMi: number | null;
		remainingDays: number | null;
		urgencyFraction: number;
	};

	type DetailState = Snapshot | { notFound: true };

	const snapshot = liveQuery<DetailState>(async () => {
		const component = await db.components.get(componentId);
		if (!component || component.id === undefined) return { notFound: true };

		const installations = await db.installations.where({ component_id: componentId }).toArray();
		const bikeIds = [...new Set(installations.map((i) => i.bike_id))];
		const bikes = await db.bikes.bulkGet(bikeIds);
		const bikeById: Record<number, Bike> = {};
		for (const b of bikes) if (b?.id !== undefined) bikeById[b.id] = b;

		const installationsWithBike = installations
			.map((inst) => ({ installation: inst, bike: bikeById[inst.bike_id] }))
			.sort((a, b) => (a.installation.installed_at > b.installation.installed_at ? -1 : 1));

		const currentInstallation = installations.find((i) => !i.removed_at);
		const currentBike = currentInstallation ? bikeById[currentInstallation.bike_id] : undefined;

		const wearMeters = await componentWear(componentId);
		const distInterval = replacementDistanceMeters(component);
		const timeInterval = replacementTimeDays(component);

		const distanceFraction =
			distInterval != null && distInterval > 0 ? wearMeters / distInterval : null;
		let timeFraction: number | null = null;
		let remainingDays: number | null = null;
		if (currentInstallation && timeInterval != null && timeInterval > 0) {
			const daysSinceInstall =
				(Date.now() - Date.parse(currentInstallation.installed_at)) / 86_400_000;
			timeFraction = daysSinceInstall / timeInterval;
			remainingDays = Math.round(timeInterval - daysSinceInstall);
		}
		const urgencyFraction = Math.max(distanceFraction ?? 0, timeFraction ?? 0);

		const remainingMi =
			distInterval != null ? Math.round(metersToDisplayUnit(distInterval - wearMeters)) : null;

		return {
			component,
			installations: installationsWithBike,
			currentBike,
			wearMeters,
			replacementDistanceMi:
				distInterval != null ? Math.round(metersToDisplayUnit(distInterval)) : null,
			replacementTimeDaysValue: timeInterval ?? null,
			remainingMi,
			remainingDays,
			urgencyFraction
		};
	});

	const serviceLog = liveQuery(async () => {
		const entries = await db.service_log.where({ component_id: componentId }).toArray();
		entries.sort((a, b) => b.performed_at.localeCompare(a.performed_at));
		return entries;
	});

	let showServiceModal = $state(false);
	let serviceAction = $state<ServiceAction>('serviced');
	let serviceTypeKey = $state('');
	let serviceDate = $state(todayISO());
	let serviceOdometerMiles = $state<number | ''>('');
	let serviceNotes = $state('');
	let serviceSaving = $state(false);
	let serviceError = $state('');

	const isNative = isCapacitorNative();
	let globalThreshold = $state(90);
	let customThreshold = $state<number | ''>('');

	if (typeof window !== 'undefined') {
		db.settings.get('notification_threshold_pct').then((s) => {
			if (typeof s?.value === 'number') globalThreshold = s.value;
		});
	}

	$effect(() => {
		const snap = $snapshot;
		if (snap && 'component' in snap) {
			customThreshold = snap.component.notification_threshold_pct ?? '';
		}
	});

	async function saveCustomThreshold() {
		if (customThreshold === '' || customThreshold === null) return;
		const val = Math.min(99, Math.max(50, Number(customThreshold)));
		customThreshold = val;
		await db.components.update(componentId, {
			notification_threshold_pct: val,
			updated_at: new Date().toISOString()
		});
		toast.success(`Threshold set to ${val}%.`);
	}

	async function resetThreshold() {
		customThreshold = '';
		await db.components.update(componentId, {
			notification_threshold_pct: null,
			notified_thresholds: [],
			updated_at: new Date().toISOString()
		});
		toast.success('Reset to global default.');
	}

	const componentSchedule = $derived.by(() => {
		const snap = $snapshot;
		if (!snap || 'notFound' in snap) return [];
		return serviceSchedule(snap.component.type);
	});

	function todayISO(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function openServiceModal() {
		serviceAction = 'serviced';
		serviceTypeKey = '';
		serviceDate = todayISO();
		serviceOdometerMiles = '';
		serviceNotes = '';
		serviceError = '';
		showServiceModal = true;
	}

	async function handleAddServiceEvent(e: SubmitEvent) {
		e.preventDefault();
		if (serviceSaving) return;
		serviceSaving = true;
		serviceError = '';
		try {
			const snap = $snapshot;
			if (!snap || 'notFound' in snap) return;
			const currentInst = snap.installations.find((i) => !i.installation.removed_at);
			const bikeId = currentInst?.installation.bike_id ?? 0;
			const now = new Date().toISOString();
			const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
			await db.service_log.add({
				component_id: componentId,
				bike_id: bikeId,
				performed_at: new Date(serviceDate).toISOString(),
				performed_at_tz: tz,
				action: serviceAction,
				service_type: serviceTypeKey || undefined,
				odometer_meters_at_service:
					serviceOdometerMiles === ''
						? undefined
						: Math.round(parseDistanceToMeters(serviceOdometerMiles)),
				notes: serviceNotes.trim() || undefined,
				created_at: now,
				updated_at: now
			});
			if (serviceAction === 'serviced') {
				await clearNotifiedThresholds(componentId);
			}
			showServiceModal = false;
		} catch (err) {
			serviceError = err instanceof Error ? err.message : String(err);
		} finally {
			serviceSaving = false;
		}
	}

	function progressColorClass(fraction: number): string {
		if (fraction >= 1) return 'bg-danger';
		if (fraction >= 0.9) return 'bg-warning';
		return 'bg-accent';
	}
</script>

<svelte:head>
	<title
		>{$snapshot && 'component' in $snapshot ? componentLabel($snapshot.component) : 'Component'} · Truing</title
	>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	{#if !$snapshot}
		<p class="text-fg-muted">Loading…</p>
	{:else if 'notFound' in $snapshot}
		<p class="text-fg-muted">Component not found.</p>
		<a href={resolve('/bikes')} class="mt-4 inline-block text-accent">← Back to bikes</a>
	{:else}
		{@const snap = $snapshot}
		<header>
			{#if snap.currentBike && snap.currentBike.id !== undefined}
				<a
					href={resolve('/bikes/[id]', { id: String(snap.currentBike.id) })}
					class="text-sm text-fg-muted"
				>
					← {snap.currentBike.name}
				</a>
			{:else}
				<a href={resolve('/bikes')} class="text-sm text-fg-muted">← Bikes</a>
			{/if}
			<h1 class="mt-2 text-2xl font-semibold">{componentLabel(snap.component)}</h1>
			<p class="text-fg-muted">{componentTypeLabel(snap.component.type)}</p>
		</header>

		<section class="mt-8 rounded-card border border-border bg-surface-elevated p-5">
			<h2 class="text-xs font-semibold tracking-wide text-fg-muted uppercase">Wear</h2>
			<p class="mt-2 text-2xl font-semibold">
				{formatDistance(snap.wearMeters)}
			</p>
			{#if snap.replacementDistanceMi !== null && snap.remainingMi !== null}
				<p class="mt-1 text-sm text-fg-muted">
					{#if snap.remainingMi >= 0}
						{snap.remainingMi.toLocaleString()}
						{distanceLabel()} remaining of {snap.replacementDistanceMi.toLocaleString()}
						{distanceLabel()} interval.
					{:else}
						{Math.abs(snap.remainingMi).toLocaleString()} {distanceLabel()} overdue.
					{/if}
				</p>
			{/if}
			{#if snap.replacementTimeDaysValue !== null && snap.remainingDays !== null}
				<p class="mt-1 text-sm text-fg-muted">
					{#if snap.remainingDays >= 0}
						{snap.remainingDays} days remaining of {snap.replacementTimeDaysValue} day interval.
					{:else}
						{Math.abs(snap.remainingDays)} days overdue.
					{/if}
				</p>
			{/if}
			{#if snap.urgencyFraction > 0}
				<div class="mt-4 h-2 overflow-hidden rounded-full bg-border">
					<div
						class="h-full {progressColorClass(snap.urgencyFraction)}"
						style="width: {Math.min(100, snap.urgencyFraction * 100)}%"
					></div>
				</div>
			{/if}
			{#if snap.component.purchase_price_cents != null && snap.component.purchase_price_cents > 0 && snap.wearMeters > 0}
				{@const priceDollars = snap.component.purchase_price_cents / 100}
				{@const wearMiles = metersToDisplayUnit(snap.wearMeters)}
				{@const centsPerMile = (snap.component.purchase_price_cents / wearMiles).toFixed(1)}
				<p class="mt-3 text-sm text-fg-muted">
					${priceDollars.toFixed(2)} · {wearMiles.toFixed(0)} mi · {centsPerMile}¢/mi
				</p>
			{/if}
		</section>

		<button
			type="button"
			onclick={openServiceModal}
			class="mt-6 rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
		>
			Log service event
		</button>

		{#if $serviceLog && $serviceLog.length > 0}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">Service log</h2>
				<ul class="mt-3 space-y-2">
					{#each $serviceLog as entry (entry.id)}
						<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium capitalize">
										{entry.action}
										{#if entry.service_type}
											<span class="ml-1 font-normal text-fg-muted"
												>{componentSchedule.find((s) => s.key === entry.service_type)?.name ??
													entry.service_type}</span
											>
										{/if}
									</p>
									{#if entry.notes}
										<p class="text-sm text-fg-muted">{entry.notes}</p>
									{/if}
								</div>
								<p class="shrink-0 text-sm text-fg-muted">
									{formatDate(entry.performed_at)}
								</p>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if snap.installations.length > 0}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">Installation history</h2>
				<ul class="mt-3 space-y-2">
					{#each snap.installations as entry (entry.installation.id)}
						<li class="rounded-card border border-border bg-surface-elevated px-4 py-3">
							<p class="font-medium">{entry.bike?.name ?? 'Unknown bike'}</p>
							<p class="text-sm text-fg-muted">
								{formatDate(entry.installation.installed_at)}
								{#if entry.installation.removed_at}
									to {formatDate(entry.installation.removed_at)}
								{:else}
									to now
								{/if}
							</p>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if snap.component.notes}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">Notes</h2>
				<p class="mt-2 text-sm whitespace-pre-wrap text-fg-muted">{snap.component.notes}</p>
			</section>
		{/if}

		{#if isNative}
			<section class="mt-8">
				<h2 class="text-lg font-semibold">Notifications</h2>
				<div class="mt-3">
					<label for="comp-threshold" class="block text-sm font-medium">
						Early warning threshold
					</label>
					<div class="mt-1 flex items-center gap-3">
						<input
							id="comp-threshold"
							type="number"
							min="50"
							max="99"
							placeholder={String(globalThreshold)}
							bind:value={customThreshold}
							onchange={saveCustomThreshold}
							class="w-20 rounded-button border border-border bg-surface-elevated px-3 py-2 text-sm"
						/>
						<span class="text-sm text-fg-muted">%</span>
						{#if customThreshold !== ''}
							<button type="button" onclick={resetThreshold} class="text-sm text-accent">
								Reset to default
							</button>
						{/if}
					</div>
					<p class="mt-1 text-xs text-fg-muted">
						{#if customThreshold === ''}
							Using global default ({globalThreshold}%). Set a value to override for this component.
						{:else}
							Custom threshold. Alerts at {customThreshold}%, 95%, and 99%.
						{/if}
					</p>
				</div>
			</section>
		{/if}
	{/if}
</main>

{#if showServiceModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="service-title"
			class="w-full max-w-md rounded-card bg-surface-elevated p-6"
		>
			<h2 id="service-title" class="text-lg font-semibold">Log service event</h2>
			<form onsubmit={handleAddServiceEvent} class="mt-4 space-y-4">
				<div>
					<label for="service-action" class="block text-sm font-medium">Action</label>
					<select
						id="service-action"
						required
						bind:value={serviceAction}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					>
						<option value="serviced">Serviced</option>
						<option value="inspected">Inspected</option>
						<option value="noted">Noted</option>
					</select>
				</div>
				{#if componentSchedule.length > 0 && serviceAction === 'serviced'}
					<div>
						<label for="service-type" class="block text-sm font-medium">Service type</label>
						<select
							id="service-type"
							bind:value={serviceTypeKey}
							class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
						>
							<option value="">General</option>
							{#each componentSchedule as entry (entry.key)}
								<option value={entry.key}>{entry.name}</option>
							{/each}
						</select>
					</div>
				{/if}
				<div>
					<label for="service-date" class="block text-sm font-medium">Date</label>
					<input
						id="service-date"
						type="date"
						required
						bind:value={serviceDate}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="service-odometer" class="block text-sm font-medium">
						Odometer at service (miles, optional)
					</label>
					<input
						id="service-odometer"
						type="number"
						min="0"
						step="1"
						bind:value={serviceOdometerMiles}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					/>
				</div>
				<div>
					<label for="service-notes" class="block text-sm font-medium">Notes</label>
					<textarea
						id="service-notes"
						rows="3"
						bind:value={serviceNotes}
						class="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2"
					></textarea>
				</div>
				{#if serviceError}
					<p class="text-sm text-danger" aria-live="polite">{serviceError}</p>
				{/if}
				<div class="flex gap-3 pt-2">
					<button
						type="submit"
						disabled={serviceSaving}
						class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
					>
						{serviceSaving ? 'Saving…' : 'Log'}
					</button>
					<button
						type="button"
						onclick={() => (showServiceModal = false)}
						class="rounded-button px-5 py-2 font-medium text-fg-muted"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

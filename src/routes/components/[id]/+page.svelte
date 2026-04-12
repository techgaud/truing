<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { liveQuery } from 'dexie';
	import { db, type Bike, type Component, type Installation } from '$lib/db';
	import { componentWear } from '$lib/wear';
	import {
		replacementDistanceMeters,
		replacementTimeDays,
		componentLabel,
		componentTypeLabel
	} from '$lib/intervals';

	const METERS_PER_MILE = 1609.344;

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
			distInterval != null ? Math.round((distInterval - wearMeters) / METERS_PER_MILE) : null;

		return {
			component,
			installations: installationsWithBike,
			currentBike,
			wearMeters,
			replacementDistanceMi:
				distInterval != null ? Math.round(distInterval / METERS_PER_MILE) : null,
			replacementTimeDaysValue: timeInterval ?? null,
			remainingMi,
			remainingDays,
			urgencyFraction
		};
	});

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
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
				{(snap.wearMeters / METERS_PER_MILE).toFixed(1)} mi
			</p>
			{#if snap.replacementDistanceMi !== null && snap.remainingMi !== null}
				<p class="mt-1 text-sm text-fg-muted">
					{#if snap.remainingMi >= 0}
						{snap.remainingMi.toLocaleString()} mi remaining of {snap.replacementDistanceMi.toLocaleString()}
						mi interval.
					{:else}
						{Math.abs(snap.remainingMi).toLocaleString()} mi overdue.
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
		</section>

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
	{/if}
</main>

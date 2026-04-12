<script lang="ts">
	import { liveQuery } from 'dexie';
	import { resolve } from '$app/paths';
	import { db, type Bike, type Component, type Installation } from '$lib/db';
	import { componentWear } from '$lib/wear';
	import {
		replacementDistanceMeters,
		replacementTimeDays,
		inspectionDistanceMeters,
		inspectionTimeDays,
		componentLabel,
		componentTypeLabel
	} from '$lib/intervals';

	const METERS_PER_MILE = 1609.344;
	const URGENT_CAP = 10;
	const DUE_SOON_FRACTION = 0.9;
	const DUE_SOON_DAYS = 14;

	type Row = {
		installation: Installation;
		component: Component;
		bike: Bike;
		wearMeters: number;
		distanceFraction: number | null;
		timeFraction: number | null;
		urgencyFraction: number;
		remainingMi: number | null;
		remainingDays: number | null;
	};

	type Classified = {
		status: 'ok';
		overdue: Row[];
		dueSoon: Row[];
		inspection: Row[];
		healthy: Row[];
	};

	type DashState = Classified | { status: 'no_bikes' } | { status: 'no_components' };

	const data = liveQuery<DashState>(async () => {
		const allBikes = await db.bikes.toArray();
		const activeBikes = allBikes.filter((b) => !b.archived_at && b.id !== undefined);
		if (activeBikes.length === 0) return { status: 'no_bikes' };

		const bikeById: Record<number, Bike> = {};
		for (const b of activeBikes) bikeById[b.id!] = b;

		const allInstallations = await db.installations.toArray();
		const activeInstallations = allInstallations.filter(
			(i) => !i.removed_at && bikeById[i.bike_id] !== undefined
		);
		if (activeInstallations.length === 0) return { status: 'no_components' };

		const components = await db.components.bulkGet(activeInstallations.map((i) => i.component_id));

		const now = Date.now();
		const rows: Row[] = [];
		for (let idx = 0; idx < activeInstallations.length; idx++) {
			const inst = activeInstallations[idx];
			const component = components[idx];
			if (!component || component.id === undefined || component.retired_at) continue;
			const bike = bikeById[inst.bike_id];
			if (!bike) continue;

			const wearMeters = await componentWear(component.id);
			const distInterval = replacementDistanceMeters(component);
			const timeInterval = replacementTimeDays(component);

			const distanceFraction =
				distInterval != null && distInterval > 0 ? wearMeters / distInterval : null;
			const daysSinceInstall = (now - Date.parse(inst.installed_at)) / 86_400_000;
			const timeFraction =
				timeInterval != null && timeInterval > 0 ? daysSinceInstall / timeInterval : null;
			const urgencyFraction = Math.max(distanceFraction ?? 0, timeFraction ?? 0);

			const remainingMi =
				distInterval != null ? Math.round((distInterval - wearMeters) / METERS_PER_MILE) : null;
			const remainingDays =
				timeInterval != null ? Math.round(timeInterval - daysSinceInstall) : null;

			rows.push({
				installation: inst,
				component,
				bike,
				wearMeters,
				distanceFraction,
				timeFraction,
				urgencyFraction,
				remainingMi,
				remainingDays
			});
		}

		const overdue: Row[] = [];
		const dueSoon: Row[] = [];
		const inspection: Row[] = [];
		const healthy: Row[] = [];

		for (const row of rows) {
			if (row.urgencyFraction >= 1.0) {
				overdue.push(row);
				continue;
			}
			const withinDaysWindow =
				row.remainingDays !== null && row.remainingDays >= 0 && row.remainingDays <= DUE_SOON_DAYS;
			if (row.urgencyFraction >= DUE_SOON_FRACTION || withinDaysWindow) {
				dueSoon.push(row);
				continue;
			}

			const inspDist = inspectionDistanceMeters(row.component);
			const inspTime = inspectionTimeDays(row.component);
			const daysSinceInstall = (now - Date.parse(row.installation.installed_at)) / 86_400_000;
			const needsInspection =
				(inspTime != null && daysSinceInstall >= inspTime) ||
				(inspDist != null && row.wearMeters >= inspDist);
			if (needsInspection) inspection.push(row);
			else healthy.push(row);
		}

		overdue.sort((a, b) => b.urgencyFraction - a.urgencyFraction);
		dueSoon.sort((a, b) => b.urgencyFraction - a.urgencyFraction);
		inspection.sort((a, b) => {
			const aDays = (now - Date.parse(a.installation.installed_at)) / 86_400_000;
			const bDays = (now - Date.parse(b.installation.installed_at)) / 86_400_000;
			return bDays - aDays;
		});

		return { status: 'ok', overdue, dueSoon, inspection, healthy };
	});

	const statusText = $derived.by(() => {
		if (!$data || $data.status !== 'ok') return '';
		const urgent = $data.overdue.length + $data.dueSoon.length + $data.inspection.length;
		if (urgent === 0) return 'All good. Nothing needs attention.';
		const parts: string[] = [];
		if ($data.overdue.length) parts.push(`${$data.overdue.length} overdue`);
		if ($data.dueSoon.length) parts.push(`${$data.dueSoon.length} due soon`);
		if ($data.inspection.length) parts.push(`${$data.inspection.length} to inspect`);
		return parts.join(' · ');
	});

	const urgentCount = $derived.by(() =>
		$data && $data.status === 'ok'
			? $data.overdue.length + $data.dueSoon.length + $data.inspection.length
			: 0
	);

	function wearText(row: Row): string {
		const useDistance =
			row.distanceFraction !== null &&
			(row.timeFraction === null || row.distanceFraction >= row.timeFraction);
		if (useDistance && row.remainingMi !== null) {
			return row.remainingMi < 0
				? `${Math.abs(row.remainingMi).toLocaleString()} mi overdue`
				: `${row.remainingMi.toLocaleString()} mi remaining`;
		}
		if (row.remainingDays !== null) {
			return row.remainingDays < 0
				? `${Math.abs(row.remainingDays)} days overdue`
				: `${row.remainingDays} days remaining`;
		}
		return '';
	}
</script>

<svelte:head>
	<title>Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	{#if !$data}
		<p class="text-fg-muted">Loading…</p>
	{:else if $data.status === 'no_bikes'}
		<div class="flex min-h-[60dvh] flex-col items-center justify-center text-center">
			<h1 class="text-2xl font-semibold">Welcome to Truing</h1>
			<p class="mt-3 text-fg-muted">Track your bike's components and stay on top of maintenance.</p>
			<a
				href={resolve('/bikes/new')}
				class="mt-8 rounded-button bg-accent px-5 py-3 font-medium text-accent-fg"
			>
				Add your first bike
			</a>
		</div>
	{:else if $data.status === 'no_components'}
		<h1 class="text-2xl font-semibold">Dashboard</h1>
		<p class="mt-3 text-fg-muted">Add components to start tracking wear.</p>
		<a
			href={resolve('/bikes')}
			class="mt-6 inline-block rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
		>
			Go to bikes
		</a>
	{:else}
		<section class="rounded-card border border-border bg-surface-elevated p-5">
			<h1 class="text-2xl font-semibold">{statusText}</h1>
		</section>

		{#if $data.overdue.length > 0}
			<section class="mt-6">
				<h2 class="text-xs font-semibold uppercase tracking-wide text-danger">Overdue</h2>
				<ul class="mt-2 space-y-2">
					{#each $data.overdue.slice(0, URGENT_CAP) as row (row.installation.id)}
						<li class="rounded-card border border-border bg-surface-elevated p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium">{componentLabel(row.component)}</p>
									<p class="text-sm text-fg-muted">
										{componentTypeLabel(row.component.type)} · {row.bike.name}
									</p>
								</div>
								<p class="shrink-0 text-right text-sm text-danger">{wearText(row)}</p>
							</div>
							<div class="mt-3 h-2 overflow-hidden rounded-full bg-border">
								<div
									class="h-full bg-danger"
									style="width: {Math.min(100, row.urgencyFraction * 100)}%"
								></div>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if $data.dueSoon.length > 0}
			<section class="mt-6">
				<h2 class="text-xs font-semibold uppercase tracking-wide text-warning">Due soon</h2>
				<ul class="mt-2 space-y-2">
					{#each $data.dueSoon.slice(0, URGENT_CAP - $data.overdue.length) as row (row.installation.id)}
						<li class="rounded-card border border-border bg-surface-elevated p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium">{componentLabel(row.component)}</p>
									<p class="text-sm text-fg-muted">
										{componentTypeLabel(row.component.type)} · {row.bike.name}
									</p>
								</div>
								<p class="shrink-0 text-right text-sm text-warning">{wearText(row)}</p>
							</div>
							<div class="mt-3 h-2 overflow-hidden rounded-full bg-border">
								<div
									class="h-full bg-warning"
									style="width: {Math.min(100, row.urgencyFraction * 100)}%"
								></div>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if $data.inspection.length > 0}
			<section class="mt-6">
				<h2 class="text-xs font-semibold uppercase tracking-wide text-info">Needs inspection</h2>
				<ul class="mt-2 space-y-2">
					{#each $data.inspection.slice(0, URGENT_CAP - $data.overdue.length - $data.dueSoon.length) as row (row.installation.id)}
						<li class="rounded-card border border-border bg-surface-elevated p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium">{componentLabel(row.component)}</p>
									<p class="text-sm text-fg-muted">
										{componentTypeLabel(row.component.type)} · {row.bike.name}
									</p>
								</div>
								<p class="shrink-0 text-right text-sm text-info">Time to inspect</p>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if urgentCount > URGENT_CAP}
			<a href={resolve('/bikes')} class="mt-4 inline-block text-accent">
				See all {urgentCount - URGENT_CAP} more →
			</a>
		{/if}

		{#if $data.healthy.length > 0}
			<details class="mt-8">
				<summary class="cursor-pointer text-sm text-fg-muted">
					{$data.healthy.length}
					{$data.healthy.length === 1 ? 'healthy component' : 'healthy components'}
				</summary>
				<ul class="mt-2 space-y-2">
					{#each $data.healthy as row (row.installation.id)}
						<li class="rounded-card border border-border bg-surface-elevated p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<p class="font-medium">{componentLabel(row.component)}</p>
									<p class="text-sm text-fg-muted">
										{componentTypeLabel(row.component.type)} · {row.bike.name}
									</p>
								</div>
								<p class="shrink-0 text-right text-sm text-fg-muted">
									{Math.round(row.urgencyFraction * 100)}% used
								</p>
							</div>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{/if}
</main>

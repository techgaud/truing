<script lang="ts">
	import Settings from 'lucide-svelte/icons/settings';
	import CircleHelp from 'lucide-svelte/icons/circle-help';
	import Package from 'lucide-svelte/icons/package';
	import Info from 'lucide-svelte/icons/info';
	import Share2 from 'lucide-svelte/icons/share-2';
	import { helpOpen } from '$lib/help/state';
	import { shareText } from '$lib/share';
	import { toast } from '$lib/toast';

	async function handleShare() {
		const ok = await shareText('Check out Truing, a bike maintenance tracker. https://truing.app');
		if (!ok) {
			toast.info('Copied to clipboard.');
		}
	}
</script>

<svelte:head>
	<title>More · Truing</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-8">
	<h1 class="text-2xl font-semibold">More</h1>

	<ul class="mt-6 space-y-2">
		<li>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href="/settings"
				class="flex items-center gap-4 rounded-card border border-border bg-surface-elevated px-4 py-3"
			>
				<Settings size={20} class="shrink-0 text-fg-muted" />
				<div>
					<p class="font-medium">Settings</p>
					<p class="text-sm text-fg-muted">Units, keyboard shortcuts, Strava, data, storage</p>
				</div>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</li>
		<li>
			<button
				type="button"
				onclick={() => helpOpen.set(true)}
				class="flex w-full items-center gap-4 rounded-card border border-border bg-surface-elevated px-4 py-3 text-left"
			>
				<CircleHelp size={20} class="shrink-0 text-fg-muted" />
				<div>
					<p class="font-medium">Help</p>
					<p class="text-sm text-fg-muted">Press ? on any screen for contextual help</p>
				</div>
			</button>
		</li>
		<li>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href="/parts-bin"
				class="flex items-center gap-4 rounded-card border border-border bg-surface-elevated px-4 py-3"
			>
				<Package size={20} class="shrink-0 text-fg-muted" />
				<div>
					<p class="font-medium">Parts Bin</p>
					<p class="text-sm text-fg-muted">Uninstalled components waiting to go on a bike</p>
				</div>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</li>
		<li>
			<button
				type="button"
				onclick={handleShare}
				class="flex w-full items-center gap-4 rounded-card border border-border bg-surface-elevated px-4 py-3 text-left"
			>
				<Share2 size={20} class="shrink-0 text-fg-muted" />
				<div>
					<p class="font-medium">Share Truing</p>
					<p class="text-sm text-fg-muted">Tell a friend about Truing</p>
				</div>
			</button>
		</li>
		<li>
			<a
				href="https://github.com/techgaud/truing"
				target="_blank"
				rel="noopener"
				class="flex items-center gap-4 rounded-card border border-border bg-surface-elevated px-4 py-3"
			>
				<Info size={20} class="shrink-0 text-fg-muted" />
				<div>
					<p class="font-medium">About Truing</p>
					<p class="text-sm text-fg-muted">Source code, docs, and issue tracker on GitHub</p>
				</div>
			</a>
		</li>
	</ul>
</main>

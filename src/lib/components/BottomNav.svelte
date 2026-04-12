<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { haptic } from '$lib/haptics';
	import LayoutDashboard from 'lucide-svelte/icons/layout-dashboard';
	import Bike from 'lucide-svelte/icons/bike';
	import Route from 'lucide-svelte/icons/route';

	function isActive(path: string): boolean {
		const current = page.url.pathname;
		if (path === '/') return current === '/';
		return current === path || current.startsWith(`${path}/`);
	}
</script>

<nav
	aria-label="Primary"
	class="fixed right-0 bottom-0 left-0 z-30 flex border-t border-border bg-surface-elevated lg:top-0 lg:right-auto lg:bottom-0 lg:w-48 lg:flex-col lg:border-t-0 lg:border-r"
>
	<a
		href={resolve('/')}
		onclick={() => haptic.selection()}
		class="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-3 text-xs lg:flex-row lg:justify-start lg:gap-3 lg:text-sm {isActive(
			'/'
		)
			? 'font-semibold text-accent'
			: 'text-fg-muted'}"
	>
		<LayoutDashboard size={20} />
		Dashboard
	</a>
	<a
		href={resolve('/bikes')}
		onclick={() => haptic.selection()}
		class="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-3 text-xs lg:flex-row lg:justify-start lg:gap-3 lg:text-sm {isActive(
			'/bikes'
		)
			? 'font-semibold text-accent'
			: 'text-fg-muted'}"
	>
		<Bike size={20} />
		Bikes
	</a>
	<a
		href={resolve('/rides')}
		onclick={() => haptic.selection()}
		class="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-3 text-xs lg:flex-row lg:justify-start lg:gap-3 lg:text-sm {isActive(
			'/rides'
		)
			? 'font-semibold text-accent'
			: 'text-fg-muted'}"
	>
		<Route size={20} />
		Rides
	</a>
</nav>

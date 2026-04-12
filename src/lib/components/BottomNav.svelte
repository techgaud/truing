<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { haptic } from '$lib/haptics';
	import LayoutDashboard from 'lucide-svelte/icons/layout-dashboard';
	import Bike from 'lucide-svelte/icons/bike';
	import Route from 'lucide-svelte/icons/route';
	import Menu from 'lucide-svelte/icons/menu';

	function isActive(path: string): boolean {
		const current = page.url.pathname;
		if (path === '/') return current === '/';
		return current === path || current.startsWith(`${path}/`);
	}

	function isMoreActive(): boolean {
		const current = page.url.pathname;
		return current === '/more' || current.startsWith('/settings') || current === '/parts-bin';
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
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href="/more"
		onclick={() => haptic.selection()}
		class="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-3 text-xs lg:flex-row lg:justify-start lg:gap-3 lg:text-sm {isMoreActive()
			? 'font-semibold text-accent'
			: 'text-fg-muted'}"
	>
		<Menu size={20} />
		More
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</nav>

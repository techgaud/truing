<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

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
		class="flex flex-1 items-center justify-center px-4 py-3 text-sm lg:justify-start {isActive('/')
			? 'font-semibold text-accent'
			: 'text-fg-muted'}"
	>
		Dashboard
	</a>
	<a
		href={resolve('/bikes')}
		class="flex flex-1 items-center justify-center px-4 py-3 text-sm lg:justify-start {isActive(
			'/bikes'
		)
			? 'font-semibold text-accent'
			: 'text-fg-muted'}"
	>
		Bikes
	</a>
	<a
		href={resolve('/rides')}
		class="flex flex-1 items-center justify-center px-4 py-3 text-sm lg:justify-start {isActive(
			'/rides'
		)
			? 'font-semibold text-accent'
			: 'text-fg-muted'}"
	>
		Rides
	</a>
</nav>

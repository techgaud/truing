<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Welcome · Truing</title>
</svelte:head>

<main
	class="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center px-6 text-center"
>
	<h1 class="text-3xl font-semibold">Truing</h1>
	<p class="mt-1 text-fg-muted">Keep your bike true.</p>

	<p class="mt-8 text-sm text-fg-muted">
		Track your bike's components, know when things need attention, and stay on top of maintenance.
	</p>

	<a
		href={resolve('/bikes/new')}
		class="mt-10 rounded-button bg-accent px-6 py-3 font-medium text-accent-fg"
	>
		Add your first bike
	</a>

	<a href={resolve('/')} class="mt-4 text-sm text-fg-muted"> Skip for now </a>

	<p class="mt-12 text-xs text-fg-muted">Tip. Press ? on any screen for help.</p>
</main>

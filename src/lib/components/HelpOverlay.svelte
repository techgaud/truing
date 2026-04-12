<script lang="ts">
	import { page } from '$app/state';
	import { getHelpContent } from '$lib/help/content';

	let open = $state(false);
	let panel = $state<HTMLElement | null>(null);
	let trigger = $state<HTMLButtonElement | null>(null);

	const content = $derived(getHelpContent(page.url.pathname));

	function isInTextInput(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
	}

	function openHelp() {
		open = true;
		queueMicrotask(() => panel?.focus());
	}

	function closeHelp() {
		open = false;
		trigger?.focus();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === '?' && !open && !isInTextInput(e.target)) {
			e.preventDefault();
			openHelp();
		} else if (e.key === 'Escape' && open) {
			e.preventDefault();
			closeHelp();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<button
	type="button"
	bind:this={trigger}
	onclick={openHelp}
	aria-label="Help"
	class="fixed top-4 right-16 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-sm font-semibold"
>
	?
</button>

{#if open && content}
	<button
		type="button"
		aria-label="Close help"
		onclick={closeHelp}
		class="fixed inset-0 z-40 bg-black/30"
	></button>

	<div
		bind:this={panel}
		role="dialog"
		aria-modal="false"
		aria-labelledby="help-title"
		tabindex="-1"
		class="fixed right-0 bottom-0 left-0 z-50 max-h-[85dvh] overflow-y-auto border-t border-border bg-surface-elevated p-6 sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:w-96 sm:max-w-full sm:border-t-0 sm:border-l"
	>
		<div class="flex items-start justify-between gap-3">
			<h2 id="help-title" class="text-lg font-semibold">Help. {content.title}</h2>
			<button
				type="button"
				onclick={closeHelp}
				aria-label="Close"
				class="text-sm font-medium text-fg-muted"
			>
				Close
			</button>
		</div>
		<p class="mt-3 text-sm text-fg-muted">{content.description}</p>
		{#if content.actions.length > 0}
			<h3 class="mt-6 text-xs font-semibold tracking-wide text-fg-muted uppercase">
				What you can do
			</h3>
			<ul class="mt-2 list-disc space-y-2 pl-5 text-sm">
				{#each content.actions as action (action)}
					<li>{action}</li>
				{/each}
			</ul>
		{/if}
		<div class="mt-8 flex flex-col gap-2 text-sm">
			<a
				href="https://github.com/techgaud/truing"
				target="_blank"
				rel="noopener"
				class="text-accent"
			>
				Read the docs →
			</a>
			<a
				href="https://github.com/techgaud/truing/issues"
				target="_blank"
				rel="noopener"
				class="text-accent"
			>
				Send feedback →
			</a>
		</div>
	</div>
{/if}

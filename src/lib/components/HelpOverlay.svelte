<script lang="ts">
	import { page } from '$app/state';
	import X from 'lucide-svelte/icons/x';
	import { getHelpContent } from '$lib/help/content';
	import { helpOpen } from '$lib/help/state';

	const content = $derived(getHelpContent(page.url.pathname));

	function isInTextInput(target: EventTarget | null): boolean {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
	}

	function openHelp() {
		helpOpen.set(true);
	}

	function closeHelp() {
		helpOpen.set(false);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === '?' && !$helpOpen && !isInTextInput(e.target)) {
			e.preventDefault();
			openHelp();
		} else if (e.key === 'Escape' && $helpOpen) {
			e.preventDefault();
			closeHelp();
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

<button
	type="button"
	onclick={openHelp}
	aria-label="Help"
	class="fixed bottom-20 left-5 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-elevated text-fg-muted shadow-lg lg:bottom-6"
>
	?
</button>

{#if $helpOpen && content}
	<button
		type="button"
		aria-label="Close help"
		onclick={closeHelp}
		class="fixed inset-0 z-40 bg-black/30"
	></button>

	<div
		role="dialog"
		aria-modal="false"
		aria-labelledby="help-title"
		tabindex="-1"
		class="fixed right-0 bottom-0 left-0 z-50 max-h-[85dvh] overflow-y-auto border-t border-border bg-surface-elevated p-6 sm:top-0 sm:right-0 sm:bottom-0 sm:left-auto sm:w-96 sm:max-w-full sm:border-t-0 sm:border-l"
	>
		<div class="flex items-start justify-between gap-3">
			<h2 id="help-title" class="text-lg font-semibold">Help: {content.title}</h2>
			<button type="button" onclick={closeHelp} aria-label="Close" class="text-fg-muted">
				<X size={20} />
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

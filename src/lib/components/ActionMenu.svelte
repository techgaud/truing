<script lang="ts">
	import Ellipsis from 'lucide-svelte/icons/ellipsis-vertical';

	type Action = {
		label: string;
		onclick: () => void;
		danger?: boolean;
	};

	let { actions }: { actions: Action[] } = $props();
	let open = $state(false);

	function handleAction(action: Action) {
		open = false;
		action.onclick();
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		aria-label="More actions"
		class="flex h-9 w-9 items-center justify-center rounded-full text-fg-muted hover:bg-border"
	>
		<Ellipsis size={20} />
	</button>

	{#if open}
		<button
			type="button"
			class="fixed inset-0 z-40"
			aria-label="Close menu"
			onclick={() => (open = false)}
		></button>
		<div
			class="absolute top-full right-0 z-50 mt-1 min-w-48 rounded-card border border-border bg-surface-elevated py-1 shadow-lg"
		>
			{#each actions as action (action.label)}
				<button
					type="button"
					onclick={() => handleAction(action)}
					class="w-full px-4 py-2 text-left text-sm {action.danger
						? 'text-danger'
						: 'text-fg'} hover:bg-border"
				>
					{action.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<script lang="ts">
	import { toasts, dismiss } from '$lib/toast';

	const typeClasses: Record<string, string> = {
		success: 'border-accent bg-surface-elevated',
		error: 'border-danger bg-surface-elevated',
		warning: 'border-warning bg-surface-elevated',
		info: 'border-border bg-surface-elevated'
	};
</script>

{#if $toasts.length > 0}
	{@const current = $toasts[0]}
	<div
		role="status"
		aria-live={current.type === 'error' ? 'assertive' : 'polite'}
		class="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-card border px-4 py-2.5 shadow-lg lg:bottom-6 {typeClasses[
			current.type
		]}"
	>
		<span class="text-sm">{current.message}</span>
		{#if current.action}
			<button
				type="button"
				onclick={() => {
					current.action?.onclick();
					dismiss(current.id);
				}}
				class="shrink-0 text-sm font-medium text-accent"
			>
				{current.action.label}
			</button>
		{/if}
		<button
			type="button"
			onclick={() => dismiss(current.id)}
			aria-label="Dismiss"
			class="shrink-0 text-xs text-fg-muted"
		>
			✕
		</button>
	</div>
{/if}

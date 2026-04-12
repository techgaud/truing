<script lang="ts">
	import { browser } from '$app/environment';

	let showBanner = $state(false);
	let waitingWorker = $state<ServiceWorker | null>(null);

	if (browser && 'serviceWorker' in navigator) {
		navigator.serviceWorker.ready.then((registration) => {
			if (registration.waiting) {
				waitingWorker = registration.waiting;
				showBanner = true;
			}
			registration.addEventListener('updatefound', () => {
				const newWorker = registration.installing;
				if (!newWorker) return;
				newWorker.addEventListener('statechange', () => {
					if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
						waitingWorker = newWorker;
						showBanner = true;
					}
				});
			});
		});
	}

	function handleReload() {
		if (waitingWorker) {
			waitingWorker.postMessage({ type: 'SKIP_WAITING' });
		}
		window.location.reload();
	}

	function dismiss() {
		showBanner = false;
	}
</script>

{#if showBanner}
	<div
		role="status"
		class="fixed top-16 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-card border border-border bg-surface-elevated px-4 py-2 shadow-lg"
	>
		<span class="text-sm">Truing has an update.</span>
		<button type="button" onclick={handleReload} class="text-sm font-medium text-accent">
			Reload
		</button>
		<button type="button" onclick={dismiss} class="text-sm text-fg-muted"> Later </button>
	</div>
{/if}

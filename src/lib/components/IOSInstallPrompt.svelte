<script lang="ts">
	import { browser } from '$app/environment';
	import { isIOSSafari, isStandalonePWA, isCapacitorNative } from '$lib/platform';
	import { db } from '$lib/db';

	let show = $state(false);

	if (browser) {
		checkShouldShow();
	}

	async function checkShouldShow() {
		if (isCapacitorNative() || isStandalonePWA() || !isIOSSafari()) return;
		const dismissed = await db.settings.get('ios_install_dismissed');
		if (dismissed?.value === true) return;
		show = true;
	}

	async function handleGotIt() {
		await db.settings.put({
			key: 'ios_install_dismissed',
			value: true,
			updated_at: new Date().toISOString()
		});
		show = false;
	}

	function handleLater() {
		show = false;
	}
</script>

{#if show}
	<div class="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="ios-install-title"
			class="w-full max-w-md rounded-card bg-surface-elevated p-6"
		>
			<h2 id="ios-install-title" class="text-lg font-semibold">Add Truing to your home screen</h2>
			<p class="mt-3 text-sm text-fg-muted">
				Safari clears data from sites you haven't visited in a week, including Truing. Installing
				Truing fixes this and keeps your bike data safe even if you're away for a while.
			</p>
			<p class="mt-3 text-sm text-fg-muted">
				To install, tap the share button below and select "Add to Home Screen."
			</p>
			<div class="mt-6 flex gap-3">
				<button
					type="button"
					onclick={handleGotIt}
					class="rounded-button bg-accent px-5 py-2 font-medium text-accent-fg"
				>
					Got it
				</button>
				<button
					type="button"
					onclick={handleLater}
					class="rounded-button px-5 py-2 font-medium text-fg-muted"
				>
					Remind me later
				</button>
			</div>
		</div>
	</div>
{/if}

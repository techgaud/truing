<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { db } from '$lib/db';
	import { encryptField, decryptField, hasSessionKey, unlockWithPassphrase } from '$lib/crypto';

	let status = $state('Connecting to Strava…');
	let failed = $state(false);
	let needsPassphrase = $state(false);
	let passphrase = $state('');
	let unlocking = $state(false);

	async function exchangeToken() {
		const code = page.url.searchParams.get('code');
		if (!code) {
			status = 'Missing authorization code from Strava.';
			failed = true;
			return;
		}

		const auth = await db.strava_auth.get(1);
		if (!auth) {
			status = 'No Strava credentials found. Set up Strava in Settings first.';
			failed = true;
			return;
		}

		// Connecting to Strava is a full-page redirect to strava.com and back,
		// which clears the in-memory encryption key. Instead of dead-ending in a
		// loop, re-derive the key from the passphrase right here, then continue.
		if (!hasSessionKey()) {
			needsPassphrase = true;
			status = 'Enter your passphrase to finish connecting.';
			return;
		}

		try {
			const clientSecret = await decryptField(auth.client_secret);
			const body = new URLSearchParams({
				client_id: auth.client_id,
				client_secret: clientSecret,
				code,
				grant_type: 'authorization_code'
			});

			let response: Response;
			try {
				response = await fetch('/api/strava/token', {
					method: 'POST',
					headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
					body: body.toString()
				});
			} catch {
				status =
					'Could not reach the Strava token service. Check your connection, then try again from Settings.';
				failed = true;
				return;
			}

			if (!response.ok) {
				status = `The Strava token service returned an error (${response.status}). Try again from Settings.`;
				failed = true;
				return;
			}

			const data = await response.json();
			if (!data.access_token || !data.refresh_token) {
				status = 'Unexpected response from Strava. Missing tokens.';
				failed = true;
				return;
			}

			await db.strava_auth.update(1, {
				access_token: await encryptField(data.access_token),
				refresh_token: await encryptField(data.refresh_token),
				expires_at: data.expires_at,
				athlete_id: data.athlete?.id ?? 0,
				athlete_username: data.athlete?.username ?? '',
				measurement_preference: data.athlete?.measurement_preference === 'feet' ? 'feet' : 'meters'
			});

			status = 'Connected! Redirecting…';
			await goto(resolve('/settings'));
		} catch (err) {
			status = `Connection failed. ${err instanceof Error ? err.message : String(err)}`;
			failed = true;
		}
	}

	async function handleUnlock(e: SubmitEvent) {
		e.preventDefault();
		if (unlocking || passphrase.length === 0) return;
		unlocking = true;
		try {
			await unlockWithPassphrase(passphrase);
			passphrase = '';
			needsPassphrase = false;
			failed = false;
			status = 'Connecting to Strava…';
			await exchangeToken();
		} catch (err) {
			status = `Could not unlock. ${err instanceof Error ? err.message : String(err)}`;
		} finally {
			unlocking = false;
		}
	}

	exchangeToken();
</script>

<svelte:head>
	<title>Strava · Truing</title>
</svelte:head>

<main
	class="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center"
>
	<p class="text-lg font-semibold">{status}</p>

	{#if needsPassphrase}
		<form onsubmit={handleUnlock} class="mt-6 w-full max-w-xs">
			<label for="cb-passphrase" class="sr-only">Passphrase</label>
			<input
				id="cb-passphrase"
				type="password"
				autocomplete="current-password"
				bind:value={passphrase}
				placeholder="Passphrase"
				class="w-full rounded-button border border-border bg-surface-elevated px-3 py-2 text-center"
			/>
			<button
				type="submit"
				disabled={unlocking || passphrase.length === 0}
				class="mt-3 w-full rounded-button bg-accent px-5 py-2 font-medium text-accent-fg disabled:opacity-50"
			>
				{unlocking ? 'Unlocking…' : 'Finish connecting'}
			</button>
		</form>
	{/if}

	{#if failed}
		<a href={resolve('/settings')} class="mt-6 text-accent">Back to Settings</a>
	{/if}
</main>

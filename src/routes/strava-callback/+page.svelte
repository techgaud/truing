<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { db } from '$lib/db';
	import { encryptField } from '$lib/crypto';

	let status = $state('Connecting to Strava…');
	let failed = $state(false);

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

		try {
			const clientSecret = new TextDecoder().decode(auth.client_secret);
			const body = new URLSearchParams({
				client_id: auth.client_id,
				client_secret: clientSecret,
				code,
				grant_type: 'authorization_code'
			});

			const response = await fetch('/api/strava/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: body.toString()
			});

			if (!response.ok) {
				status = `Strava returned an error (${response.status}). Try again from Settings.`;
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

	exchangeToken();
</script>

<svelte:head>
	<title>Strava · Truing</title>
</svelte:head>

<main
	class="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-6 text-center"
>
	<p class="text-lg font-semibold">{status}</p>
	{#if failed}
		<a href={resolve('/settings')} class="mt-6 text-accent">Back to Settings</a>
	{/if}
</main>

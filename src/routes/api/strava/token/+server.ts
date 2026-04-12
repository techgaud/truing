// STATELESS PROXY: do not add logging or storage here.
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	const response = await fetch('https://www.strava.com/oauth/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	return new Response(await response.text(), {
		status: response.status,
		headers: { 'Content-Type': 'application/json' }
	});
};

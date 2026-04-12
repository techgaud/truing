import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			devOptions: { enabled: false },
			manifest: {
				name: 'Truing',
				short_name: 'Truing',
				description: 'Keep your bike true.',
				theme_color: '#0d9488',
				background_color: '#f8fafc',
				display: 'standalone',
				start_url: '/',
				id: 'truing',
				icons: [
					{
						src: '/favicon.svg',
						sizes: 'any',
						type: 'image/svg+xml'
					}
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,json}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/www\.strava\.com\/api\/v3\/.*/,
						handler: 'NetworkOnly'
					},
					{
						urlPattern: /\/api\/strava\/token/,
						handler: 'NetworkOnly'
					},
					{
						urlPattern: ({ request }) => request.mode === 'navigate',
						handler: 'NetworkFirst',
						options: { cacheName: 'truing-navigations' }
					}
				]
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});

# Changelog

## v1.00 — 2026-04-12

First public release.

### What's in it

- Dashboard with overdue, due soon, needs inspection, and healthy component groups. Bike filter dropdown. Recent activity feed. Progress bars.
- Bikes with add, edit, archive, photo upload, component templates, and active/archived filter toggle.
- Components with add (single or bulk template), edit, delete, service log, installation history, cost-per-mile tracking, and wear progress.
- Rides with manual entry, GPX and FIT file import, Strava sync, swipe-to-delete with 5-second undo, and ride detail with edit and delete.
- 52 shipped service interval defaults across 8 categories (drivetrain, brakes, cables, wheels and tires, bearings, cockpit, frame, suspension, ebike).
- Custom component types for parts not in the shipped defaults.
- Strava integration with bring-your-own-token OAuth, encrypted credential storage (AES-GCM with passphrase-derived key), incremental activity sync, and gear-to-bike mapping.
- Wear calculation engine (distance and time based, cross-installation accumulation).
- JSON export and import with SHA-256 checksum, replace or merge modes, and per-table deduplication on merge.
- Settings with distance units (miles or kilometers), keyboard shortcuts (none, Gmail, Vim modes), Strava management, custom types, data backup, and storage monitoring.
- Help overlay on every screen with context-aware content, triggered by ? icon or keyboard shortcut.
- Bottom nav (mobile) and sidebar (desktop) with Lucide icons.
- PWA with service worker caching, offline support, manifest with home screen shortcuts, and update banner.
- Capacitor Android wrapper with haptics, local notifications module, and tag-triggered APK builds via GitHub Actions.
- iOS Safari PWA install prompt to prevent IndexedDB eviction.
- Eviction detection with canary row, localStorage marker, and recovery modal with restore-from-backup option.
- Error handling with TruingError codes, local error log (ring-buffered at 50 entries), and global window error listeners.
- Pre-commit secret scanning via Docker (gitleaks and trufflehog, pinned versions, fail-closed).
- CI pipeline on GitHub Actions (typecheck, lint, 58 unit and integration tests, production build).
- Cloudflare Pages deployment with adapter-cloudflare and stateless Strava token proxy.
- Dark mode respecting system preference with class-based override support.
- 58 tests across 11 files covering wear calculation, interval resolution, crypto round-trips, backup integrity, error handling, storage canary, keyboard shortcuts, platform detection, GPX import, and Dexie integration flows.

### Stack

SvelteKit 2, Svelte 5 (runes), TypeScript, Tailwind CSS 4, Dexie 4, Lucide, vite-plugin-pwa, Capacitor 6, Vitest, pnpm.

# TODO

Things that are deferred until a prerequisite lands or a follow up commit picks them up.

- Global toast/notification system. Singleton store + root layout component. Replace all scattered status strings with toast.success/error/warning calls. Flags for type, duration, optional action button.
- Parts bin. View for uninstalled but not retired components (no active installation, no retired_at). Show on bikes list or own tab. Include "Install on bike" and "Retire" actions. Also add "Uninstall" action on component detail and bike detail to remove a component from a bike without deleting it (closes the installation by setting removed_at).
- Playwright E2E tests and axe-core a11y. Needs Playwright browser deps installed (CI handles this).
- Quick-add-ride shortcut. Stripped down 3-tap form (bike, distance, done) with a FAB on the rides screen and a PWA home screen shortcut.
- Paid data packs. Authenticated delivery via Cloudflare Workers route that verifies purchase status before serving .truing files. Payment integration (Stripe or Lemon Squeezy). Pack marketplace UI.
- Strava post-back integration. Share service milestones (chain replaced at X miles, cost per mile) to Strava activity feed where friends already are.
- `projectedReplacementDate` in `wear.ts`. Marked v2. Needs helpers for current installation start date, current wear meters, interval meters, and add days ISO.
- Size-limit budget (.size-limit.json). v3. Bundle budget enforcement at 250 KB gzip.

# TODO

Things that are deferred until a prerequisite lands or a follow up commit picks them up.

- Onboarding auto-redirect. New users hitting / with zero bikes should redirect to /onboarding instead of showing the welcome inline.
- Investigate runtime migration smoke test. Verify migration succeeded on app startup, trigger recovery UI on failure.
- Pre-migration backup prompt. Before major version upgrades, prompt user to export first.
- Playwright E2E tests and axe-core a11y. Needs Playwright browser deps installed (CI handles this).
- Quick-add-ride shortcut. Stripped down 3-tap form (bike, distance, done) with a FAB on the rides screen and a PWA home screen shortcut.
- Paid data packs. Authenticated delivery via Cloudflare Workers route that verifies purchase status before serving .truing files. Payment integration (Stripe or Lemon Squeezy). Pack marketplace UI.
- Strava post-back integration. Share service milestones (chain replaced at X miles, cost per mile) to Strava activity feed where friends already are.
- `projectedReplacementDate` in `wear.ts`. Marked v2. Needs helpers for current installation start date, current wear meters, interval meters, and add days ISO.
- Size-limit budget (.size-limit.json). v3. Bundle budget enforcement at 250 KB gzip.

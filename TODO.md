# TODO

Things that are deferred until a prerequisite lands or a follow up commit picks them up.

- GitHub issue template (.github/ISSUE_TEMPLATE/bug.yml). Structured bug report form with error code field.
- Wire Capacitor local notifications to dashboard wear data. The notifications module exists but nothing calls scheduleWearReminder() from the dashboard yet.
- Early warning notification threshold. Fire when a component crosses into "due soon" since the last check.
- Settings notifications section. Show "Notifications are only available in the installed app" on web PWA.
- Schema migration test fixture. Simulate a past schema version and replay through migration code.
- License-check script (pnpm run license-check). Fail on non-AGPL-compatible transitive deps.
- Onboarding auto-redirect. New users hitting / with zero bikes should redirect to /onboarding instead of showing the welcome inline.
- Investigate runtime migration smoke test. Verify migration succeeded on app startup, trigger recovery UI on failure.
- Pre-migration backup prompt. Before major version upgrades, prompt user to export first.
- Playwright E2E tests and axe-core a11y. Needs Playwright browser deps installed (CI handles this).
- Quick-add-ride shortcut. Stripped down 3-tap form (bike, distance, done) with a FAB on the rides screen and a PWA home screen shortcut.
- Paid data packs. Authenticated delivery via Cloudflare Workers route that verifies purchase status before serving .truing files. Payment integration (Stripe or Lemon Squeezy). Pack marketplace UI.
- Strava post-back integration. Share service milestones (chain replaced at X miles, cost per mile) to Strava activity feed where friends already are.
- `projectedReplacementDate` in `wear.ts`. Marked v2. Needs helpers for current installation start date, current wear meters, interval meters, and add days ISO.
- Size-limit budget (.size-limit.json). v3. Bundle budget enforcement at 250 KB gzip.

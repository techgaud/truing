# TODO

Things that are deferred until a prerequisite lands or a follow up commit picks them up.

- CHANGELOG.md. Create before first merge to main and v1.00 tag.
- CI pipeline (.github/workflows/ci.yml). Typecheck, lint, build on push. Add test steps when tests exist.
- README.md. First-person, not marketing. Screenshots over bullet points.
- Playwright E2E tests and axe-core a11y. Needs Playwright browser deps installed (CI handles this).
- Size-limit budget (.size-limit.json). Bundle budget enforcement at 250 KB gzip.
- Bike photo upload. Needs the Capacitor camera plugin and client side canvas resize.
- `projectedReplacementDate` in `wear.ts`. Marked v2. Needs helpers for current installation start date, current wear meters, interval meters, and add days ISO.

# Truing

Bike maintenance tracker. Runs in your browser, stores everything locally, and stays out of your way.

I built this for myself and figured other people might find it useful too! I ride gravel, mostly, and wanted
a simple way to know when my chain is due, when my brake pads need checking, and whether or not I could get some more life out of my tires.
Everything out there was either locked to iOS, behind a paywall, too barebones, or didn't work the way that my brain does, so I made the tool that I needed!

It's free, it's open source (AGPL-3.0), and your data never leaves your device!

**Live at** https://truing.app

## What it do

- Track every component on every bike. Chains, cassettes, tires, brake pads, bar tape, bearings,
  brake fluid, cables, whatever you care about.
- A dashboard that tells you what needs attention based on distance or time, whichever comes first.
- Log rides from Strava, GPX files, FIT files, or just type it in.
- Move components between bikes and keep the wear history intact. That wheelset you swap between
  your gravel and road bike? Truing handles it!
- 50+ component types with sensible default service intervals already filled in. No research required.
- Works offline. Works as a PWA. Works as a sideloaded Android app.
- Full JSON export and import for backup. Your data, your file, put it wherever you want.

## Design choices

A few things Truing does and does not do, by design.

- **Local-only.** No cloud sync, no server, no account. Your data lives on your device and
  a backup file you control.
- **No gamification.** No streaks, no badges, no daily check in reminders.
- **No tracking.** No analytics, no telemetry. There's nothing server-side to report to.
- **No ads.** Fuck ads.

## Getting started

1. Open https://truing.app
2. Add your first bike
3. Tap "Load typical list" to pre-populate common components, or add them one at a time
4. Log rides manually, import GPX/FIT, or connect Strava
5. The dashboard shows you what needs attention

That's it! Tap the **?** icon on any screen if you want a hand.

## Installing as a PWA

- **Desktop (Chrome, Edge, Brave)** click the install icon in the address bar.
- **iOS Safari** tap the share button, then "Add to Home Screen." This is important on iOS
  because Safari clears data from sites you haven't visited in a week unless installed as a PWA.
- **Android** the browser should prompt you, or use the menu and tap "Install app."

## Connecting to Strava

Truing uses a bring-your-own-token model. You create your own Strava API app and paste the
credentials in. This way there's no shared rate limits, no middleman server, and your tokens
stay on your device.

Takes about 3 minutes! The in-app setup walks you through it.

1. Go to https://www.strava.com/settings/api
2. Create an application (any name and website work)
3. Set "Authorization Callback Domain" to `truing.app`
4. Paste the Client ID and Client Secret into Truing's Settings
5. Authorize on Strava's page, and you're set

## Found a bug?

If something breaks or feels wrong, please open an issue at
https://github.com/techgaud/truing/issues! Include what you were doing, what happened,
and if possible the debug info from Settings (there's a "Copy debug info" option that
grabs error logs without any personal data).

Even small things are worth reporting! A confusing label, a button that doesn't feel right,
a number that looks wrong. All of it helps make Truing better for everyone!

## Contributing

PRs are welcome and genuinely appreciated! If you're thinking about something small (typo fix,
UI tweak, bug fix), just open the PR. If it's something bigger (new feature, architectural
change), open an issue first so we can talk about it before you put in the work!

To get a dev environment running.

```bash
git clone https://github.com/techgaud/truing.git
cd truing
pnpm install
pnpm dev
```

Requirements: Node 20+, pnpm, Docker (for the pre-commit secret scanner that runs on every commit).

Open http://localhost:5173 and you're in!

### Tests

```bash
pnpm test:unit         # Vitest, 53 tests across 11 files
pnpm run check         # TypeScript + svelte-check
pnpm run lint          # ESLint + Prettier
pnpm run build         # production build
```

CI runs all of these on every push. If CI is green, you're all set!

### Building the Android APK

```bash
ADAPTER=static pnpm run build
pnpm exec cap sync android
cd android && ./gradlew assembleDebug
```

APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`. Sideload to a real device.
Tag-triggered CI builds APKs automatically and attaches them to GitHub releases.

### Branch strategy

- `dev` is where work happens.
- `main` is what's deployed to truing.app.

## Support the project

If Truing is useful to you, let me know! A few things go a long way.

- **Star the repo!** It helps other people find it! https://github.com/techgaud/truing
- **Sponsor!** If you want to support development directly, GitHub Sponsors is set up at!
  https://github.com/sponsors/techgaud. Totally optional, but really appreciated!
- **Tell a friend!** If you know someone who obsesses over their drivetrain, send them the link!
- **Open a PR!** Code contributions are the best kind of support!

## Alternatives

Other great tools in this space, in case Truing isn't quite what you're looking for.

- **Strava Gear** free, built into Strava. Basic component mileage tracking, no reminders or intervals.
- **ProBikeGarage** paid, iOS and Android. Well reviewed, full-featured.
- **mainTrack.app** paid, iOS-only. Strava integration, no default intervals.
- **A spreadsheet** where we all started! Flexible but no reminders.

## License

AGPL-3.0. See [LICENSE](./LICENSE) and [ATTRIBUTIONS.md](./ATTRIBUTIONS.md).

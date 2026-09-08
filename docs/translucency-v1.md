# Translucency · Version 1

A local-first Next.js PWA for understanding what you are carrying and borrowing a perspective before returning to life. The defining element is an intact resin-like material panel, never a health score.

> The app should help the user understand themselves without teaching them to monitor themselves more.

## Run on your Windows PC

Requires Node.js 22 LTS or newer and npm. The application has been tested with Node 24 and Next.js 16.3.4. No accounts, API keys, database services, or environment variables are required.

Open PowerShell:

```powershell
cd "C:\Users\RonnieSingh\Documents\ChatGPT\Translucency"
npm.cmd install
npm.cmd run build
npm.cmd start
```

Open **http://localhost:3000**. Keep this terminal running while using the app online. The production build is the appropriate build for installation and offline testing. Dependencies are locked in `package-lock.json`; use `npm.cmd ci` for a clean reproducible installation.

For development with automatic reload:

```powershell
npm.cmd run dev
```

Do not run development and production on the same port simultaneously. Stop the running command with Ctrl+C before switching. The service worker only registers in production. If switching back to development after installing the PWA, unregister the worker in browser DevTools → Application → Service Workers; this does not delete IndexedDB.

## Work on the project across computers

Source code is held in the private repository https://github.com/ronnie6705/translucency. Sign in to GitHub with access to that repository, then clone it on each computer:

```powershell
git clone https://github.com/ronnie6705/translucency.git
cd translucency
npm.cmd ci
npm.cmd run dev
```

Before starting work on another computer, commit and push your changes from the first computer. On the other computer, run `git pull --ff-only` and `npm.cmd ci` before continuing. Commit and push finished work there as well. Git transfers committed source files; it does not automatically transfer unsaved edits or running servers. Each computer needs Node.js and Git installed.

Do not sync `node_modules`, `.next`, environment files, or browser profiles through a shared folder. Dependencies are recreated from the lockfile. Personal history remains in each browser's IndexedDB and is never included in this repository. Hosting the app at one HTTPS address will not sync history between devices or move existing localhost history to that address.

## Use on mobile

The server listens on all network interfaces. Connect your phone and PC to the same trusted Wi-Fi network. Run `ipconfig` on your PC, find its Wi-Fi/Ethernet IPv4 address, and open `http://YOUR-PC-IP:3000` on your phone. Allow Node through Windows Firewall for your private network if Windows prompts you. This provides normal browser use with persistence.

**A phone cannot install a PWA or register its service worker over an ordinary LAN HTTP address.** HTTPS with a certificate the phone trusts is required. `localhost` is a secure-context exception only on the device running the browser; your phone's localhost is not your PC.

For installable mobile testing, place the production server behind a trusted HTTPS reverse proxy or a consciously chosen HTTPS tunnel. A local certificate must be trusted on both devices. Do not simply bypass a certificate warning and expect PWA installation to work. This build does not publish or expose your PC to the internet automatically.

Each browser/origin has independent local data. Opening the same site on your phone does not copy your PC's history. Even `localhost` and a LAN IP on the same PC are different origins.

## PWA installation and offline testing

1. Run `npm.cmd run build` and `npm.cmd start`.
2. Open `http://localhost:3000` in current Edge or Chrome in a **normal, non-private** window.
3. Finish onboarding. In DevTools → Application, confirm the manifest and an activated service worker. Allow the initial shell cache to finish.
4. Install using the address-bar install icon or browser menu → Apps → Install this site as an app. It opens in standalone mode.
5. On an iPhone, use Safari on the trusted HTTPS origin → Share → Add to Home Screen. On Android, use Chrome's Install app/Add to Home Screen option.
6. Test offline in DevTools → Network → Offline, then reload. Existing data, check-ins, roles, Journey, and Insights remain available. Return the network setting to Online afterward.

The production worker precaches the document, its initial JavaScript/CSS, manifest, and icons, and caches subsequent same-origin static assets. All screens live within the cached application shell; navigation uses URL hashes so direct links and browser Back work offline. No health data is placed in the service-worker cache or sent over the network.

When changing the offline caching strategy, bump `CACHE` in `public/sw.js`. Browser storage eviction or manually clearing site storage can remove offline files and user records. Offline access requires one successful initial online visit.

## What is included

- Three-step onboarding: material philosophy, familiar sources, and 2–3 preferred roles.
- A desktop sidebar and asymmetric dashboard; compact mobile navigation and reorganised content.
- Four self-selected material states, layered light, moisture, grain, diffusion, and reduced-motion support. No displayed percentage or computed sensitivity score.
- Short check-in with independently saved water/drying moments, at most three optional signals, reflection, and an optional used role/helpfulness rating.
- Independent Water/Drying moments: category, optional instance note, timestamp, and explicitly chosen +1…+10 / -1…-10 perceived impact. Home and check-in share the same editor. Open any moment to edit or delete it; repeat categories freely.
- Distinct absorption and clearing/evaporation responses in the existing material, with bounded visual intensity and a reduced-motion alternative. Recorded translucency remains self-reported.
- Secondary daily water/drying/balance totals, historical moments, and frequency/average-impact insights. There is no target balance to achieve.
- A gentle reminder for another check-in within four hours, without blocking meaningful updates.
- Water, drying, and optional signal libraries with favourites and personal sources.
- All six specification roles, custom roles, deterministic reappraisal, optional Observe mode, and later helpfulness/reflection in Journey.
- A rolling 30-day material Journey, calendar month browsing, all check-ins and role sessions per day.
- Deterministic pattern insights with cautious wording and explicit sample-data controls.
- Settings, optional in-app morning/evening invitations, JSON export, sample reset, and full local-data deletion.
- Manifest, 192/512px PNG icons, maskable icon, standalone mode, and production offline support.

## Architecture

```text
src/app/
  layout.tsx        Metadata, viewport, global style entry
  page.tsx          Next.js application entry
  manifest.ts      Installable app metadata
  globals.css      Token-based CSS, material rendering, responsive layouts
src/components/
  app.tsx          Shell, navigation, onboarding, Home, local commit boundary
  material.tsx     Reusable large/miniature intact material object
  influences.tsx   Shared accessible moment dialog, entry lists and daily summary
  ui.tsx           Accessible buttons, chip selectors, headings, links
  check-in.tsx     Check-in and personal source libraries
  roles.tsx        Role library, custom role creation, reappraisal session
  reflect.tsx      Journey, insights, settings, privacy, later reflection
  reminder.tsx     Optional in-app invitations, dismissible for each period
src/lib/
  types.ts         Typed domain model, local calendar dates, identifiers
  storage.ts       Versioned IndexedDB, atomic read/modify/write transactions
  catalog.ts       Default roles, source catalog, context-based role suggestion
  seed.ts          Clearly marked demo history and empty-data defaults
  insights.ts      Pure deterministic daily aggregation and insight functions
  influences.ts    Signed impact validation, per-day queries, category averages
  migration.ts     Lossless v1 → v2 document migration; no invented ratings
public/
  sw.js            Production app-shell caching
  icon-*.png       Install icons
tests/
  insights.test.ts Pure logic tests
  browser-check.mjs Full browser flows, responsive widths, offline/installability
  influences-browser.mjs Migration, event CRUD, animation, close/reopen and reduced motion
docs/
  product-spec.md  Supplied source-of-truth specification
  implementation-plan.md Design and implementation decisions
  validation.md    Verification scope and remaining limitations
```

The styling uses organised, token-based native CSS rather than Tailwind; this keeps the handcrafted material layers clear and avoids adding a styling runtime. React renders only after local data has loaded, so dates and browser APIs do not produce server hydration mismatches. There are no API routes or backend dependencies. Next serves the static application shell and assets.

## Storage and privacy

Core data lives in database `translucency-v1` (name preserved), IndexedDB version `2`, object store `app`, key `data`, document schema version `2`. The typed document contains profile preferences, check-ins, custom roles, role sessions, and a separate `influences` collection. Instances are independently queryable through `src/lib/influences.ts`; they do not require a check-in. Totals and averages are computed from these records, never stored as a second source of truth. Writes use an IndexedDB read/write transaction; first-use initialisation also checks within its transaction to avoid overwriting another tab. Web Locks are used when available, and BroadcastChannel refreshes other open tabs after a successful save. Failed saves show an error and do not navigate as if the save succeeded.

Existing v1 documents migrate automatically and atomically on load. Every old factor becomes an independent instance with its original category, timestamp, check-in link, demo marker and original text intensity. Because the old data did not contain numeric ratings, migrated impacts are `null` and visibly marked **Impact not recorded**. They count toward frequency but not numeric totals or averages. Editing an old moment requires choosing a numeric impact. New moments always require a valid signed integer. Deterministic migration IDs prevent duplication on repeated migration. Existing notes, states, profiles, custom sources/roles and sessions are preserved. The physical database version also prevents stale v1 application tabs from writing old-schema data; refresh older tabs after the update. No reset is required.

Only dismissed in-app reminder preferences use localStorage (`translucency-reminder-*`). Data is not encrypted at rest beyond protections supplied by the device/browser. Someone with access to your browser profile may access it. This is not cloud storage or a backup.

Dates are grouped according to the browser's local timezone. The final check-in represents a day in the calendar and daily insight aggregation; all entries remain available in day detail. Changing timezone can regroup timestamps. An unsaved dialog is a draft. Saving a moment persists it independently, including inside a check-in: cancelling the check-in keeps saved moments. Saving the check-in links that day's unlinked moments without duplicating them.

## Demo data and reset

`src/lib/seed.ts` creates 28 prior-day demo check-ins, labelled role sessions, and varied individual influence moments (Poor sleep, Work stress, Health uncertainty, Walk, Gym, Meditation and Social connection). Numeric impacts vary by instance. Demo is enabled initially, offered as an onboarding choice, and clearly disclosed in Journey/Insights. **Demo entries never set your current state or today's personal totals.** The initial panel is an invitation to select a state. Existing users can use **Reset demo data** to replace old unrated samples with the richer examples; personal data stays intact.

In **Settings & privacy → Your local data**:

- **Export my data** downloads a readable JSON copy. Keep exports private. V1 does not yet import backups.
- **Clear demo data** removes only sample records, preserving your entries and preferences.
- **Reset demo data** replaces sample records with a fresh relative-date history without duplicating them or removing your entries.
- **Delete all local user data**, then type `DELETE`, removes all profile information, entries, sessions, personal sources, and custom roles. It clears reminder preferences and returns to onboarding. A minimal empty schema remains so refresh does not silently recreate demo data. New onboarding can explicitly opt into examples again.

## Tests

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

For the full browser suite, keep the production server running in a separate terminal:

```powershell
npm.cmd start
```

Then run:

```powershell
npm.cmd run test:e2e
npm.cmd run test:influences
```

The suite uses installed Microsoft Edge in headless mode and its own disposable test profile under `test-results`. It never uses your normal browser profile or deletes your real app data. It checks onboarding, persistence, source creation, check-in, anti-compulsion copy, custom roles, reappraisal, later reflection, Journey, Insights, 360/390/768/1024/1280/1440px widths, sample controls, export, full deletion, offline operation, and Chromium installability diagnostics. Screenshots and profiles are excluded from Git. You can remove `test-results` after testing if you do not need the artifacts.

## Deliberate V1 choices and limitations

- Four categorical states replace the specification's optional internal 0–100 mapping. Visual parameters map directly to those states; the user never receives a scientific-looking score.
- Morning/evening use one flexible check-in form. Optional in-app invitations respect the chosen rhythm. No scheduled OS/background notifications are sent.
- Reappraisal is role-specific, deterministic, and transparent; the entered concern is retained as context rather than sent to an LLM or interpreted medically.
- No account, sync, wearable data, diagnosis, crisis triage, streaks, or social features.
- Export is available; import, editing check-in reflections, and editing/deleting individual custom roles are not included yet. Full deletion remains available.
- Water/Drying moments can be edited and deleted individually. Editing check-in states/reflections or custom roles remains outside this update. The material's event tint is temporary, decorative, and non-accumulating; reload returns to the last self-reported appearance.
- Local records are kept in one transactional document, appropriate to a personal V1. Very large histories would benefit from separate indexed stores and pagination.
- Desktop Chromium installation prerequisites and offline behavior are verified automatically. Native Windows install UI and physical iOS/Android installation require manual testing on those devices.

## Version 1.1 priorities

1. Real-device iOS/Android PWA testing, keyboard/screen-reader review, and a full contrast/touch-target audit.
2. Validated backup import, optional storage-persistence request, and careful schema migrations.
3. Editing saved reflections and custom roles, with clear history-preservation behavior.
4. More context-sensitive deterministic perspectives and insight evidence detail without adding monitoring pressure.
5. Only if useful in real use: opt-in background reminders with a clearly documented delivery model.

Framework/PWA implementation reference: [Next.js Progressive Web Apps guide](https://nextjs.org/docs/app/guides/progressive-web-apps).

# Your space — Translucency & Rhythm

A local-first Next.js PWA that brings reflection and energy-aware planning into one application. The shared visual system comes from Rhythm: system typography, black and indigo backgrounds, glass surfaces, rounded cards and controls, and light/indigo task-building dialogs.

## Run locally

Requires Node.js 22+ and npm. The app opens with login and requires Supabase account configuration using the two public settings in `.env.example`; see [cloud setup](docs/cloud-setup.md). Existing device-only data remains available for explicit import after sign-in. Missing configuration shows a setup notice rather than exposing the workspace.

```sh
cd /Users/ranvijaysingh/Documents/ChatGPT/Rhythm/platform
npm ci
npm run dev
```

Open http://127.0.0.1:3000. For the production build and offline/PWA support:

```sh
npm run build
npm start
```

Stop an existing server on that port before starting another. To use another port, pass `-- --port 3001`. The server binds to localhost by default.

## Two apps, one interface

- The sidebar expands on hover or keyboard focus. Pin it open for a stable layout; its preference is remembered locally. Small screens use an explicit menu drawer with Escape, focus containment and focus return.
- Translucency retains onboarding, self-reported material states, check-ins, water/drying moments, source libraries, perspectives, custom roles, Journey, insights, reminders and privacy controls.
- Rhythm retains task lists, task durations and energy, breaks, fixed commitments, chronotypes, adjustment, time-range selection, schedule preview and ICS export.
- Both module roots remain mounted when switching products. Switching back to Translucency returns to its last screen and preserves an in-progress check-in. Closing a Rhythm task dialog discards that unsaved draft, as before.
- Settings includes clearly scoped data controls for both products. Deleting Translucency data does not delete Rhythm plans, and vice versa.
- Check-ins do not automatically change schedules. Sharing mental-state context with planning is a future, explicit opt-in feature.

Hash navigation preserves existing Translucency links and works offline: `/#home`, `/#check-in`, `/#roles`, `/#journey`, `/#insights`, `/#settings`, `/#rhythm`, `/#rhythm-tasks`, `/#rhythm-timeblocks`.

## Design and code

```text
src/app/design-system.css           Shared Rhythm tokens and styling
src/components/platform-shell.tsx  Product sidebar, mobile drawer, top bar
src/components/app.tsx             Module navigation and Translucency flows
src/components/                    Translucency screens and material visual
src/lib/                           Translucency domain, storage and migrations
src/modules/rhythm/                Imported Rhythm UI and scheduling engine
src/modules/rhythm/library.ts      Planning storage and migration
src/modules/rhythm/data-settings.tsx Planning backup/import/delete controls
public/sw.js                       Offline shell for both apps
tests/                             Logic and browser regression coverage
```

Product CSS is scoped under `.translucency-module` and `.rhythm-module`, so generic class names and controls do not leak across apps. Shared fonts, colour tokens, card treatments, controls and responsive integration rules live in `design-system.css`. The material metaphor remains intact and uses the shared indigo palette. Rhythm's chronotype and energy-block colours are retained.

## Existing data and migration

Translucency continues to use the existing `translucency-v1` IndexedDB database, version 2, including its lossless v1 migration. Rhythm uses `rhythm-library-v1`, version 1. Planning writes are transactional and only close the save flow after a successful write. Other tabs refresh through BroadcastChannel and focus events.

On first use, Rhythm reads `rhythm:saved-task-lists` and `rhythm:saved-timeblocks` from localStorage **at the same browser origin**, validates them and imports them into IndexedDB. The old keys remain as a recovery copy until explicit Rhythm data deletion. Repeated loads do not import twice. Invalid data produces an error rather than silently resetting it.

Browser origins are separate: `localhost:3000`, `127.0.0.1:3000`, `localhost:5173` and `localhost:3001` do not share data. A new address does not inherit the old app's history. Use the exact address previously used for automatic migration.

Settings includes a validated JSON export/import for Rhythm. Imports merge by ID and keep existing records when IDs match. Account records sync between signed-in devices; guest data stays separate until explicitly imported. Neither product automatically changes the other's domain records.

To move a legacy Rhythm library from a different origin, open the old Rhythm site and run this in its browser developer console, then import the downloaded file in the new app's Settings:

```js
const backup = {
  version: 1,
  taskLists: JSON.parse(localStorage.getItem('rhythm:saved-task-lists') || '[]'),
  timeblocks: JSON.parse(localStorage.getItem('rhythm:saved-timeblocks') || '[]'),
};
const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], {type: 'application/json'}));
const link = document.createElement('a');
link.href = url;
link.download = 'rhythm-backup.json';
link.click();
setTimeout(() => URL.revokeObjectURL(url), 1000);
```

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Run the current login/account browser suite with a dedicated synthetic Supabase endpoint (no real emails or accounts):

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-test-publishable-key npm run dev -- --port 3002
# In a second terminal:
npm run test:accounts
```

Browser tests use disposable profiles and synthetic records, never the normal browser profile. Set `BASE_URL` to test another local address and `BROWSER_CHANNEL` to override the default (Chrome on macOS, Edge on Windows). Screenshots and exported test data are written to the git-ignored `test-results` folder.

Current coverage includes login-first deep links, password login without sending email, restored sessions, sign-up consent, email throttling, recovery/password update, PKCE callbacks, guest/account isolation, two-device sync, offline conflicts, backup, import and desktop/mobile layouts. Unit tests cover domain migrations, scheduling and database permissions. The older `test:e2e`, `test:influences` and `test:platform` scripts predate mandatory login and still assume a guest workspace; they need authenticated fixtures before being used against this release.

## Scope and origins

This checkout starts from Translucency commit `97b6ea1` and imports Rhythm from the local `/Users/ranvijaysingh/rhythm-app` checkout (commit `214a5ac`). The original Rhythm repository has not been modified. The earlier temporary Vite starter in the parent directory is not the integrated app.

Both products share navigation, presentation, and required Supabase sign-in. Their domain records stay separate. Cloud sync uses per-user offline caches and revision-checked writes; conflicts require review. Supabase provisioning and email delivery must be configured for account creation/recovery. Password sign-in does not send an email. There are no background OS notifications, automatic mental-state scheduling, or new live timer. Physical-device PWA installation still needs real-device testing. Existing scheduling heuristics remain the basis of Rhythm; broader algorithm improvements are a separate feature.

Original Translucency background and constraints are retained in [docs/translucency-v1.md](docs/translucency-v1.md) and [docs/product-spec.md](docs/product-spec.md).

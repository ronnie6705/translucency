# Water / Drying instances update

The existing visual system is retained: serif display type, matte off-white surfaces, blue Water/green Drying cards, sidebar and mobile navigation, and intact resin material. The new editor and interactions extend those surfaces.

## Components and files

- `src/components/influences.tsx`: native modal dialog, category/note/rating editor, discreet edit/delete, event lists, totals, shared editor hook.
- `src/components/material.tsx`: water travel/absorption and distinct drying clearing/evaporation; bounded magnitude; short feedback label.
- `src/components/app.tsx`: today's personal moments on Home, add actions, secondary balance, optional user-confirmed state adjustment.
- `src/components/check-in.tsx`: same independent moment flow, optional linkage on check-in save; no category deduplication.
- `src/components/reflect.tsx`: day-level events, timestamps, edit/delete, totals and event-aware Insights; demo clear includes moments.
- `src/app/influences.css`, `layout.tsx`: additive styles only; no new design system or animation dependency.
- `src/lib/types.ts`, `influences.ts`, `migration.ts`, `storage.ts`, `seed.ts`, `insights.ts`: schema, queries, safe migration, persistence and deterministic analysis.
- `public/sw.js`: new cache version so the updated production shell replaces the previous version.
- Tests, npm scripts, README and this report document the change.

## Data, migration and totals

`InfluenceInstance` stores id, local user id, type, category id/label, optional note, signed impact, timestamp, optional check-in id, and optional demo/legacy metadata. Events live in a separate array within the existing transactional IndexedDB document. Queries do not have to inspect CheckIns. Repeated categories always receive new IDs.

Both the IndexedDB version and document schema advance to 2, retaining the original database name and object store. Migration runs atomically and is idempotent. Old categories become separate records; original verbal intensities remain visible. Old records use `impact: null` because assigning +3/+5/+8 to an unquantified impression would fabricate data. New or edited instances require an integer in the requested signed range. Unknown future versions abort without a write. No original profile, state, reflection, custom role, signal or session is discarded.

Daily totals filter by local calendar date and sum rated impacts: Water positives, Drying negatives, and their sum for Balance. Unrated older moments are explicitly excluded. Nothing is written back to the self-reported state. Delete/edit naturally changes all derived queries; no duplicated total can become stale.

## Material responses

Water sends a small diffused moisture shape from the source card toward the material. An internal radial bloom/ripple follows, while density decreases slightly and moisture visibility increases. It fades without distorting the slab. A short `+6 water` label confirms the saved event.

Drying uses an upward clearing veil with receding moisture and a small increase in density. No droplet travels backwards. Its `-5 drying` label has the same restrained duration. Both responses start only after IndexedDB commits successfully.

Magnitude maps `abs(impact)` into a clamped decorative amplitude of 0.315–0.63. This affects opacity/bloom strength and a small local density tint; it is not a mathematical sensitivity model. Responses do not accumulate into a score, and the canonical state never changes until the user records a new state. A reload returns to that self-reported appearance.

Under reduced motion, travelling shapes/ripples/evaporation are suppressed, the subtle appearance change is immediate, and the new entry is briefly highlighted. The signed value and text still communicate the result. On narrow screens the material is brought into view when necessary for the response; no notification or repeat-checking timer is added.

## Insights

- Frequency counts individual instances, including repeated categories.
- Category averages divide the signed total by the number of explicitly rated instances, not all legacy entries.
- Higher-average but less-frequent water categories can be compared cautiously.
- Most-frequent drying and stronger average drying impressions are distinguished.
- Timing observations require an earlier self-report on the event's day or preceding day, followed by a lower self-report on the same/next day. Multiple events before the same later check-in count as one occasion per category.
- Missing days are not interpolated; associations never claim causation or diagnosis. Demo-derived conclusions are disclosed and can be excluded.

## Verification

Final verification: production build and TypeScript pass; 13 unit tests pass. Both the influence workflow suite and the original app regression suite pass with no page errors. Chromium reports no manifest/installability errors. Desktop and mobile screenshots were reviewed, including both material responses and the new dialog. A final layout check keeps the material's background light sources aligned when longer event lists make the Home cards taller.

Run a production server, then `npm.cmd test`, `npm.cmd run test:e2e`, and `npm.cmd run test:influences`.

The influence browser suite creates an actual v1 IndexedDB fixture, upgrades it, adds Poor sleep +6 and Gym -5, checks both distinct animations, reloads, repeats a category, edits category/note/impact in Journey, deletes an instance, checks totals/averages, closes and reopens the browser profile, checks desktop/tablet/mobile layouts and keyboard controls, tests reduced motion, and saves offline. It asserts that recorded translucency never changes from logging events. Existing onboarding, role, check-in, PWA and deletion regressions run separately. Profiles are isolated under ignored `test-results/` and never touch your normal browser data.

## Manual local workflow

1. `npm.cmd run build`, then `npm.cmd start`; open `http://localhost:3000`.
2. On Home, **Add water** → Poor sleep → optional note → rail to **+6** → **Save moment**. Watch absorption. Refresh to confirm persistence.
3. **Add drying** → Gym → optional note → **-5** → **Save moment**. Watch clearing. With no other rated personal moments, totals are +6, -5, +1.
4. Open Journey → today → select either moment. Edit and save, or use the discreet delete action and confirmation. Check totals after returning Home.
5. Open Insights to see frequency/average-impact observations; expand the evidence list. Turn off demo data to inspect only your moments.
6. In browser rendering tools, emulate reduced motion. Save another moment; it highlights without travelling shapes. Resize to 390px or use a phone on the same local network.
7. Production PWA installation/offline requirements are unchanged; a phone requires trusted HTTPS. No reset of existing data is necessary.

## Limits

No newly entered rating is inferred from category or note. No accumulated visual score, diagnosis, compensation target, background notification, or sync was introduced. Old numeric impacts cannot be recovered because they never existed. Events remain in the existing single-document storage architecture; a future very large history could use indexed per-instance stores. Event timestamps are automatic and preserved during edits; backdating is not included. Browser close/reopen and responsive/reduced-motion behavior are automated; physical iOS/Android installed-window behavior still benefits from on-device testing.

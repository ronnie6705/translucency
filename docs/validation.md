# V1 verification · 7 September 2026

For the subsequent Water/Drying instance update, its 13 logic tests, migration and animation verification, see [influence-update.md](influence-update.md).

## Result

Production build and TypeScript checks pass. Six focused logic tests pass. The complete browser flow suite passes in a dedicated headless Microsoft Edge profile with zero JavaScript page errors and zero Chromium PWA installability errors.

## Verified story

Onboarding → a short state/source check-in → atomic IndexedDB persistence → refreshed Home → a saved role perspective → later reflection → material Journey and deterministic Insights. Every data boundary stays inside the browser; no API or backend is involved.

| Area | Evidence |
| --- | --- |
| Onboarding | Name, source favourites and preferred roles save; completed onboarding survives reload. |
| Sources | Custom Water and Drying Sources are created and retrieved after refresh. Optional Signals screen renders. |
| Check-in | Self-selected state, water/drying factors, optional signal and note save; Home displays the saved state after refresh. |
| Anti-compulsion | A subsequent check-in within four hours shows the gentle guidance without blocking access. |
| Roles | A custom Calm Pilot role is created, remains after reload, and can start a session. |
| Reappraisal | Concern, anxious interpretation, role-based text, carry statement and optional Observe state save. |
| Later reflection | The saved session opens in Journey; helpfulness and reflection persist. |
| Journey | Rolling 30-day material view, day detail, recorded sources, note and role session render. Month controls are implemented. |
| Insights | Cards derive from entries and optional ratings, with sample-data disclosure. Unit tests cover missing days, daily aggregation and recorded recovery episodes. |
| Responsive layout | Home, roles, Journey, Insights, Settings and check-in checked at 360, 390, 768, 1024, 1280 and 1440 pixels with no horizontal page overflow. Desktop and phone screenshots visually reviewed. |
| Preferences | Reminder rhythm survives refresh after successful save. |
| Export | JSON download parses and contains the saved profile. |
| Sample controls | Clear removes only demos; reset restores 28 demo records while preserving personal entries. |
| PWA | Production manifest has no errors; Chromium reports no installability errors in a non-private profile. |
| Offline | Controlled page reloads and navigates offline; an offline check-in saves and survives another reload. |
| Full deletion | Explicit DELETE confirmation clears entries, sessions, custom roles and profile; onboarding returns and reload does not reseed data. |

## Fixes made during verification

- Fixed CSS specificity that let miniature history panels grow outside their container.
- Gave state buttons explicit accessible names independent of decorative material descriptions.
- Captured reminder selection before the asynchronous storage callback, preventing a controlled input from reverting the saved value.
- Made first-use database initialisation transactional to avoid overwriting another tab's first save.
- Kept stale check-in language tied to its recorded moment, rather than implying it describes today.
- Preserved empty storage after deletion while allowing an explicit new onboarding choice to restore examples.
- Used a non-private test profile for PWA diagnostics; browsers intentionally prohibit installation in private mode.

## Limits of this validation

Browser tests verify installation prerequisites, not an actual Windows OS installation click. Physical iPhone/Android installation and platform-specific eviction behavior still require device testing over trusted HTTPS. Responsive tests simulate viewport widths; they are not a substitute for real touch and screen-reader review.

The app respects reduced motion, provides semantic forms, visible focus states and pressed-state selectors. A comprehensive accessibility certification/audit was not performed. Background OS notifications, backup import and cross-device sync are outside this build.

Run instructions and exact test commands are in the root README. Browser artifacts are generated under ignored `test-results/`.

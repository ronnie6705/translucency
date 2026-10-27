# Intelligent recovery breaks

New timeblocks start with Balanced. Saved plans without recovery preferences continue to use their accepted schedule. Overnight scheduling, unsaved wizard drafts, and a remembered global preset are intentionally outside this release.

## Scheduling

`generateSchedule` remains backward-compatible. `generateScheduleResult` composes it with recovery planning and final validation and returns `valid`, `adjusted-recovery`, or `invalid` plus blocks, notices, errors, and inactive override keys. Recovery planning accepts an **unpaced base schedule**, not its previous output. Saved plans retain that base separately so repeated preset changes do not accumulate shifts or lose the accepted order.

Preset constants live in `recovery/recovery-presets.ts`. Target duration seeks a natural boundary; energy-weighted load and the maximum continuous-work target also make recovery desirable. Short next tasks may defer recovery by up to 15 minutes. Planned breaks and idle gaps of at least five minutes reset both counters. Upcoming planned breaks within 15 minutes can replace automatic recovery. Fixed commitments and user decisions take precedence over the soft maximum.

Long flexible work uses the shared schedule slicing primitive. Deep Focus avoids splitting until its maximum. Ordered placement is shared with manual reordering. Task allocations change through explicit user edits or the selected unified recovery preset, within its flexibility cap. If capacity is tight, optional recovery is shortened to five minutes, then omitted; explicitly adjusted durations are protected. Unused recovery splits are joined back together. An invalid result cannot be accepted or exported.

## Identity and persistence

Recovery blocks are schedule-level items with `recovery` metadata; they are never inserted into task lists. Overrides use a task-end anchor or a cumulative-work offset inside a task. End anchors follow the task even when live budgeting changes its length. Invalid anchors remain stored and inactive. Intentional removals are persisted. No Auto Breaks hides all recovery while retaining overrides, and planned breaks remain intact.

Saved timeblocks store preferences, overrides, the base schedule, and the accepted paced schedule. Explicit saved-task edits rebuild recovery and validate the result in the same storage transaction. Renaming preserves accepted times. Older saved plans are not migrated to automatic recovery.

## Live execution

The existing proportional budget allocator handles remaining work. Recovery reserves are recalculated in a bounded loop as budgets change. Past blocks and the active block are preserved during time-window edits; existing planned breaks and fixed appointments retain their instants. Only future recovery opportunities are regenerated. Break completion/skipping records dedicated execution events and suppresses immediate recreation. Elapsed break prefixes remain history; recovery actions do not mark library tasks complete. Run snapshots also retain initial recovery preferences.

ICS serialization continues to consume the accepted schedule directly. Historical previews remain independent of the global timer.

## Verification

- `npm test`: domain, scheduler, storage, timer and existing regressions.
- `node tests/recovery-breaks-browser.mjs`: synthetic account transport; preset changes, duration/removal overrides, reorder, planned breaks, mobile layout, save, ICS, timer skipping, reload, saved-plan reopening and reduced motion.
- `npm run typecheck` and `npm run build`.

This is a deterministic pacing heuristic, not a physiological fatigue measurement. The placement policy prefers preserving the accepted task order; it may reduce optional recovery rather than search all possible task permutations around fixed commitments.

## Live Schedule workspace

The Schedule step now owns a requested planning configuration and retains a deep-cloned last valid arrangement. `calculatePlanningSchedule` adapts estimates and task-boundary planned breaks, then delegates to the existing scheduler, shared placement/slicing primitives, recovery planner and validation. Invalid requests never replace the visible timeline or reach Start/Export. Canceling a pending planned break removes only that request; Cancel pending adjustments restores the last valid configuration.

Recovery results expose recommended, scheduled and unscheduled recovery minutes. Recommendation is measured after suppression/duration overrides and before optional capacity reductions. The UI distinguishes this shortfall from the minimum extra capacity needed for required work. Acknowledgement preserves the preset and scheduled breaks, and resets when the preset or recovery totals change.

Time ranges and workload can be changed inline without Apply or another preview. Estimates/removals affect the working timeblock only. Existing manual order is retained across task edits and preset/range changes; chronotype changes and explicit regeneration may replace it. Protected planned breaks use `Task.plannedBreakAfterTaskId`, follow the final task boundary, and remain pending if the owner is removed until repositioned/canceled. Only one new pending break can be added at a time. This additive optional field preserves historical data compatibility.

Accepting an edited saved timeblock creates a new ID and a cloned snapshot. The original saved schedule and execution history remain intact. Running Live Timer adjustment behavior is unchanged.

Validation: `npm test`, `npm run build`, `tests/planning-workspace-browser.mjs`, and the existing `tests/recovery-breaks-browser.mjs`. Browser suites use synthetic Supabase responses, never real account data. The planning suite covers full capacity, acknowledgement, pending/cancel/resolve, inline time edits, local estimates, orphaned break anchors, ordering, preset switching, fixed conflicts, responsive layout, copy-on-accept, ICS and reload.

Limits: same-day windows only; no earliest-feasible-end suggestion, priority recommendations, break dragging, or persistence of unfinished wizard requests. Fixed-time fragmentation can leave recovery unscheduled even when its total duration appears to fit.

## Unified recovery presets and allocation optimization

The right sidebar contains four Recovery presets, collapsed Advanced options, a conditional shortfall line linking to Adjust Schedule, and Undo last change. Balanced defaults to a 10% cap, Deep Focus 5%, Frequent Breaks 20%, and No Auto Breaks 0%. The advanced slider supports integer percentages from 0–20, committing on pointer release or after a short keyboard pause. Preset changes reset the cap to their default; saved custom values reopen unchanged. Permanent meters and the review/apply workflow have been removed.

`recovery-optimization.ts` restores eligible allocations to working estimates, uses spare capacity first, and evaluates capped proportional reductions plus three deterministic boundary-focused distributions through `calculatePlanningSchedule`. It searches at most 288 whole-minute reduction totals, each with up to four distributions (duplicates are skipped). Ranking uses actual recovery placed against the fixed unshortened objective, then least reduction, then the proportional candidate. It stops at the smallest total that meets the objective. This is a bounded search, not a global optimality guarantee. Fixed/disabled tasks and planned breaks are protected; percentage caps round down and the existing minimum and override-anchor safeguards remain active.

`use-recovery-workspace.ts` publishes accepted tasks, configuration, allocations and placements together. Scheduling input changes rerun optimization; explicit estimate edits reset their baseline and protect that allocation for that transaction. Failed changes remain pending over the last valid schedule and cannot save, launch, or export. No Auto Breaks restores recovery-owned reductions where tasks remain adjustable. Newly fixed or disabled allocations retain their protection. Routine rerenders and opening a stored accepted schedule do not optimize it. Legacy plans without a stored schedule use fallback reconstruction.

`recovery-history.ts` stores the preceding recovery settings, task-level allocations and a placement cache for up to 20 operations. It never stores task-library snapshots. Preset/slider and automatic-break override changes create entries; ordinary task/time/order edits do not. Unchanged-input Undo restores the exact accepted placement. Changed-input Undo recomputes with current manual edits and constraints; failed Undo leaves both state and history untouched. Explicit estimate changes invalidate only affected task portions. Older task-adjustment history migrates to this representation, and named flexibility values map to 5/10/20. The oldest recovery operation expires beyond the 20-entry bound.

Saved plans persist original working estimates, allocations, eligibility, effective percentage, recovery settings, accepted metrics/placement and Undo history. An edited saved plan is accepted as a new copy. Legacy accepted plans lacking recovery metrics display their stored recovery without inventing a shortfall; actual input changes calculate the new objective. Task-library estimates and running timer adjustment behaviour are unchanged.

Successful changes use one dismissible, polite, five-second toast after the existing approximately one-second transition. Obsolete notifications and animations are cancelled. Reduced motion updates immediately. Optional shortfalls remain beneath the presets after the toast disappears; required conflicts remain beside Adjust Schedule.

Verification: `tests/unified-recovery.test.ts`, existing allocator/planning/recovery domain suites, and `tests/recovery-panel-browser.mjs` cover restoration, transaction-protected estimates, caps, deterministic round trips, constrained placement alternatives, persistent Undo, legacy migration, exact reopen, pointer/keyboard input, rapid switching, pending conflicts, manual order, mobile/reduced motion, historical copies and export/launch parity. The existing planning/shortening browser entry points delegate to this unified flow.

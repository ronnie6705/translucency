# Intelligent recovery breaks

New timeblocks start with Balanced. Saved plans without recovery preferences continue to use their accepted schedule. Overnight scheduling, unsaved wizard drafts, and a remembered global preset are intentionally outside this release.

## Scheduling

`generateSchedule` remains backward-compatible. `generateScheduleResult` composes it with recovery planning and final validation and returns `valid`, `adjusted-recovery`, or `invalid` plus blocks, notices, errors, and inactive override keys. Recovery planning accepts an **unpaced base schedule**, not its previous output. Saved plans retain that base separately so repeated preset changes do not accumulate shifts or lose the accepted order.

Preset constants live in `recovery/recovery-presets.ts`. Target duration seeks a natural boundary; energy-weighted load and the maximum continuous-work target also make recovery desirable. Short next tasks may defer recovery by up to 15 minutes. Planned breaks and idle gaps of at least five minutes reset both counters. Upcoming planned breaks within 15 minutes can replace automatic recovery. Fixed commitments and user decisions take precedence over the soft maximum.

Long flexible work uses the shared schedule slicing primitive. Deep Focus avoids splitting until its maximum. Ordered placement is shared with manual reordering. No task estimate is compressed in planning. If capacity is tight, optional recovery is shortened to five minutes, then omitted; explicitly adjusted durations are protected. Unused recovery splits are joined back together. An invalid result cannot be accepted or exported.

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

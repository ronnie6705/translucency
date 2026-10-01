# Energy curves and execution history

Rhythm's scheduler and graph both consume `energy-curve.ts`. The four original presets retain their numeric bands. `generateSchedule(tasks, config, curve?)` validates custom curves and preserves the existing two-argument behavior, five-minute search and tolerance progression. Curves describe user capacity; `task-energy.ts` describes task requirements. Missing schedule energy renders neutrally, and breaks never inherit task energy colors.

`TimeblockRun` is an immutable launch snapshot plus append-only observed events. Each launch has a unique run ID, independent of a saved Timeblock ID. Reopening the currently running timer continues its run. Legacy timers remain usable without invented history. Run commands are created before persistence callbacks; event IDs are derived from command IDs and event types, and sequence numbers are assigned within the library mutation. Schedule events store changed blocks, removed IDs, order and changed end times, not the task library.

Completion, skipping, insertion, reordering and time-window updates persist history and the mutable timer in the same library update. The initial plan is never regenerated or rewritten. A replacement launch closes the previous recorded session. Outcomes can close a session when no eligible work remains; merely reaching a scheduled time does not manufacture a task-start, completion or duration observation.

The shared time-window editor locks the running session's start and timezone. The end-time mutation validates the timer, keeps historical blocks and fixed breaks, and reuses duration-weighted remaining-work allocation. It requires at least one minute per remaining task and rejects an end that would truncate a break. The active task retains its identity and elapsed prefix. The existing editor supports same-day ranges.

Guest IndexedDB and account sync persist the complete library. JSON export includes the active timer and runs. Import validates history, preserves launch snapshots and merges distinct event identities. Deleting a saved Timeblock deletes its related runs; resetting Rhythm removes all runs. No learning or analytics is implemented.

Workload reuses `PlanTaskSettings`: one drawer at a time, fixed-time toggle and draft-only removal. Figma nodes inspected: `2007:8184`, `1711:7218`, `2007:8558`, `1779:1278`. The settings prototype specifies Smart Animate, Gentle, 1.022 seconds. The implementation uses an 800 ms duration per the updated request, with the existing Gentle easing approximation and exact exported icon assets; the fixed-time reveal uses 210 ms where no prototype transition was exposed.

Verification:

- `npm test`: domain, scheduler, import/merge, run-history and remaining-window tests.
- `npm run typecheck` and `npm run build`.
- `node tests/timeblock-three-step-browser.mjs`: synthetic account only; planning, five energy colors, fixed-time constraints, keyboard controls, mobile layouts, ICS, launch snapshots, end-time editing, active DOM-node retention and reload persistence.
- 96 mixed-task schedules match a hash generated from the pre-refactor scheduler across all four presets.

## Additional Schedule and preview scope

Schedule cards are draggable across their full surface without opening edit mode. Existing up/down buttons remain available. Pointer reordering retains keyed DOM nodes, uses layout animation, and calls `reorderSchedule` to re-time accepted segments without invoking the Chronotype scheduler. IDs, per-segment durations, breaks, energy and task fixed-time metadata are preserved. Fixed blocks cannot be dragged; orders that would overlap them or overflow the window are rejected through the existing plan validation plus block-placement checks. Escape and pointer cancellation restore the accepted plan.

Figma component `2025:10004` was inspected directly: Smart Animate/Gentle, 1022.0937728881836 ms in both directions, 1.018125 scale, 30% to 40% fill, 50% to 100% stroke, 22 px radius and 0/4/59 px shadow before scaling. The handle expands from zero to 18 px before scaling. `schedule-motion.ts` samples the physical Gentle spring rather than using the earlier Bezier approximation. The exact handle SVG is local at `public/rhythm/flow/schedule-drag.svg`. The separate settings drawer remains 800 ms.

The shared card stylesheet has one 50% border-opacity multiplier for all normal task card consumers. Hover/focus/active treatments retain stronger borders. Saved preview adapters use each Timeblock's `schedule` (legacy fallback: its own tasks/config). They pass a frozen pre-start clock to the existing renderer, preserving historical timestamps without shifting the stored blocks. Active IDs, rather than matching names, select LIVE/resume behavior.

Validation: 104 unit tests; synthetic-account Chrome checks for full-card pointer dragging, retained DOM, fixed card controls, legacy keyboard reordering, calendar/Live Timer handoff, and independent saved previews through resume, completion and launch, including duplicate Timeblock names. No real account data is used by these tests.

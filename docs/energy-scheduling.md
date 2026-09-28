# Energy-aware scheduling

The existing chronotype SVGs remain unchanged illustrations. `energy-profiles.ts`
is the shared numerical definition for the planner and placement explanations.
Its bands retain the existing 1–5 levels and local-clock boundaries.

## Planning rules

`planSchedule` returns both scheduled blocks and actionable issues. It reserves
fixed commitments and user-pinned starts before placing flexible work. Pins are
saved on schedule blocks, not on reusable catalog tasks. A duration change keeps
the pinned start and checks the new end. A date/timezone change keeps the actual
pinned instant; if it no longer fits, the user must unpin it or adjust the window.
Conflicts block acceptance rather than silently moving commitments.

The scheduler compares several greedy arrangements (priority/energy, longest
first, priority/duration, each with energy-fit and chronological packing), then
makes two bounded improvement passes. Each pass tries single-task moves and up
to 96 pairs, including unplaced work first. It is deterministic but does not
guarantee a global optimum or exhaustive feasibility proof.

Schedule comparison is lexicographic:

1. Minimize missing priority-1 tasks, then missing priority-2 and priority-3 tasks.
   Any fully covered schedule therefore beats an incomplete one.
2. Minimize whole-duration energy mismatch. Per minute, the cost is
   `12 * shortfall² + surplus²`, weighted by `4 - task.priority`.
3. Small penalties favor stability and fewer internal gaps. Movement contributes
   at most 3 cost units per task; an internal gap contributes 0.1. These are much
   weaker than a sustained energy mismatch.
4. Break ties by earlier finish and chronological starts.

Energy costs integrate one-minute bands, including fractional final minutes.
Candidate starts use five-minute increments from free-window boundaries, plus
window ends and prior placements. Tasks retain their full durations and are not
split. Explicit breaks reserve time but do not raise modeled energy.

Placement notes state the profile's actual energy range across the task and any
minutes below its requested level. They do not claim a globally optimal choice.

## Editing and persistence

Manual moves repack only the span crossed by the move, keep surrounding blocks
unchanged, and pin the moved task. A move that displaces another pin or fixed
commitment is rejected visibly. Unpinning releases the task for automatic
planning. Regeneration and profile changes retain all pins.

`SavedTimeblock.schedule` is the accepted arrangement used by saved cards, timer
opening, reopening the planning flow, and the creation flow's calendar export.
Past schedules are displayed at their original instants, without silently being
shifted to now. The date can be changed explicitly in the planning-window editor.

Legacy records without a schedule resolve their original sequential task order
once during library loading/validation. Their fixed commitments acquire `fixed`
metadata; existing accepted placements are preserved. Deleting a task removes
only its blocks. Descriptive task edits retain placement; duration/fixed-time
edits use the same planner and reject unresolved conflicts atomically.

The active Live Timer can still evolve as work is completed. Completion reflow
now retains pinned and fixed work as well as breaks. Insertions/reorders that
would displace an anchor are rejected. Execution history remains distinct from
the originally accepted plan.

## Verification

`tests/energy-scheduling.test.ts` covers energy boundaries, whole-duration fit,
priority and coverage, packing repair, pins, local manual moves, migration and
execution safeguards. `tests/timeblock-three-step-browser.mjs` verifies desktop
and mobile flows, profile changes, pins, date conflicts, exact saved/exported
instants, non-running card rendering and reopening. Browser fixtures intercept
Supabase with synthetic records and never write real accounts.

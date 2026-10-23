import { sliceScheduleBlock } from './schedule-placement';
import { energyAtDate, getChronotypeCurve, validateEnergyCurve, type EnergyCurve, type EnergyLevel } from './energy-curve';
// src/rhythmScheduler.ts
import type { DayConfig, Task, ScheduleBlock } from './types';
import { validateTimeblockPlan } from './timeblock-plan';
import {
  createDateInTimeZone,
} from './utils/timezone';

type TimeWindow = { start: Date; end: Date };

const SLOT_RESOLUTION_MINUTES = 5;
const ENERGY_TOLERANCE_STEPS = [0, 1, 2, 3, 4];

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60_000;
}

function hasEnergyCoverage(
  start: Date,
  durationMinutes: number,
  requirement: EnergyLevel,
  tolerance: number,
  curve: EnergyCurve,
  timeZone: string
): boolean {
  let evaluated = 0;
  let cursor = new Date(start);

  while (evaluated < durationMinutes) {
    const available = energyAtDate(curve, cursor, timeZone);
    if (available + tolerance < requirement) {
      return false;
    }
    const step = Math.min(
      SLOT_RESOLUTION_MINUTES,
      durationMinutes - evaluated
    );
    cursor = addMinutes(cursor, step);
    evaluated += step;
  }

  return true;
}

function findStartInWindow(
  window: TimeWindow,
  task: Task,
  curve: EnergyCurve,
  timeZone: string,
  tolerance: number
): Date | null {
  const totalMinutes = minutesBetween(window.start, window.end);
  if (totalMinutes + 1e-6 < task.durationMinutes) {
    return null;
  }

  const latestStartMs =
    window.end.getTime() - task.durationMinutes * 60_000;
  let candidate = new Date(window.start);
  const latestStart = new Date(latestStartMs);

  while (candidate.getTime() <= latestStart.getTime()) {
    if (
      hasEnergyCoverage(
        candidate,
        task.durationMinutes,
        task.energyRequired,
        tolerance,
        curve,
        timeZone
      )
    ) {
      return candidate;
    }
    candidate = addMinutes(candidate, SLOT_RESOLUTION_MINUTES);
  }

  if (
    hasEnergyCoverage(
      latestStart,
      task.durationMinutes,
      task.energyRequired,
      tolerance,
      curve,
      timeZone
    )
  ) {
    return latestStart;
  }

  return null;
}

function carveWindow(
  windows: TimeWindow[],
  index: number,
  blockStart: Date,
  blockEnd: Date
) {
  const window = windows[index];
  const blockStartMs = blockStart.getTime();
  const blockEndMs = blockEnd.getTime();
  const windowStartMs = window.start.getTime();
  const windowEndMs = window.end.getTime();

  if (blockStartMs <= windowStartMs && blockEndMs >= windowEndMs) {
    windows.splice(index, 1);
    return;
  }

  if (blockStartMs <= windowStartMs) {
    window.start = new Date(blockEndMs);
    if (window.start.getTime() >= window.end.getTime()) {
      windows.splice(index, 1);
    }
    return;
  }

  if (blockEndMs >= windowEndMs) {
    window.end = new Date(blockStartMs);
    if (window.end.getTime() <= window.start.getTime()) {
      windows.splice(index, 1);
    }
    return;
  }

  const after: TimeWindow = {
    start: new Date(blockEndMs),
    end: new Date(windowEndMs),
  };
  window.end = new Date(blockStartMs);
  windows.splice(index + 1, 0, after);
}

function scheduleTaskInWindows(
  task: Task,
  windows: TimeWindow[],
  curve: EnergyCurve,
  timeZone: string
): { start: Date; end: Date } | null {
  for (const tolerance of ENERGY_TOLERANCE_STEPS) {
    for (let i = 0; i < windows.length; i++) {
      const startMatch = findStartInWindow(
        windows[i],
        task,
        curve,
        timeZone,
        tolerance
      );
      if (!startMatch) continue;
      const endMatch = addMinutes(startMatch, task.durationMinutes);
      carveWindow(windows, i, startMatch, endMatch);
      return { start: startMatch, end: endMatch };
    }
  }
  return null;
}

export function generateSchedule(
  tasks: Task[],
  config: DayConfig,
  energyCurve?: EnergyCurve
): ScheduleBlock[] {
  const { date, startTime, endTime, chronotype, timezone } = config;
  const curve = energyCurve === undefined ? getChronotypeCurve(chronotype) : validateEnergyCurve(energyCurve);
  const dayStart = createDateInTimeZone(date, startTime, timezone);
  const dayEnd = createDateInTimeZone(date, endTime, timezone);

  if (dayEnd <= dayStart || !validateTimeblockPlan(tasks, startTime, endTime).valid) return [];

  // Separate fixed-time and flexible tasks
  const fixedTasks = tasks.filter(t => t.fixedStart);
  const flexibleTasks = tasks.filter(t => !t.fixedStart);

  // Prepare schedule array
  const schedule: ScheduleBlock[] = [];

  // 1. Place fixed-time tasks in chronological order
  const fixedSorted = [...fixedTasks].sort((a, b) => {
    return (a.fixedStart || '').localeCompare(b.fixedStart || '');
  });

  for (const t of fixedSorted) {
    const fixedStart = createDateInTimeZone(date, t.fixedStart!, timezone);
    const fixedEnd = addMinutes(fixedStart, t.durationMinutes);

    // If there's gap before this fixed task, we will fill it later with flex tasks
    // For now, just block off fixed tasks in the schedule

    if (fixedStart >= dayStart && fixedEnd <= dayEnd) {
      schedule.push({
        id: `fixed-${t.id}`,
        isFixed: true,
        taskId: t.id,
        taskName: t.name,
        start: fixedStart.toISOString(),
        end: fixedEnd.toISOString(),
        isBreak: !!t.isBreak,
        energyRequired: t.energyRequired,
      });
    }
  }

  // Sort schedule by start time
  schedule.sort((a, b) => a.start.localeCompare(b.start));

  // 2. Build a list of free time segments between dayStart and dayEnd
  type Segment = { start: Date; end: Date };
  const freeSegments: Segment[] = [];

  let segCursor = new Date(dayStart);

  for (const block of schedule) {
    const blockStart = new Date(block.start);
    if (blockStart > segCursor) {
      freeSegments.push({ start: new Date(segCursor), end: new Date(blockStart) });
    }
    segCursor = new Date(block.end);
  }

  if (segCursor < dayEnd) {
    freeSegments.push({ start: new Date(segCursor), end: new Date(dayEnd) });
  }

  // 3. Sort flexible tasks by priority, energy (higher first)
  const flexSorted = [...flexibleTasks].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority; // 1 first
    return b.energyRequired - a.energyRequired;
  });

  const resultBlocks: ScheduleBlock[] = [...schedule];

  const freeWindows: TimeWindow[] = freeSegments
    .filter(seg => seg.end.getTime() > seg.start.getTime())
    .map(seg => ({ start: new Date(seg.start), end: new Date(seg.end) }));

  for (const task of flexSorted) {
    if (task.durationMinutes <= 0) continue;
    const placement = scheduleTaskInWindows(
      task,
      freeWindows,
      curve,
      timezone
    );
    if (!placement) continue;

    resultBlocks.push({
      id: `flex-${task.id}`,
      taskId: task.id,
      taskName: task.name,
      start: placement.start.toISOString(),
      end: placement.end.toISOString(),
      isBreak: !!task.isBreak,
      energyRequired: task.energyRequired,
    });
  }

  if (resultBlocks.length < tasks.length) {
    const recovered = recoverSchedule(flexSorted, freeSegments, curve, timezone);
    if (recovered) return [...schedule, ...recovered].sort((a, b) => a.start.localeCompare(b.start));
  }

  // Final sort
  resultBlocks.sort((a, b) => a.start.localeCompare(b.start));
  return resultBlocks;
}


/** Bounded bin-packing search avoids splits when a different arrangement fits. */
function recoverSchedule(tasks: Task[], segments: TimeWindow[], curve: EnergyCurve, timezone: string): ScheduleBlock[] | null {
  const available = segments.reduce((sum, w) => sum + minutesBetween(w.start, w.end), 0);
  if (tasks.reduce((sum, t) => sum + t.durationMinutes, 0) > available + 1e-6) return null;
  const ordered = [...tasks].sort((a, b) => b.durationMinutes - a.durationMinutes || a.priority - b.priority);
  const copy = () => segments.map(w => ({ start: new Date(w.start), end: new Date(w.end) }));
  const make = (task: Task, start: Date, minutes: number, part = 0): ScheduleBlock => ({
    id: `flex-${task.id}${part ? `-part-${part}` : ''}`, taskId: task.id, taskName: task.name,
    start: start.toISOString(), end: addMinutes(start, minutes).toISOString(), isBreak: !!task.isBreak, energyRequired: task.energyRequired,
  });
  let attempts = 0;
  const windows = copy();
  const placed: ScheduleBlock[] = [];
  const search = (index: number): boolean => {
    if (index === ordered.length) return true;
    if (++attempts > 2000 || index > 100) return false;
    const task = ordered[index];
    const candidates = windows.map((w, i) => ({ i, spare: minutesBetween(w.start, w.end) - task.durationMinutes,
      mismatch: Math.max(0, task.energyRequired - energyAtDate(curve, w.start, timezone)) }))
      .filter(c => c.spare >= -1e-6).sort((a, b) => a.mismatch - b.mismatch || a.spare - b.spare || a.i - b.i);
    for (const { i } of candidates) {
      const start = windows[i].start;
      placed.push(make(task, start, task.durationMinutes));
      windows[i].start = addMinutes(start, task.durationMinutes);
      if (search(index + 1)) return true;
      windows[i].start = start;
      placed.pop();
    }
    return false;
  };
  if (search(0)) return placed;

  // Full estimates are preserved. Prefer a whole energy-compatible placement,
  // then consume the largest available windows to avoid unnecessary tiny parts.
  const free = copy();
  const split: ScheduleBlock[] = [];
  for (const task of tasks) {
    const whole = scheduleTaskInWindows(task, free, curve, timezone);
    if (whole) { split.push(make(task, whole.start, task.durationMinutes)); continue; }
    let remaining = task.durationMinutes, part = 0;
    const largest = [...free].sort((a, b) => minutesBetween(b.start, b.end) - minutesBetween(a.start, a.end));
    const selected: TimeWindow[] = [];
    let capacity = 0;
    for (const w of largest) { selected.push(w); capacity += minutesBetween(w.start, w.end); if (capacity >= remaining) break; }
    selected.sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const w of selected) {
      const minutes = Math.min(remaining, minutesBetween(w.start, w.end));
      if (minutes <= 0) continue;
      split.push(sliceScheduleBlock(make(task, w.start, task.durationMinutes, part++), 0, minutes));
      w.start = addMinutes(w.start, minutes);
      remaining -= minutes;
    }
    if (remaining > 1e-6) return null;
  }
  return split;
}

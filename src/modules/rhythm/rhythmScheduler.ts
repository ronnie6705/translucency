import { energyAtDate, getChronotypeCurve, validateEnergyCurve, type EnergyCurve, type EnergyLevel } from './energy-curve';
// src/rhythmScheduler.ts
import type { DayConfig, Task, ScheduleBlock } from './types';
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

  if (dayEnd <= dayStart) return [];

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

  // Final sort
  resultBlocks.sort((a, b) => a.start.localeCompare(b.start));
  return resultBlocks;
}

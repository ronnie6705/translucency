// src/rhythmScheduler.ts
import type { DayConfig, Task, ScheduleBlock, Chronotype } from './types';
import {
  createDateInTimeZone,
  getMinutesOfDayInTimeZone,
} from './utils/timezone';

type EnergyLevel = Task['energyRequired'];

type EnergyBand = {
  startMinutes: number;
  endMinutes: number;
  level: EnergyLevel;
};

type TimeWindow = { start: Date; end: Date };

const SLOT_RESOLUTION_MINUTES = 5;
const ENERGY_TOLERANCE_STEPS = [0, 1, 2, 3, 4];

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

const toMinutes = (hour: number, minute = 0) => hour * 60 + minute;

const LION_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(3), level: 1 }, // deep sleep
  { startMinutes: toMinutes(3), endMinutes: toMinutes(5), level: 1 }, // pre-dawn low
  { startMinutes: toMinutes(5), endMinutes: toMinutes(6, 30), level: 2 }, // wake-up ramp
  { startMinutes: toMinutes(6, 30), endMinutes: toMinutes(8), level: 3 }, // planning & routines
  { startMinutes: toMinutes(8), endMinutes: toMinutes(10, 30), level: 5 }, // peak focus / interviews
  { startMinutes: toMinutes(10, 30), endMinutes: toMinutes(12), level: 4 }, // problem-solving
  { startMinutes: toMinutes(12), endMinutes: toMinutes(14), level: 3 }, // late-morning taper
  { startMinutes: toMinutes(14), endMinutes: toMinutes(15), level: 2 }, // nap window
  { startMinutes: toMinutes(15), endMinutes: toMinutes(16, 30), level: 3 }, // strength work rebound
  { startMinutes: toMinutes(16, 30), endMinutes: toMinutes(18, 30), level: 2 }, // afternoon decline
  { startMinutes: toMinutes(18, 30), endMinutes: toMinutes(21), level: 2 }, // run / dinner glide
  { startMinutes: toMinutes(21), endMinutes: toMinutes(24), level: 1 }, // wind-down & sleep
];

const BEAR_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(5), level: 1 },
  { startMinutes: toMinutes(5), endMinutes: toMinutes(7), level: 2 },
  { startMinutes: toMinutes(7), endMinutes: toMinutes(9), level: 3 },
  { startMinutes: toMinutes(9), endMinutes: toMinutes(12), level: 5 },
  { startMinutes: toMinutes(12), endMinutes: toMinutes(13), level: 3 },
  { startMinutes: toMinutes(13), endMinutes: toMinutes(15), level: 2 },
  { startMinutes: toMinutes(15), endMinutes: toMinutes(18), level: 4 },
  { startMinutes: toMinutes(18), endMinutes: toMinutes(20), level: 3 },
  { startMinutes: toMinutes(20), endMinutes: toMinutes(22), level: 2 },
  { startMinutes: toMinutes(22), endMinutes: toMinutes(24), level: 1 },
];

const WOLF_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(3), level: 3 },
  { startMinutes: toMinutes(3), endMinutes: toMinutes(6), level: 2 },
  { startMinutes: toMinutes(6), endMinutes: toMinutes(10), level: 1 },
  { startMinutes: toMinutes(10), endMinutes: toMinutes(13), level: 2 },
  { startMinutes: toMinutes(13), endMinutes: toMinutes(16), level: 3 },
  { startMinutes: toMinutes(16), endMinutes: toMinutes(19), level: 5 },
  { startMinutes: toMinutes(19), endMinutes: toMinutes(21), level: 4 },
  { startMinutes: toMinutes(21), endMinutes: toMinutes(23), level: 3 },
  { startMinutes: toMinutes(23), endMinutes: toMinutes(24), level: 2 },
];

const DOLPHIN_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(6), level: 1 },
  { startMinutes: toMinutes(6), endMinutes: toMinutes(8), level: 2 },
  { startMinutes: toMinutes(8), endMinutes: toMinutes(10), level: 3 },
  { startMinutes: toMinutes(10), endMinutes: toMinutes(13), level: 5 },
  { startMinutes: toMinutes(13), endMinutes: toMinutes(15), level: 3 },
  { startMinutes: toMinutes(15), endMinutes: toMinutes(17), level: 2 },
  { startMinutes: toMinutes(17), endMinutes: toMinutes(19), level: 4 },
  { startMinutes: toMinutes(19), endMinutes: toMinutes(21), level: 3 },
  { startMinutes: toMinutes(21), endMinutes: toMinutes(24), level: 1 },
];

const DEFAULT_CURVE: EnergyBand[] = [
  { startMinutes: toMinutes(0), endMinutes: toMinutes(6), level: 1 },
  { startMinutes: toMinutes(6), endMinutes: toMinutes(9), level: 3 },
  { startMinutes: toMinutes(9), endMinutes: toMinutes(12), level: 4 },
  { startMinutes: toMinutes(12), endMinutes: toMinutes(15), level: 3 },
  { startMinutes: toMinutes(15), endMinutes: toMinutes(18), level: 2 },
  { startMinutes: toMinutes(18), endMinutes: toMinutes(21), level: 2 },
  { startMinutes: toMinutes(21), endMinutes: toMinutes(24), level: 1 },
];

const ENERGY_CURVES: Record<Chronotype, EnergyBand[]> = {
  Lion: LION_CURVE,
  Bear: BEAR_CURVE,
  Wolf: WOLF_CURVE,
  Dolphin: DOLPHIN_CURVE,
};

function minutesBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60_000;
}

function isMinuteWithinBand(value: number, band: EnergyBand): boolean {
  if (band.startMinutes <= band.endMinutes) {
    return value >= band.startMinutes && value < band.endMinutes;
  }
  // Wrap-around band
  return value >= band.startMinutes || value < band.endMinutes;
}

function getEnergyCurve(chronotype: Chronotype): EnergyBand[] {
  return ENERGY_CURVES[chronotype] ?? DEFAULT_CURVE;
}

function getEnergyLevelAt(
  chronotype: Chronotype,
  date: Date,
  timeZone: string
): EnergyLevel {
  const minutesOfDay = getMinutesOfDayInTimeZone(date, timeZone);
  const curve = getEnergyCurve(chronotype);
  for (const band of curve) {
    if (isMinuteWithinBand(minutesOfDay, band)) {
      return band.level;
    }
  }
  return 3;
}

function hasEnergyCoverage(
  start: Date,
  durationMinutes: number,
  requirement: EnergyLevel,
  tolerance: number,
  chronotype: Chronotype,
  timeZone: string
): boolean {
  let evaluated = 0;
  let cursor = new Date(start);

  while (evaluated < durationMinutes) {
    const available = getEnergyLevelAt(chronotype, cursor, timeZone);
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
  chronotype: Chronotype,
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
        chronotype,
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
      chronotype,
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
  chronotype: Chronotype,
  timeZone: string
): { start: Date; end: Date } | null {
  for (const tolerance of ENERGY_TOLERANCE_STEPS) {
    for (let i = 0; i < windows.length; i++) {
      const startMatch = findStartInWindow(
        windows[i],
        task,
        chronotype,
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
  config: DayConfig
): ScheduleBlock[] {
  const { date, startTime, endTime, chronotype, timezone } = config;
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

    if (fixedEnd <= dayEnd) {
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
      chronotype,
      timezone
    );
    if (!placement) continue;

    resultBlocks.push({
      id: `flex-${task.id}-${placement.start.toISOString()}`,
      taskId: task.id,
      taskName: task.name,
      start: placement.start.toISOString(),
      end: placement.end.toISOString(),
      isBreak: !!task.isBreak,
      energyRequired: task.energyRequired,
    });

    task.durationMinutes = 0;
  }

  // Final sort
  resultBlocks.sort((a, b) => a.start.localeCompare(b.start));
  return resultBlocks;
}

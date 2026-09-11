import type { DayConfig, ScheduleBlock, Task } from '../types';
import { createDateInTimeZone } from './timezone';

export interface PlannedTaskSegment {
  task: Task;
  durationMinutes: number;
  offsetMinutes: number;
  clipped: boolean;
  partIndex?: number;
  totalParts?: number;
}

type MinutesWindow = { start: number; end: number };

function parseTimeToMinutes(value?: string): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function carveWindowForPlacement(
  windows: MinutesWindow[],
  index: number,
  start: number,
  duration: number
) {
  const window = windows[index];
  const before: MinutesWindow | null =
    start > window.start ? { start: window.start, end: start } : null;
  const afterEnd = start + duration;
  const after: MinutesWindow | null =
    afterEnd < window.end ? { start: afterEnd, end: window.end } : null;

  const next: MinutesWindow[] = [];
  if (before && before.end > before.start) next.push(before);
  if (after && after.end > after.start) next.push(after);

  windows.splice(index, 1, ...next);
}

function takeNextWindowSlot(
  windows: MinutesWindow[],
  duration: number
): { start: number; used: number; windowIndex: number } | null {
  for (let i = 0; i < windows.length; i++) {
    const win = windows[i];
    const available = win.end - win.start;
    if (available <= 0) continue;
    const used = Math.min(duration, available);
    const slotStart = win.start;
    win.start += used;
    if (win.start >= win.end) {
      windows.splice(i, 1);
    }
    return { start: slotStart, used, windowIndex: i };
  }
  return null;
}

function placeFixedTask(
  windows: MinutesWindow[],
  start: number,
  duration: number
): { start: number; used: number } | null {
  for (let i = 0; i < windows.length; i++) {
    const win = windows[i];
    if (start < win.start || start >= win.end) continue;
    const available = win.end - start;
    if (available <= 0) continue;
    const used = Math.min(duration, available);
    carveWindowForPlacement(windows, i, start, used);
    return { start, used };
  }
  return null;
}

export function planSequentialTasks(
  tasks: Task[],
  totalMinutes: number,
  options?: { absoluteRangeStart?: number; absoluteRangeEnd?: number }
): PlannedTaskSegment[] {
  if (totalMinutes <= 0) return [];

  const rangeStart =
    options?.absoluteRangeStart ?? 0;
  const rangeEnd =
    options?.absoluteRangeEnd ?? rangeStart + totalMinutes;
  if (rangeEnd <= rangeStart) return [];

  const windows: MinutesWindow[] = [{ start: rangeStart, end: rangeEnd }];
  const segments: PlannedTaskSegment[] = [];

  const fixedTasks = tasks.filter(task => !!task.fixedStart);
  const flexibleTasks = tasks.filter(task => !task.fixedStart);

  const fixedSorted = [...fixedTasks].sort((a, b) =>
    (a.fixedStart || '').localeCompare(b.fixedStart || '')
  );

  for (const task of fixedSorted) {
    const targetStart = parseTimeToMinutes(task.fixedStart);
    if (targetStart === null) {
      flexibleTasks.push(task);
      continue;
    }
    if (targetStart + task.durationMinutes <= rangeStart || targetStart >= rangeEnd) {
      flexibleTasks.push(task);
      continue;
    }
    const placement = placeFixedTask(windows, targetStart, task.durationMinutes);
    if (!placement) {
      flexibleTasks.push(task);
      continue;
    }
    segments.push({
      task,
      durationMinutes: placement.used,
      offsetMinutes: placement.start - rangeStart,
      clipped: placement.used < task.durationMinutes,
    });
  }

  // The caller supplies either the generated order or the user's edited order.
  for (const task of flexibleTasks) {
    if (task.durationMinutes <= 0) continue;
    let remaining = task.durationMinutes;
    let lastSegmentIndex: number | null = null;

    while (remaining > 0) {
      const placement = takeNextWindowSlot(windows, remaining);
      if (!placement) break;
      segments.push({
        task,
        durationMinutes: placement.used,
        offsetMinutes: placement.start - rangeStart,
        clipped: false,
      });
      lastSegmentIndex = segments.length - 1;
      remaining -= placement.used;
    }

    if (remaining > 0 && lastSegmentIndex !== null) {
      segments[lastSegmentIndex].clipped = true;
    }
  }

  segments.sort((a, b) => a.offsetMinutes - b.offsetMinutes);

  const totalParts = new Map<string, number>();
  segments.forEach(segment => {
    totalParts.set(segment.task.id, (totalParts.get(segment.task.id) ?? 0) + 1);
  });

  const seenParts = new Map<string, number>();
  segments.forEach(segment => {
    const total = totalParts.get(segment.task.id) ?? 1;
    if (total <= 1) return;
    const next = (seenParts.get(segment.task.id) ?? 0) + 1;
    seenParts.set(segment.task.id, next);
    segment.partIndex = next;
    segment.totalParts = total;
  });

  return segments;
}

export function buildManualSchedule(
  tasks: Task[],
  config: DayConfig
): ScheduleBlock[] {
  const { date, startTime, endTime, timezone } = config;
  const start = createDateInTimeZone(date, startTime, timezone);
  const end = createDateInTimeZone(date, endTime, timezone);
  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / 60000);
  if (!(end.getTime() > start.getTime()) || totalMinutes <= 0) {
    return [];
  }

  // The planner uses wall-clock minutes in the selected zone, not the device zone.
  const startMinutes = parseTimeToMinutes(startTime)!;
  const endMinutes = parseTimeToMinutes(endTime)!;

  const segments = planSequentialTasks(tasks, totalMinutes, {
    absoluteRangeStart: startMinutes,
    absoluteRangeEnd: endMinutes,
  });
  return segments.map((segment, index) => {
    const blockStart = new Date(start.getTime() + segment.offsetMinutes * 60000);
    const blockEnd = new Date(blockStart.getTime() + segment.durationMinutes * 60000);
    return {
      id: `manual-${segment.task.id}-${index}`,
      taskId: segment.task.id,
      taskName: segment.task.name,
      start: blockStart.toISOString(),
      end: blockEnd.toISOString(),
      isBreak: !!segment.task.isBreak,
      energyRequired: segment.task.energyRequired,
    };
  });
}

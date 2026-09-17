import type { ScheduleBlock } from './types';

export type TimerTaskOutcome = 'completed' | 'skipped';

export interface LiveTimer {
  id: string;
  name: string;
  timezone: string;
  blocks: ScheduleBlock[];
  startedAt?: string;
  endsAt?: string;
  completedTaskIds?: string[];
  skippedTaskIds?: string[];
}

/** Rebudget unfinished work inside the original timebox, preserving break instants. */
export function completeTimerTask(timer: LiveTimer, taskId: string, now: number, outcome: TimerTaskOutcome = 'completed'): LiveTimer {
  if (timer.completedTaskIds?.includes(taskId) || timer.skippedTaskIds?.includes(taskId) || !timer.blocks.some(b => b.taskId === taskId && !b.isBreak)) return timer;
  const startedAt = timer.startedAt ?? timer.blocks[0].start;
  const endsAt = timer.endsAt ?? timer.blocks[timer.blocks.length - 1].end;
  const resolution = outcome === 'completed'
    ? { completedTaskIds: [...(timer.completedTaskIds ?? []), taskId] }
    : { skippedTaskIds: [...(timer.skippedTaskIds ?? []), taskId] };
  const remaining = timer.blocks.filter(b => b.taskId !== taskId || b.isBreak);
  const start = Math.max(now, Date.parse(startedAt));
  const end = Date.parse(endsAt);
  const result = { ...timer, startedAt, endsAt, ...resolution };
  if (start >= end) return { ...result, blocks: remaining };

  const breaks = remaining.filter(b => b.isBreak);
  const windows: { start: number; end: number }[] = [];
  let cursor = start;
  for (const rest of breaks) {
    if (Date.parse(rest.end) <= cursor) continue;
    if (Date.parse(rest.start) > cursor) windows.push({ start: cursor, end: Date.parse(rest.start) });
    cursor = Math.max(cursor, Date.parse(rest.end));
  }
  if (cursor < end) windows.push({ start: cursor, end });
  const available = windows.reduce((sum, w) => sum + w.end - w.start, 0);
  const work = new Map<string, { segments: ScheduleBlock[]; weight: number }>();
  for (const block of remaining.filter(b => !b.isBreak && Date.parse(b.end) > now)) {
    const item = work.get(block.taskId) ?? { segments: [], weight: 0 };
    item.segments.push(block);
    // Only future time is redistributed. Elapsed blocks remain historical.
    item.weight += Date.parse(block.end) - Math.max(now, Date.parse(block.start));
    work.set(block.taskId, item);
  }
  if (!work.size || available < work.size) return { ...result, blocks: remaining };
  const totalWeight = [...work.values()].reduce((sum, item) => sum + item.weight, 0);
  const blocks: ScheduleBlock[] = [...breaks, ...remaining.filter(b => !b.isBreak && Date.parse(b.end) <= now)];
  let allocated = 0, cumulativeWeight = 0, windowIndex = 0, taskIndex = 0;
  cursor = windows[0].start;
  for (const item of work.values()) {
    cumulativeWeight += item.weight;
    // Keep even a very small unfinished task visible near the deadline.
    const target = Math.round((available - work.size) * cumulativeWeight / totalWeight) + ++taskIndex;
    let budget = target - allocated;
    allocated = target;
    let part = 0;
    while (budget > 0 && windowIndex < windows.length) {
      const duration = Math.min(budget, windows[windowIndex].end - cursor);
      const source = item.segments[part] ?? item.segments[0];
      // Keep the elapsed prefix of the running task; extending its end must
      // never turn its actual start into the time of the completion click.
      const blockStart = part === 0 && Date.parse(source.start) < now && cursor === start ? Date.parse(source.start) : cursor;
      blocks.push({ ...source, id: item.segments[part]?.id ?? `${item.segments[0].id}-part-${part}`, start: new Date(blockStart).toISOString(), end: new Date(cursor + duration).toISOString() });
      part++;
      budget -= duration;
      cursor += duration;
      if (cursor >= windows[windowIndex].end) {
        windowIndex++;
        cursor = windows[windowIndex]?.start ?? end;
      }
    }
  }
  blocks.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return { ...result, blocks };
}

export function timerPosition(blocks: ScheduleBlock[], now: number) {
  const activeIndex = blocks.findIndex(block => Date.parse(block.start) <= now && now < Date.parse(block.end));
  const nextIndex = blocks.findIndex(block => Date.parse(block.start) > now);
  const phase = activeIndex >= 0 ? 'running' : nextIndex === 0 ? 'scheduled' : nextIndex > 0 ? 'gap' : 'complete';
  const active = blocks[activeIndex];
  const progress = active ? Math.max(0, Math.min(1, (now - Date.parse(active.start)) / (Date.parse(active.end) - Date.parse(active.start)))) : 0;
  return { activeIndex, nextIndex, phase, progress };
}

export const MIN_BLOCK_HEIGHT = 60;

export function timerBlockHeight(block: ScheduleBlock) {
  const minutes = (Date.parse(block.end) - Date.parse(block.start)) / 60000;
  const calculatedHeight = Math.max(82, Math.min(240, 66 + minutes * 0.75));
  return block.isBreak ? 64 : Math.max(MIN_BLOCK_HEIGHT, calculatedHeight);
}

export function validLiveTimer(value: unknown): value is LiveTimer {
  if (!value || typeof value !== 'object') return false;
  const timer = value as LiveTimer;
  if (typeof timer.id !== 'string' || typeof timer.name !== 'string' || typeof timer.timezone !== 'string' || !Array.isArray(timer.blocks)) return false;
  if (timer.completedTaskIds !== undefined && (!Array.isArray(timer.completedTaskIds) || !timer.completedTaskIds.every(id => typeof id === 'string') || new Set(timer.completedTaskIds).size !== timer.completedTaskIds.length)) return false;
  if (timer.skippedTaskIds !== undefined && (!Array.isArray(timer.skippedTaskIds) || !timer.skippedTaskIds.every(id => typeof id === 'string') || new Set(timer.skippedTaskIds).size !== timer.skippedTaskIds.length || timer.skippedTaskIds.some(id => timer.completedTaskIds?.includes(id)))) return false;
  if ((timer.startedAt !== undefined || timer.endsAt !== undefined) && (!Number.isFinite(Date.parse(timer.startedAt!)) || !(Date.parse(timer.endsAt!) > Date.parse(timer.startedAt!)))) return false;
  if (!timer.blocks.length && !((timer.completedTaskIds?.length || timer.skippedTaskIds?.length) && timer.startedAt && timer.endsAt)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: timer.timezone }).format(); } catch { return false; }
  return timer.blocks.every((b, i) => b && typeof b.id === 'string' && typeof b.taskId === 'string' && typeof b.taskName === 'string' && typeof b.isBreak === 'boolean' && Number.isFinite(b.energyRequired) && Number.isFinite(Date.parse(b.start)) && Date.parse(b.end) > Date.parse(b.start) && (i === 0 || Date.parse(b.start) >= Date.parse(timer.blocks[i - 1].end)));
}

export function formatDurationHM(ms: number): string {
  if (ms <= 0) return '0m';
  const mins = Math.round(ms / 60000);
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours > 0 && remainder > 0) return `${hours}h ${remainder}m`;
  if (hours > 0) return `${hours}h`;
  return `${remainder}m`;
}

export { insertItemIntoTimer, reorderTimerBlocks, reorderLiveTimer, type InsertItemParams } from './insert-live-task';

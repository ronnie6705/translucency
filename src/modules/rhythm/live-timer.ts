import { replanTimerRecovery } from './recovery/recovery-timer';
import { setRecoveryOverride } from './recovery/recovery-types';
import { validAnchor, validBreakPreferences, type BreakPreferences } from './recovery/recovery-types';
import type { ScheduleBlock } from './types';

export type TimerTaskOutcome = 'completed' | 'skipped';

export interface LiveTimer {
  breakPreferences?: BreakPreferences;
  resolvedBreakIds?: string[];
  runId?: string;
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
  const rest = timer.blocks.find(b => b.isBreak && (b.id === taskId || b.taskId === taskId));
  if (rest) {
    if (timer.resolvedBreakIds?.includes(rest.id) || Date.parse(rest.start)>now || Date.parse(rest.end)<=now) return timer;
    const breakPreferences = rest.recovery && timer.breakPreferences ? setRecoveryOverride(timer.breakPreferences,rest.recovery.anchor,{removed:true}) : timer.breakPreferences;
    // Preserve any elapsed prefix as history, then release the unused duration.
    const blocks = timer.blocks.flatMap(b => b.id !== rest.id ? [b] : Date.parse(b.start)<now ? [{...b,end:new Date(now).toISOString()}] : []);
    return rebudgetRemainingTimer({...timer,breakPreferences,blocks,resolvedBreakIds:[...(timer.resolvedBreakIds ?? []),rest.id]},now);
  }
  if (timer.completedTaskIds?.includes(taskId) || timer.skippedTaskIds?.includes(taskId) || !timer.blocks.some(b => b.taskId === taskId && !b.isBreak)) return timer;
  const startedAt = timer.startedAt ?? timer.blocks[0].start;
  const endsAt = timer.endsAt ?? timer.blocks[timer.blocks.length - 1].end;
  const resolution = outcome === 'completed'
    ? { completedTaskIds: [...(timer.completedTaskIds ?? []), taskId] }
    : { skippedTaskIds: [...(timer.skippedTaskIds ?? []), taskId] };
  const remaining = timer.blocks.flatMap(b => {
    if (b.taskId !== taskId || b.isBreak) return [b];
    if (timer.breakPreferences && Date.parse(b.start)<now) return [{...b,end:new Date(Math.min(now,Date.parse(b.end))).toISOString()}];
    return [];
  });
  return rebudgetRemainingTimer({ ...timer, startedAt, endsAt, ...resolution, blocks: remaining }, now);
}

/** Duration-weighted remaining allocation shared by outcomes and end-time edits. */
export function rebudgetRemainingTimer(timer: LiveTimer, now: number, minimum = 1): LiveTimer {
  return timer.breakPreferences ? replanTimerRecovery(timer,now,minimum) : rebudgetTimerWork(timer,now,minimum);
}
export function rebudgetTimerWork(timer: LiveTimer, now: number, minimum = 1): LiveTimer {
  const startedAt = timer.startedAt ?? timer.blocks[0]?.start;
  const endsAt = timer.endsAt ?? timer.blocks.at(-1)?.end;
  const remaining = timer.blocks;
  const start = Math.max(now, Date.parse(startedAt!));
  const end = Date.parse(endsAt!);
  const result = { ...timer, startedAt, endsAt };
  if (start >= end) return { ...result, blocks: remaining };

  const breaks = remaining.filter(b => b.isBreak || b.isFixed).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
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
  let item: { segments: ScheduleBlock[]; weight: number } | undefined;
  for (const block of remaining.filter(b => !b.isBreak && !b.isFixed && Date.parse(b.end) > now)) {
    // Only join adjacent pieces of one task. An inserted task between pieces
    // is an accepted ordering constraint and must not be moved behind them.
    if (!item || item.segments[0].taskId !== block.taskId) {
      item = { segments: [], weight: 0 };
      work.set(block.id, item);
    }
    item.segments.push(block);
    // Only future time is redistributed. Elapsed blocks remain historical.
    item.weight += Date.parse(block.end) - Math.max(now, Date.parse(block.start));
  }
  if (!work.size || available < work.size * minimum) return { ...result, blocks: remaining };
  const totalWeight = [...work.values()].reduce((sum, item) => sum + item.weight, 0);
  const blocks: ScheduleBlock[] = [...breaks, ...remaining.filter(b => !b.isBreak && !b.isFixed && Date.parse(b.end) <= now)];
  const reservedIds = new Set(remaining.map(b => b.id));
  const emittedIds = new Set(blocks.map(b => b.id));
  let allocated = 0, cumulativeWeight = 0, windowIndex = 0, taskIndex = 0;
  cursor = windows[0].start;
  for (const item of work.values()) {
    cumulativeWeight += item.weight;
    // Keep even a very small unfinished task visible near the deadline.
    const target = Math.round((available - work.size * minimum) * cumulativeWeight / totalWeight) + ++taskIndex * minimum;
    let budget = target - allocated;
    allocated = target;
    let part = 0, workOffset = item.segments[0].workOffsetMinutes ?? 0;
    while (budget > 0 && windowIndex < windows.length) {
      const duration = Math.min(budget, windows[windowIndex].end - cursor);
      const source = item.segments[part] ?? item.segments[0];
      // Keep the elapsed prefix of the running task; extending its end must
      // never turn its actual start into the time of the completion click.
      const blockStart = part === 0 && Date.parse(source.start) < now && cursor === start ? Date.parse(source.start) : cursor;
      const existingId = item.segments[part]?.id;
      let id = existingId ?? `${item.segments[0].id}-part-${part}`;
      let suffix = 0;
      while (emittedIds.has(id) || id !== existingId && reservedIds.has(id)) id = `${item.segments[0].id}-budget-${part}-${++suffix}`;
      emittedIds.add(id);
      blocks.push({ ...source, ...(source.workOffsetMinutes !== undefined ? {workOffsetMinutes:workOffset} : {}), id, start: new Date(blockStart).toISOString(), end: new Date(cursor + duration).toISOString() });
      workOffset += (cursor + duration - blockStart) / 60000;
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

export function timerBlockHeight(block: ScheduleBlock, variant: 'timer' | 'preview' = 'timer') {
  const minutes = (Date.parse(block.end) - Date.parse(block.start)) / 60000;
  // The roomier planning canvas follows the Figma scale; both views use the same renderer.
  if (variant === 'preview') return block.isBreak ? 92 : Math.max(92, Math.min(240, 40 + minutes * 4 / 3));
  const calculatedHeight = Math.max(82, Math.min(240, 66 + minutes * 0.75));
  return block.isBreak ? 64 : Math.max(MIN_BLOCK_HEIGHT, calculatedHeight);
}

export function validLiveTimer(value: unknown): value is LiveTimer {
  if (!value || typeof value !== 'object') return false;
  const timer = value as LiveTimer;
  if (timer.breakPreferences !== undefined && !validBreakPreferences(timer.breakPreferences)) return false;
  if (timer.resolvedBreakIds !== undefined && (!Array.isArray(timer.resolvedBreakIds) || !timer.resolvedBreakIds.every(id => typeof id === 'string') || new Set(timer.resolvedBreakIds).size !== timer.resolvedBreakIds.length)) return false;
  if (timer.runId !== undefined && typeof timer.runId !== 'string') return false;

  if (typeof timer.id !== 'string' || typeof timer.name !== 'string' || typeof timer.timezone !== 'string' || !Array.isArray(timer.blocks)) return false;
  if (timer.completedTaskIds !== undefined && (!Array.isArray(timer.completedTaskIds) || !timer.completedTaskIds.every(id => typeof id === 'string') || new Set(timer.completedTaskIds).size !== timer.completedTaskIds.length)) return false;
  if (timer.skippedTaskIds !== undefined && (!Array.isArray(timer.skippedTaskIds) || !timer.skippedTaskIds.every(id => typeof id === 'string') || new Set(timer.skippedTaskIds).size !== timer.skippedTaskIds.length || timer.skippedTaskIds.some(id => timer.completedTaskIds?.includes(id)))) return false;
  if ((timer.startedAt !== undefined || timer.endsAt !== undefined) && (!Number.isFinite(Date.parse(timer.startedAt!)) || !(Date.parse(timer.endsAt!) > Date.parse(timer.startedAt!)))) return false;
  if (!timer.blocks.length && !((timer.completedTaskIds?.length || timer.skippedTaskIds?.length || timer.resolvedBreakIds?.length) && timer.startedAt && timer.endsAt)) return false;
  if ((timer.breakPreferences || timer.blocks.some(b => b?.recovery)) && new Set(timer.blocks.map(b => b?.id)).size !== timer.blocks.length) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: timer.timezone }).format(); } catch { return false; }
  return timer.blocks.every((b, i) => b && typeof b.id === 'string' && typeof b.taskId === 'string' && typeof b.taskName === 'string' && typeof b.isBreak === 'boolean' && (b.workOffsetMinutes === undefined || Number.isFinite(b.workOffsetMinutes) && b.workOffsetMinutes >= 0) && (b.recovery === undefined || b.isBreak && !b.isFixed && validAnchor(b.recovery.anchor) && ['automatic','manual-override'].includes(b.recovery.source)) && (b.isFixed === undefined || typeof b.isFixed === 'boolean') && (b.energyRequired === undefined || Number.isFinite(b.energyRequired)) && Number.isFinite(Date.parse(b.start)) && Date.parse(b.end) > Date.parse(b.start) && (i === 0 || Date.parse(b.start) >= Date.parse(timer.blocks[i - 1].end)));
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

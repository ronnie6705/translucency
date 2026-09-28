import type { DayConfig, ScheduleBlock, Task } from './types';
import { energyAtMinute } from './energy-profiles';
import { createDateInTimeZone } from './utils/timezone';

const MINUTE = 60_000;
const RESOLUTION = 5;
type Placement = { task: Task; start: number; end: number; pinned?: boolean; fixed?: boolean };
export type ScheduleIssue = { taskId: string; message: string; pinned?: boolean };
export type ScheduleResult = { blocks: ScheduleBlock[]; issues: ScheduleIssue[] };
export type ScheduleOptions = { previous?: ScheduleBlock[] };

const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
const priorityWeight = (task: Task) => 4 - task.priority;

/** Per-minute integrals let every candidate use the whole interval, including dips
 * and fractional final minutes, without repeated timezone formatting. */
function energyCosts(config: DayConfig, start: number, end: number) {
  const format = new Intl.DateTimeFormat('en-GB', { timeZone: config.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const levels: number[] = [];
  for (let t = start; t < end; t += MINUTE) {
    const parts = format.formatToParts(t);
    levels.push(energyAtMinute(config.chronotype, Number(parts.find(p => p.type === 'hour')!.value) * 60 + Number(parts.find(p => p.type === 'minute')!.value)));
  }
  const prefixes = [1, 2, 3, 4, 5].map(required => {
    const prefix = [0];
    for (const level of levels) {
      const deficit = Math.max(0, required - level);
      const surplus = Math.max(0, level - required);
      // Shortfall is deliberately much more expensive than surplus.
      prefix.push(prefix.at(-1)! + 12 * deficit ** 2 + surplus ** 2);
    }
    return prefix;
  });
  const integral = (prefix: number[], offset: number) => {
    const x = Math.max(0, Math.min(levels.length, offset));
    const whole = Math.floor(x);
    return prefix[whole] + (x - whole) * ((prefix[whole + 1] ?? prefix[whole]) - prefix[whole]);
  };
  return (task: Task, at: number) => {
    const prefix = prefixes[task.energyRequired - 1];
    return priorityWeight(task) * (integral(prefix, (at - start) / MINUTE + task.durationMinutes) - integral(prefix, (at - start) / MINUTE));
  };
}

function windowsAround(placements: Placement[], start: number, end: number) {
  const windows: { start: number; end: number }[] = [];
  let cursor = start;
  for (const block of [...placements].sort((a, b) => a.start - b.start)) {
    if (block.start > cursor) windows.push({ start: cursor, end: block.start });
    cursor = Math.max(cursor, block.end);
  }
  if (cursor < end) windows.push({ start: cursor, end });
  return windows;
}

/** Deterministic bounded search. Coverage by priority precedes energy cost;
 * several packing orders and a local move/pair pass reduce greedy dead ends.
 * This is a heuristic, not a claim of a globally optimal schedule. */
export function planSchedule(tasks: Task[], config: DayConfig, options: ScheduleOptions = {}): ScheduleResult {
  const start = createDateInTimeZone(config.date, config.startTime, config.timezone).getTime();
  const end = createDateInTimeZone(config.date, config.endTime, config.timezone).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return { blocks: [], issues: tasks.map(t => ({ taskId: t.id, message: 'Choose a valid time window.' })) };
  const previous = new Map((options.previous ?? []).map(b => [b.taskId, b]));
  const issues: ScheduleIssue[] = [];
  const anchors: Placement[] = [];
  const flexible: Task[] = [];
  for (const task of tasks) {
    const pin = previous.get(task.id);
    if ((options.previous ?? []).filter(b => b.taskId === task.id && b.pinned).length > 1) {
      issues.push({ taskId: task.id, pinned: true, message: 'This task has multiple pinned segments. Unpin it to plan one uninterrupted block.' });
      continue;
    }
    if (!(task.durationMinutes > 0) || !Number.isFinite(task.durationMinutes) || ![1, 2, 3, 4, 5].includes(task.energyRequired)) {
      issues.push({ taskId: task.id, message: 'Choose a valid duration and energy rating.' });
      continue;
    }
    if (!task.fixedStart && !pin?.pinned) { flexible.push(task); continue; }
    const at = task.fixedStart ? createDateInTimeZone(config.date, task.fixedStart, config.timezone).getTime() : Date.parse(pin!.start);
    const placement = { task, start: at, end: at + task.durationMinutes * MINUTE, fixed: !!task.fixedStart, pinned: !task.fixedStart && !!pin?.pinned };
    if (!Number.isFinite(at) || at < start || placement.end > end) {
      issues.push({ taskId: task.id, pinned: placement.pinned, message: placement.pinned ? 'Pinned time no longer fits. Unpin this task or expand the time window.' : 'Fixed commitment is outside the time window.' });
    } else {
      anchors.push(placement);
    }
  }
  const conflicting = new Set<string>();
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++) {
    if (overlaps(anchors[i], anchors[j])) {
      for (const block of [anchors[i], anchors[j]]) {
        if (!conflicting.has(block.task.id)) issues.push({ taskId: block.task.id, pinned: block.pinned, message: 'This fixed or pinned time overlaps another commitment. Adjust the time or unpin the task.' });
        conflicting.add(block.task.id);
      }
    }
  }
  // Keep valid anchors reserved even during a conflict. Do not silently move one
  // of the user's commitments or schedule flexible work into its disputed time.

  const energyCost = energyCosts(config, start, end);
  const cost = (p: Placement) => {
    const old = previous.get(p.task.id);
    const movement = old ? Math.min(60, Math.abs(p.start - Date.parse(old.start)) / MINUTE) * 0.05 : 0;
    return energyCost(p.task, p.start) + movement;
  };
  const candidates = (task: Task, placed: Placement[]) => {
    const values = new Set<number>();
    for (const window of windowsAround(placed, start, end)) {
      const latest = window.end - task.durationMinutes * MINUTE;
      if (latest < window.start) continue;
      values.add(window.start); values.add(latest);
      for (let at = window.start; at <= latest; at += RESOLUTION * MINUTE) values.add(at);
      const old = previous.get(task.id);
      if (old && Date.parse(old.start) >= window.start && Date.parse(old.start) <= latest) values.add(Date.parse(old.start));
    }
    return [...values].map(at => ({ task, start: at, end: at + task.durationMinutes * MINUTE }));
  };
  const pack = (order: Task[], base: Placement[], compact = false) => {
    const placed = [...base];
    for (const task of order) {
      const choices = candidates(task, placed);
      choices.sort((a, b) => (compact ? 0 : cost(a) - cost(b)) || a.start - b.start);
      if (choices[0]) placed.push(choices[0]);
    }
    return placed;
  };
  const rank = (plan: Placement[]) => {
    const ids = new Set(plan.map(p => p.task.id));
    const missing = [1, 2, 3].map(priority => tasks.filter(t => t.priority === priority && !ids.has(t.id)).length);
    const ordered = [...plan].sort((a, b) => a.start - b.start);
    const gaps = windowsAround(plan, start, end).filter(w => w.start > start && w.end < end).length;
    return [...missing, plan.reduce((sum, p) => sum + cost(p), 0) + gaps * 0.1,
      ordered.at(-1)?.end ?? start, ...ordered.map(p => p.start)];
  };
  const better = (a: Placement[], b: Placement[]) => {
    const ar = rank(a), br = rank(b);
    for (let i = 0; i < Math.min(ar.length, br.length); i++) if (Math.abs(ar[i] - br[i]) > 1e-6) return ar[i] < br[i];
    return false;
  };
  const orders = [
    [...flexible].sort((a, b) => a.priority - b.priority || b.energyRequired - a.energyRequired || b.durationMinutes - a.durationMinutes),
    [...flexible].sort((a, b) => b.durationMinutes - a.durationMinutes || a.priority - b.priority),
    [...flexible].sort((a, b) => a.priority - b.priority || b.durationMinutes - a.durationMinutes),
  ];
  let best = [...anchors];
  for (const order of orders) for (const compact of [false, true]) {
    const plan = pack(order, anchors, compact);
    if (better(plan, best)) best = plan;
  }
  // Bounded improvements: relocate individual tasks, then repack pairs. Include
  // missing work first so a different arrangement can recover full coverage.
  for (let pass = 0; pass < 2; pass++) {
    const ordered = [...flexible].sort((a, b) => Number(best.some(p => p.task.id === a.id)) - Number(best.some(p => p.task.id === b.id)));
    for (const task of ordered) {
      const plan = pack([task], best.filter(p => p.task.id !== task.id));
      if (better(plan, best)) best = plan;
    }
    let pairs = 0;
    for (let i = 0; i < ordered.length && pairs < 96; i++) for (let j = i + 1; j < ordered.length && pairs < 96; j++, pairs++) {
      const a = ordered[i], b = ordered[j];
      const base = best.filter(p => p.task.id !== a.id && p.task.id !== b.id);
      for (const pair of [[a, b], [b, a]]) for (const compact of [false, true]) {
        const plan = pack(pair, base, compact);
        if (better(plan, best)) best = plan;
      }
    }
  }
  const remainingWindows = windowsAround(best, start, end);
  const freeMinutes = remainingWindows.reduce((sum, w) => sum + (w.end - w.start) / MINUTE, 0);
  for (const task of tasks.filter(t => !best.some(p => p.task.id === t.id) && !issues.some(issue => issue.taskId === t.id))) {
    issues.push({ taskId: task.id, message: freeMinutes >= task.durationMinutes
      ? 'Free time is split into smaller gaps. Shorten this task, move a commitment, or expand the time window.'
      : 'Not enough free time remains. Shorten a task, remove work, or expand the time window.' });
  }
  return { blocks: best.filter(p => !conflicting.has(p.task.id)).map(toBlock).sort(byStart), issues };
}

function toBlock(p: Placement): ScheduleBlock {
  return { id: `${p.fixed ? 'fixed' : 'flex'}-${p.task.id}`, taskId: p.task.id, taskName: p.task.name,
    start: new Date(p.start).toISOString(), end: new Date(p.end).toISOString(), isBreak: !!p.task.isBreak,
    energyRequired: p.task.energyRequired, ...(p.fixed ? { fixed: true } : {}), ...(p.pinned ? { pinned: true } : {}) };
}
const byStart = (a: ScheduleBlock, b: ScheduleBlock) => Date.parse(a.start) - Date.parse(b.start);

export function generateSchedule(tasks: Task[], config: DayConfig, options: ScheduleOptions = {}): ScheduleBlock[] {
  return planSchedule(tasks, config, options).blocks;
}

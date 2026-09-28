import type { DayConfig, SavedTimeblock, ScheduleBlock, Task } from './types';
import { getEnergyLevelAt } from './energy-profiles';
import { buildManualSchedule } from './utils/manualSchedule';
import { planSchedule } from './rhythmScheduler';

/** Legacy plans had only task order. Resolve once on load/save, then preserve
 * the accepted instants across cards, exports and timer opening. */
export function acceptedSchedule(timeblock: SavedTimeblock): ScheduleBlock[] {
  const blocks = timeblock.schedule ?? buildManualSchedule(timeblock.tasks, timeblock.dayConfig);
  const fixedIds = new Set(timeblock.tasks.filter(t => t.fixedStart).map(t => t.id));
  return blocks.map(b => fixedIds.has(b.taskId) && !b.fixed ? { ...b, fixed: true } : b);
}

export function explainPlacement(block: ScheduleBlock, config: DayConfig) {
  const prefix = block.fixed ? 'Fixed commitment. ' : block.pinned ? 'Pinned by you. ' : '';
  if (block.isBreak) return { belowPreferred: false, text: `${prefix}Break time reserved; it does not change your energy profile.` };
  const start = Date.parse(block.start), end = Date.parse(block.end);
  let below = 0, min = 5, max = 1;
  for (let at = start; at < end; at += 60_000) {
    const level = getEnergyLevelAt(config.chronotype, new Date(at), config.timezone);
    min = Math.min(min, level); max = Math.max(max, level);
    if (level < block.energyRequired) below += Math.min(60_000, end - at) / 60_000;
  }
  const available = min === max ? `${min}/5` : `${min}–${max}/5`;
  const detail = below > 0
    ? `Below preferred energy for ${Math.ceil(below)} min. ${config.chronotype} energy ${available}; task needs ${block.energyRequired}/5.`
    : block.energyRequired <= 2 && max <= 3
      ? `Light work in a quieter period. ${config.chronotype} energy ${available}.`
      : `Enough energy throughout. ${config.chronotype} energy ${available}; task needs ${block.energyRequired}/5.`;
  return { belowPreferred: below > 0, text: prefix + detail };
}

/** Only the span crossed by a move is repacked. Everything outside that span
 * retains its exact timestamps; fixed and pinned blocks inside stay anchored. */
export function moveScheduleBlock(blocks: ScheduleBlock[], from: number, to: number): ScheduleBlock[] {
  if (from === to || !blocks[from] || !blocks[to]) return blocks;
  if (blocks[from].fixed || blocks[from].pinned) throw new Error('Unpin this task before moving it. Fixed commitments must be edited in Workload.');
  const first = Math.min(from, to), last = Math.max(from, to);
  const reordered = blocks.slice(first, last + 1).map(b => ({ ...b }));
  const [moved] = reordered.splice(from - first, 1);
  reordered.splice(to - first, 0, moved);
  let cursor = Date.parse(blocks[first].start);
  const limit = Date.parse(blocks[last].end);
  for (const block of reordered) {
    const duration = Date.parse(block.end) - Date.parse(block.start);
    if (block.fixed || block.pinned) {
      if (cursor > Date.parse(block.start)) throw new Error('This move would displace a fixed or pinned task. Unpin it or choose another position.');
      cursor = Date.parse(block.end);
    } else {
      block.start = new Date(cursor).toISOString();
      block.end = new Date(cursor + duration).toISOString();
      cursor += duration;
    }
  }
  if (cursor > limit) throw new Error('This order does not fit in the available gap. Choose another position.');
  moved.pinned = true;
  return [...blocks.slice(0, first), ...reordered, ...blocks.slice(last + 1)];
}

/** Descriptive edits retain placement. Timing edits use the same planner and
 * fail atomically when they would lose work or displace a pin. */
export function updateAcceptedTask(timeblock: SavedTimeblock, taskId: string, updates: Partial<Task>): SavedTimeblock {
  const task = timeblock.tasks.find(t => t.id === taskId);
  if (!task) return timeblock;
  const tasks = timeblock.tasks.map(t => t.id === taskId ? { ...t, ...updates, id: t.id } : t);
  if ((updates.durationMinutes !== undefined && updates.durationMinutes !== task.durationMinutes) ||
      (updates.fixedStart !== undefined && updates.fixedStart !== task.fixedStart)) {
    const result = planSchedule(tasks, timeblock.dayConfig, { previous: acceptedSchedule(timeblock) });
    if (result.issues.length) throw new Error('This edit conflicts with your schedule. Edit the timeblock to adjust its window or pins.');
    return { ...timeblock, tasks, schedule: result.blocks };
  }
  return { ...timeblock, tasks,
    schedule: acceptedSchedule(timeblock).map(b => b.taskId === taskId ? { ...b,
      taskName: updates.name ?? b.taskName, energyRequired: updates.energyRequired ?? b.energyRequired,
      isBreak: updates.isBreak ?? b.isBreak } : b) };
}

import type { DayConfig, ScheduleBlock, Task } from './types';
import { validateTimeblockPlan } from './timeblock-plan';
import { createDateInTimeZone } from './utils/timezone';

/** Re-time accepted blocks, without re-running the energy scheduler or rebuilding tasks. */
export function reorderSchedule(blocks: ScheduleBlock[], tasks: Task[], config: DayConfig, from: number, to: number): { blocks: ScheduleBlock[]; error?: string } {
  const reject = (error: string) => ({ blocks, error });
  if (from < 0 || to < 0 || from >= blocks.length || to >= blocks.length || from === to) return { blocks };
  const validation = validateTimeblockPlan(tasks, config.startTime, config.endTime);
  if (!validation.valid) return reject(Object.values(validation.errors)[0] ?? 'Choose a valid time window before rearranging.');
  const fixedIds = new Set(tasks.filter(t => t.fixedStart).map(t => t.id));
  if (fixedIds.has(blocks[from].taskId)) return reject('Fixed-time tasks stay at their scheduled time.');
  const order = [...blocks];
  const [moved] = order.splice(from, 1);
  order.splice(to, 0, moved);
  let cursor = createDateInTimeZone(config.date, config.startTime, config.timezone).getTime();
  const limit = createDateInTimeZone(config.date, config.endTime, config.timezone).getTime();
  const next: ScheduleBlock[] = [];
  for (const block of order) {
    const duration = Date.parse(block.end) - Date.parse(block.start);
    const fixed = fixedIds.has(block.taskId);
    const start = fixed ? Date.parse(block.start) : cursor;
    if (!(duration > 0) || start < cursor || start + duration > limit) {
      return reject('This order cannot fit around your fixed times and time window. Try another position.');
    }
    next.push({ ...block, start: new Date(start).toISOString(), end: new Date(start + duration).toISOString() });
    cursor = start + duration;
  }
  return { blocks: next };
}

import { anchorKey, validAnchor } from './recovery/recovery-types';
import type { Task, ScheduleBlock, DayConfig } from './types';
import { validateTimeblockPlan } from './timeblock-plan';
import { createDateInTimeZone } from './utils/timezone';

/** Empty gaps are valid; every selected task must retain its full duration. */
export function validateSchedule(tasks: Task[], config: DayConfig, blocks: ScheduleBlock[]) {
  const plan = validateTimeblockPlan(tasks, config.startTime, config.endTime);
  const errors = Object.values(plan.errors);
  if (!plan.validRange) errors.push('Choose a valid time window.');
  if (!tasks.some(t => !t.isBreak)) errors.push('Select at least one task.');
  if (!plan.valid) return { valid: false, errors, unallocated: tasks.map(t => ({ taskId: t.id, name: t.name, minutes: t.durationMinutes })), excess: 0, message: errors[0] ?? 'Review your task details.' };
  const start = createDateInTimeZone(config.date, config.startTime, config.timezone).getTime();
  const end = createDateInTimeZone(config.date, config.endTime, config.timezone).getTime();
  const byId = new Map(tasks.map(t => [t.id, t]));
  if (byId.size !== tasks.length) errors.push('Each task must be selected only once.');
  const durations = new Map<string, number>();
  const ids = new Set<string>();
  const anchors = new Set<string>();
  let previousEnd = start;
  for (const block of blocks) {
    const a = Date.parse(block.start), b = Date.parse(block.end);
    const task = byId.get(block.taskId);
    if ((!task && !block.recovery) || ids.has(block.id)) errors.push('Schedule contains an unknown or duplicate block.');
    ids.add(block.id);
    if (block.recovery && validAnchor(block.recovery.anchor)) {
      const anchor = block.recovery.anchor;
      const key = anchorKey(anchor);
      const owner = byId.get(anchor.taskId);
      if (!owner || owner.isBreak || anchor.offsetMinutes>owner.durationMinutes+1e-6 || anchors.has(key)) errors.push('Recovery breaks must have distinct valid task boundaries.');
      anchors.add(key);
    }
    if (block.recovery && (!block.isBreak || block.isFixed || !validAnchor(block.recovery.anchor) || !['automatic','manual-override'].includes(block.recovery.source) || task)) errors.push('Invalid recovery break.');
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || a < start || b > end) errors.push('Every block must fit inside the time window.');
    if (a < previousEnd) errors.push('Scheduled blocks overlap or are out of order.');
    previousEnd = Math.max(previousEnd, b);
    if (task && (!!task.isBreak !== block.isBreak)) errors.push('A scheduled task has the wrong break status.');
    if (task?.fixedStart && (a !== createDateInTimeZone(config.date, task.fixedStart, config.timezone).getTime() || b - a !== task.durationMinutes * 60000)) errors.push(`${task.name} must stay at its fixed time for its full duration.`);
    if (!block.recovery) durations.set(block.taskId, (durations.get(block.taskId) ?? 0) + (Number.isFinite(b - a) ? (b - a) / 60000 : 0));
  }
  const unallocated = tasks.flatMap(task => {
    const minutes = task.durationMinutes - (durations.get(task.id) ?? 0);
    if (minutes < -1e-6) errors.push(`${task.name} has more time scheduled than estimated.`);
    return minutes > 1e-6 ? [{ taskId: task.id, name: task.name, minutes }] : [];
  });
  const available = (end - start) / 60000;
  const excess = Math.max(0, tasks.reduce((n, t) => n + t.durationMinutes, 0) - available);
  const valid = plan.valid && errors.length === 0 && unallocated.length === 0 && blocks.length > 0;
  const message = errors.length ? errors[0] : excess > 0
    ? `Your tasks exceed the available time by ${excess} minutes.`
    : unallocated.length ? 'Some work could not be arranged around your fixed commitments. Adjust the tasks or time window.'
    : 'All tasks fit around your fixed commitments, including any split parts.';
  return { valid, errors: [...new Set(errors)], unallocated, excess, message };
}

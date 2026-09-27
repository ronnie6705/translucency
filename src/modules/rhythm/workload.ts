import type { ScheduleBlock, Task } from './types';
import { parseTimeToMinutes } from './utils/manualSchedule';

export const energyBand = (energy: number) => energy <= 2 ? 'Low' : energy < 4 ? 'Moderate' : 'High';
export function workloadSummary(tasks: Task[], start: string, end: string) {
  const work = tasks.filter(task => !task.isBreak);
  const estimated = tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  const available = Math.max(0, (parseTimeToMinutes(end) ?? 0) - (parseTimeToMinutes(start) ?? 0));
  const average = work.length ? work.reduce((sum, task) => sum + task.energyRequired, 0) / work.length : 0;
  const distribution = { Low: 0, Moderate: 0, High: 0 };
  work.forEach(task => distribution[energyBand(task.energyRequired)]++);
  return { count: work.length, estimated, available, average, distribution, excess: Math.max(0, estimated - available) };
}
export function scheduleSummary(blocks: ScheduleBlock[]) {
  return { count: new Set(blocks.filter(b => !b.isBreak).map(b => b.taskId)).size,
    work: blocks.filter(b => !b.isBreak).reduce((sum, b) => sum + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0),
    breaks: blocks.filter(b => b.isBreak).reduce((sum, b) => sum + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0),
    finish: blocks.at(-1)?.end };
}

import type { SavedTimeblock, Task, ScheduleBlock } from '../types';
import { blockMinutes, placeOrderedBlocks, sliceScheduleBlock } from '../schedule-placement';
import { createDateInTimeZone } from '../utils/timezone';
import { generateScheduleResult } from './recovery-planner';

/** Explicit edits update this plan's accepted snapshot, never another plan or run. */
export function updateRecoveryPlan(plan: SavedTimeblock, tasks: Task[]): SavedTimeblock {
  if (!plan.breakPreferences || !tasks.some(t => !t.isBreak)) return {...plan,tasks,schedule:undefined,recoveryBaseSchedule:undefined};
  const byId = new Map(tasks.map(t => [t.id,t]));
  const original = plan.recoveryBaseSchedule;
  const sameWork = tasks.length === plan.tasks.length && tasks.every(task => {
    const before = plan.tasks.find(t => t.id===task.id);
    return before && before.durationMinutes===task.durationMinutes && before.energyRequired===task.energyRequired && before.fixedStart===task.fixedStart && before.isBreak===task.isBreak;
  });
  if (sameWork && plan.schedule) {
    const rename = (blocks: ScheduleBlock[] | undefined) => blocks?.map(b => byId.has(b.taskId) ? {...b,taskName:byId.get(b.taskId)!.name} : b);
    return {...plan,tasks,schedule:rename(plan.schedule),recoveryBaseSchedule:rename(original)};
  }
  let baseSchedule = original;
  if (original) {
    const totals = new Map<string,number>();
    original.forEach(b => totals.set(b.taskId,(totals.get(b.taskId) ?? 0)+blockMinutes(b)));
    baseSchedule = original.flatMap(block => {
      const task = byId.get(block.taskId);
      if (!task) return [];
      const duration = blockMinutes(block)*task.durationMinutes/totals.get(task.id)!;
      const start = task.fixedStart ? createDateInTimeZone(plan.dayConfig.date,task.fixedStart,plan.dayConfig.timezone).toISOString() : block.start;
      return [{...sliceScheduleBlock({...block,start},0,duration),taskName:task.name,energyRequired:task.energyRequired,isBreak:!!task.isBreak,isFixed:!!task.fixedStart,workOffsetMinutes:undefined}];
    });
    const placed = placeOrderedBlocks(baseSchedule,createDateInTimeZone(plan.dayConfig.date,plan.dayConfig.startTime,plan.dayConfig.timezone).getTime(),createDateInTimeZone(plan.dayConfig.date,plan.dayConfig.endTime,plan.dayConfig.timezone).getTime());
    if (placed.error) throw new Error('This edit cannot fit the saved timeblock. Edit its workload or time range first.');
    baseSchedule = placed.blocks;
  }
  const result = generateScheduleResult(tasks,plan.dayConfig,{preferences:plan.breakPreferences,baseSchedule});
  if (result.status==='invalid') throw new Error(result.errors.join(' '));
  return {...plan,tasks,schedule:result.blocks,recoveryBaseSchedule:result.baseSchedule};
}

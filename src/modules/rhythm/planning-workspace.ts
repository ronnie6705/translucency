import type { TimeAdjustments } from './time-adjustments';
import type { DayConfig, ScheduleBlock, Task } from './types';
import type { BreakPreferences } from './recovery/recovery-types';
import { generateScheduleResult, type SchedulingResult } from './recovery/recovery-planner';
import { generateSchedule } from './rhythmScheduler';
import { blockMinutes, placeOrderedBlocks, sliceScheduleBlock } from './schedule-placement';
import { validateTimeblockPlan } from './timeblock-plan';
import { createDateInTimeZone } from './utils/timezone';

export interface PlanningInputs { tasks: Task[]; config: DayConfig; preferences: BreakPreferences }
export interface PlanningOrder { blocks: ScheduleBlock[]; tasks: Task[]; config: DayConfig }
export interface PlanningSnapshot extends PlanningInputs { adjustments?:TimeAdjustments; result: SchedulingResult; order: PlanningOrder | null }
const invalid = (errors: string[], baseSchedule: ScheduleBlock[] = []): SchedulingResult => ({
  status:'invalid', blocks:[], baseSchedule, errors, notices:[], inactiveOverrideKeys:[],
  recommendedRecoveryMinutes:0, scheduledRecoveryMinutes:0, recoveryShortfallMinutes:0,
});

/** Adapt existing segments to explicit estimate edits; never scale work to available capacity. */
function updateOrderedEstimates(order: PlanningOrder, tasks: Task[], config: DayConfig): ScheduleBlock[] {
  const remaining = new Map(tasks.map(t => [t.id,t.durationMinutes]));
  const byId = new Map(tasks.map(t => [t.id,t]));
  const original = order.blocks.filter(b => !b.recovery && byId.has(b.taskId));
  const offsets = new Map<string,number>();
  return original.flatMap((block,index) => {
    const task = byId.get(block.taskId)!;
    const left = remaining.get(task.id)!;
    if (left <= 0) return [];
    const last = !original.slice(index+1).some(b => b.taskId===task.id);
    const duration = last ? left : Math.min(left,blockMinutes(block));
    remaining.set(task.id,left-duration);
    const offset = offsets.get(task.id) ?? 0;
    offsets.set(task.id,offset+duration);
    const changed = {...sliceScheduleBlock(block,0,duration),taskName:task.name,energyRequired:task.energyRequired,isBreak:!!task.isBreak,isFixed:!!task.fixedStart,workOffsetMinutes:offset};
    if (task.fixedStart) {
      const start = createDateInTimeZone(config.date,task.fixedStart,config.timezone).getTime();
      return [{...changed,start:new Date(start).toISOString(),end:new Date(start+duration*60000).toISOString()}];
    }
    return [changed];
  });
}

/** One planning entry point, delegating all placement/recovery to the existing engine. */
export function calculatePlanningSchedule(inputs: PlanningInputs, order: PlanningOrder | null = null): SchedulingResult {
  const {tasks,config,preferences} = inputs;
  const validation = validateTimeblockPlan(tasks,config.startTime,config.endTime);
  if (!validation.valid) return invalid([
    ...(!validation.validRange ? ['Choose an end time later than the start, in five-minute increments on the same day.'] : []),
    ...(!tasks.some(t=>!t.isBreak) ? ['Keep at least one task in this timeblock.'] : []),
    ...Object.entries(validation.errors).map(([id,error]) => `${tasks.find(t=>t.id===id)?.name}: ${error}`),
  ]);
  const anchored = tasks.filter(t=>t.plannedBreakAfterTaskId);
  const missing = anchored.filter(t=>!tasks.some(owner=>owner.id===t.plannedBreakAfterTaskId && !owner.isBreak));
  if (missing.length) return invalid(missing.map(t=>`${t.name} needs a new task boundary. Reposition or cancel this break.`));
  const ordinary = tasks.filter(t=>!t.plannedBreakAfterTaskId);
  // Preserve an untouched accepted schedule, including intentional idle gaps.
  if (order && JSON.stringify(order.tasks)===JSON.stringify(tasks) && JSON.stringify(order.config)===JSON.stringify(config)) {
    return generateScheduleResult(tasks,config,{preferences,baseSchedule:order.blocks});
  }
  let base = order ? updateOrderedEstimates(order,ordinary,config) : generateSchedule(ordinary,config);
  if (order) {
    const present = new Set(base.map(b=>b.taskId));
    const additions = ordinary.filter(t=>!present.has(t.id));
    // New tasks retain their own full estimates and join the chosen order.
    base = [...base,...generateSchedule(additions,config)];
  }
  for (const task of anchored) {
    const index = base.findLastIndex(b=>b.taskId===task.plannedBreakAfterTaskId || (tasks.find(t=>t.id===b.taskId)?.plannedBreakAfterTaskId===task.plannedBreakAfterTaskId));
    if (index < 0) return invalid([`${task.name} cannot be placed until its anchor task fits.`]);
    const start = Date.parse(base[index].end);
    base.splice(index+1,0,{id:`planned-${task.id}`,taskId:task.id,taskName:task.name,isBreak:true,start:new Date(start).toISOString(),end:new Date(start+task.durationMinutes*60000).toISOString()});
  }
  if (order || anchored.length) {
    const placed = placeOrderedBlocks(base,createDateInTimeZone(config.date,config.startTime,config.timezone).getTime(),createDateInTimeZone(config.date,config.endTime,config.timezone).getTime(),false,true);
    if (placed.error) return invalid([placed.error],base);
    base = placed.blocks;
  }
  return generateScheduleResult(tasks,config,{preferences,baseSchedule:base});
}

export function requiredCapacityShortfall({tasks,config}: PlanningInputs): number {
  const validation = validateTimeblockPlan([],config.startTime,config.endTime);
  if (!validation.validRange) return 0;
  const available = (createDateInTimeZone(config.date,config.endTime,config.timezone).getTime()-createDateInTimeZone(config.date,config.startTime,config.timezone).getTime())/60000;
  return Math.max(0,tasks.reduce((sum,t)=>sum+t.durationMinutes,0)-available);
}

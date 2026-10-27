import type { Task } from './types';
import type { BreakPreferences } from './recovery/recovery-types';

export const MIN_SHORTENED_TASK_MINUTES = 5;
export interface TaskShortening {
  id: string;
  beforeMinutes: number;
  beforeMode: Task['durationMode'];
  afterMinutes: number;
  baselineMinutes?: number;
  beforeWorkingEstimate?: number;
}
export interface ShorteningPlan { changes: TaskShortening[]; minutes: number; percent: number }

/** Opt-in estimate changes only. Capacity/placement is still validated by the planning engine. */
export function planTaskShortening(tasks: Task[], preferences: BreakPreferences, shortfall: number, maxReductionPercent?: number): ShorteningPlan {
  const empty = {changes:[],minutes:0,percent:0};
  if (preferences.preset==='none' || !Number.isFinite(shortfall) || shortfall<=0) return empty;
  const eligible = tasks.filter(t=>!t.isBreak && !t.fixedStart && t.allowTimeAdjustments!==false && Number.isFinite(t.durationMinutes)).map(task=>{
    // Do not strand an explicitly adjusted recovery break inside a shortened task.
    const protectedOffsets = preferences.overrides.filter(o=>o.anchor.taskId===task.id && !o.anchor.atTaskEnd && o.durationMinutes && o.anchor.offsetMinutes<=task.durationMinutes).map(o=>o.anchor.offsetMinutes+1);
    const minimum = Math.max(MIN_SHORTENED_TASK_MINUTES,...protectedOffsets);
    const baseline=task.workingEstimateMinutes ?? task.durationMinutes;
    const remainingCap=maxReductionPercent===undefined ? Infinity : Math.max(0,Math.floor(baseline*maxReductionPercent/100)-(baseline-task.durationMinutes));
    return {task,weight:baseline,capacity:Math.max(0,Math.floor(Math.min(task.durationMinutes-minimum,remainingCap))),amount:0};
  }).filter(row=>row.capacity>0);
  const target = Math.min(Math.ceil(shortfall),eligible.reduce((n,row)=>n+row.capacity,0));
  if (!target) return empty;
  let left=target, active=[...eligible];
  // Capped proportional allocation: redistribute only the share that would violate a minimum.
  while (active.length && left>0) {
    const weight=active.reduce((n,row)=>n+row.weight,0);
    const capped=active.filter(row=>left*row.weight/weight>=row.capacity);
    if (!capped.length) { active.forEach(row=>{row.amount=left*row.weight/weight;}); break; }
    for(const row of capped) {row.amount=row.capacity;left-=row.capacity;}
    active=active.filter(row=>!capped.includes(row));
  }
  const ranked=[...eligible].sort((a,b)=>(b.amount-Math.floor(b.amount))-(a.amount-Math.floor(a.amount)) || a.task.id.localeCompare(b.task.id));
  let remainder=target-eligible.reduce((n,row)=>n+Math.floor(row.amount),0);
  eligible.forEach(row=>{row.amount=Math.floor(row.amount);});
  for(const row of ranked) if(remainder>0 && row.amount<row.capacity) {row.amount++;remainder--;}
  const changes=eligible.filter(row=>row.amount>0).map(({task,amount})=>({id:task.id,beforeMinutes:task.durationMinutes,beforeMode:task.durationMode,afterMinutes:task.durationMinutes-amount,baselineMinutes:task.workingEstimateMinutes ?? task.durationMinutes,beforeWorkingEstimate:task.workingEstimateMinutes}));
  const weight=eligible.reduce((n,row)=>n+row.weight,0);
  return {changes,minutes:target,percent:100*target/weight};
}

export function applyTaskShortening(tasks: Task[], plan: ShorteningPlan): Task[] {
  const changes=new Map(plan.changes.map(change=>[change.id,change]));
  return tasks.map(task=>{
    const change=changes.get(task.id);
    return change && !task.isBreak && !task.fixedStart && task.durationMinutes===change.beforeMinutes
      ? {...task,workingEstimateMinutes:task.workingEstimateMinutes ?? task.durationMinutes,durationMinutes:change.afterMinutes,durationMode:'custom'} : task;
  });
}

/** Undo only our estimates. Later user edits, task removals and fixed commitments win. */
export function undoTaskShortening(tasks: Task[], changes: TaskShortening[]): Task[] {
  const byId=new Map(changes.map(change=>[change.id,change]));
  return tasks.map(task=>{
    const change=byId.get(task.id);
    if (!change || task.isBreak || task.fixedStart || task.durationMinutes!==change.afterMinutes || task.durationMode!=='custom' || (change.baselineMinutes!==undefined && (task.workingEstimateMinutes ?? task.durationMinutes)!==change.baselineMinutes)) return task;
    const restored={...task,durationMinutes:change.beforeMinutes,durationMode:change.beforeMode,workingEstimateMinutes:change.beforeWorkingEstimate};
    if (change.beforeWorkingEstimate===undefined) delete restored.workingEstimateMinutes;
    if (change.beforeMode===undefined) delete restored.durationMode;
    return restored;
  });
}

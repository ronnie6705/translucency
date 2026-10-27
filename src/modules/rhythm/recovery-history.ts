import type { Task, ScheduleBlock } from './types';
import { calculatePlanningSchedule, type PlanningSnapshot, type PlanningOrder, type PlanningInputs } from './planning-workspace';
import { validBreakPreferences, type BreakPreferences } from './recovery/recovery-types';
import { effectiveFlexibility, workingEstimate } from './time-adjustments';
import { optimizeRecovery } from './recovery-optimization';
import { validateSchedule } from './schedule-validation';
import type { SchedulingResult } from './recovery/recovery-planner';

export interface RecoveryChange {
  preferences:BreakPreferences;
  percent:number;
  fingerprint:string;
  allocations:{id:string; baseline:number; minutes:number}[];
  /** Placement cache only, not a copy of mutable task/library data. */
  result:SchedulingResult;
}
export function recoveryFingerprint(inputs:PlanningInputs,order:PlanningOrder|null) {
  return JSON.stringify({config:inputs.config,tasks:inputs.tasks.map(t=>({...t,durationMinutes:workingEstimate(t),workingEstimateMinutes:undefined,durationMode:undefined})),order:[...new Set(order?.blocks.filter(b=>!b.recovery).map(b=>b.taskId) ?? [])]});
}
export function captureRecoveryChange(snapshot:PlanningSnapshot):RecoveryChange {
  return structuredClone({preferences:snapshot.preferences,percent:effectiveFlexibility(snapshot.adjustments!),fingerprint:recoveryFingerprint(snapshot,snapshot.order),allocations:snapshot.tasks.map(t=>({id:t.id,baseline:workingEstimate(t),minutes:t.durationMinutes})),result:snapshot.result});
}
export function undoRecoveryChange(current:PlanningSnapshot):{snapshot:PlanningSnapshot;error?:string} {
  const history=current.adjustments?.recoveryHistory ?? [],entry=history.at(-1);
  if(!entry)return {snapshot:current};
  const settings={...current,preferences:structuredClone(entry.preferences)};
  let tasks:Task[],result:SchedulingResult,order=current.order;
  if(entry.fingerprint===recoveryFingerprint(current,current.order)) {
    tasks=current.tasks.map(t=>{const prior=entry.allocations.find(a=>a.id===t.id);return prior?{...t,durationMinutes:prior.minutes}:t;});
    result=structuredClone(entry.result);
    const validation=validateSchedule(tasks,current.config,result.blocks);
    if(!validation.valid)return {snapshot:current,error:`Undo cannot be applied: ${validation.message}`};
  } else {
    // Baselines missing from the entry were explicitly edited; Undo must not shorten those edits.
    const protectedIds=new Set(current.tasks.filter(t=>!entry.allocations.some(a=>a.id===t.id && a.baseline===workingEstimate(t))).map(t=>t.id));
    const calculated=optimizeRecovery(settings,current.order,entry.percent,protectedIds);
    tasks=calculated.tasks;result=calculated.result;order=calculated.order;
    if(result.status==='invalid')return {snapshot:current,error:`Undo cannot be applied: ${result.errors.join(' ')}`};
  }
  return {snapshot:{...settings,tasks,result,order,adjustments:{...current.adjustments!,effectivePercent:entry.percent,recoveryHistory:history.slice(0,-1),recoveryMetrics:{recommended:result.recommendedRecoveryMinutes,scheduled:result.scheduledRecoveryMinutes}}}};
}
const validBlocks=(blocks:ScheduleBlock[])=>Array.isArray(blocks) && blocks.every(b=>b && typeof b.id==='string' && typeof b.taskId==='string' && typeof b.taskName==='string' && typeof b.isBreak==='boolean' && Number.isFinite(Date.parse(b.start)) && Date.parse(b.end)>Date.parse(b.start));
export function validRecoveryHistory(value:unknown):value is RecoveryChange[] {
  return Array.isArray(value) && value.length<=20 && value.every(e=>e && validBreakPreferences(e.preferences) && Number.isInteger(e.percent) && e.percent>=0 && e.percent<=20 && typeof e.fingerprint==='string' && Array.isArray(e.allocations) && new Set(e.allocations.map((a:{id:string})=>a?.id)).size===e.allocations.length && e.allocations.every((a:{id:string;baseline:number;minutes:number})=>a && typeof a.id==='string' && Number.isFinite(a.baseline) && a.baseline>0 && Number.isFinite(a.minutes) && a.minutes>0 && a.minutes<=a.baseline) && e.result && ['valid','adjusted-recovery'].includes(e.result.status) && validBlocks(e.result.blocks) && validBlocks(e.result.baseSchedule) && ['recommendedRecoveryMinutes','scheduledRecoveryMinutes','recoveryShortfallMinutes'].every(k=>Number.isFinite(e.result[k]) && e.result[k]>=0) && ['errors','notices','inactiveOverrideKeys'].every(k=>Array.isArray(e.result[k]) && e.result[k].every((s:unknown)=>typeof s==='string')));
}

/** Upgrade old task-level Undo operations without changing the accepted plan. */
export function migrateRecoveryHistory(snapshot:PlanningSnapshot):PlanningSnapshot {
  if(snapshot.adjustments?.recoveryHistory!==undefined || !snapshot.adjustments?.history.length)return snapshot;
  const entries:RecoveryChange[]=[];
  let cursor=snapshot;
  for(const group of [...snapshot.adjustments.history].reverse()) {
    const tasks=cursor.tasks.map(t=>{const c=group.find(c=>c.id===t.id && c.afterMinutes===t.durationMinutes && (c.baselineMinutes===undefined || c.baselineMinutes===workingEstimate(t)));return c && !t.fixedStart?{...t,durationMinutes:c.beforeMinutes}:t;});
    const result=calculatePlanningSchedule({...cursor,tasks},cursor.order);
    if(result.status!=='invalid') {cursor={...cursor,tasks,result};entries.unshift(captureRecoveryChange(cursor));}
  }
  return {...snapshot,adjustments:{...snapshot.adjustments,recoveryHistory:entries.slice(-20)}};
}

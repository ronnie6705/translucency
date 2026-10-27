import type { RecoveryChange } from './recovery-history';
import { validRecoveryHistory } from './recovery-history';
import type { Task } from './types';
import { undoTaskShortening, type TaskShortening } from './shorten-planning-tasks';
export const ADJUSTMENT_FLEXIBILITY = { minimal: {label:'Minimal',percent:5,description:'Preserve task allocations as much as possible.'}, moderate:{label:'Moderate',percent:10,description:'Allow modest adjustments.'}, high:{label:'High',percent:20,description:'Allow greater flexibility.'} } as const;
export type AdjustmentFlexibility = keyof typeof ADJUSTMENT_FLEXIBILITY;
export interface TimeAdjustments { flexibility:AdjustmentFlexibility; history:TaskShortening[][]; effectivePercent?:number; recoveryHistory?:RecoveryChange[]; recoveryMetrics?:{recommended:number; scheduled:number} }
export const effectiveFlexibility = (value:TimeAdjustments)=>value.effectivePercent ?? ADJUSTMENT_FLEXIBILITY[value.flexibility].percent;
export const defaultTimeAdjustments = ():TimeAdjustments=>({flexibility:'moderate',history:[]});
export const workingEstimate = (task:Task)=>task.workingEstimateMinutes ?? task.durationMinutes;
export const MAX_ADJUSTMENT_HISTORY = 20;
export function appendAdjustment(history:TaskShortening[][],changes:TaskShortening[]):TaskShortening[][] {
  const next=[...history,changes];
  if(next.length<=MAX_ADJUSTMENT_HISTORY)return next;
  // Coalesce the oldest two operations, preserving the earliest before value per task.
  const merged=new Map(next[0].map(c=>[c.id,{...c}]));
  for(const c of next[1]){const old=merged.get(c.id);merged.set(c.id,old?{...old,afterMinutes:c.afterMinutes}:c);}
  return [[...merged.values()],...next.slice(2)];
}
export function activeAdjustmentSummary(tasks:Task[]) {
  const adjusted=tasks.filter(t=>workingEstimate(t)>t.durationMinutes);
  return {count:adjusted.length,minutes:adjusted.reduce((n,t)=>n+workingEstimate(t)-t.durationMinutes,0)};
}
export function validTimeAdjustments(value:unknown):value is TimeAdjustments {
  const v=value as TimeAdjustments|undefined;
  return !!v && (v.effectivePercent===undefined || Number.isInteger(v.effectivePercent) && v.effectivePercent>=0 && v.effectivePercent<=20) && (v.recoveryHistory===undefined || validRecoveryHistory(v.recoveryHistory)) && (v.recoveryMetrics===undefined || Number.isFinite(v.recoveryMetrics.recommended) && v.recoveryMetrics.recommended>=0 && Number.isFinite(v.recoveryMetrics.scheduled) && v.recoveryMetrics.scheduled>=0) && Object.hasOwn(ADJUSTMENT_FLEXIBILITY,v.flexibility) && Array.isArray(v.history) && v.history.length<=MAX_ADJUSTMENT_HISTORY && v.history.every(group=>Array.isArray(group) && group.length>0 && new Set(group.map(c=>c?.id)).size===group.length && group.every(c=>c && typeof c.id==='string' && Number.isFinite(c.beforeMinutes) && Number.isFinite(c.afterMinutes) && c.afterMinutes>0 && c.beforeMinutes>c.afterMinutes && (c.beforeMode===undefined || ['automatic','custom'].includes(c.beforeMode)) && (c.baselineMinutes===undefined || Number.isFinite(c.baselineMinutes) && c.baselineMinutes>=c.beforeMinutes) && (c.beforeWorkingEstimate===undefined || Number.isFinite(c.beforeWorkingEstimate) && c.beforeWorkingEstimate>=c.beforeMinutes)));
}

/** Explicit duration edits establish a fresh baseline and invalidate only that task's history. */
export function reconcileManualTaskEdits(previous:Task[],next:Task[],adjustments:TimeAdjustments) {
  const invalidated=new Set<string>();
  const tasks=next.map(task=>{
    const old=previous.find(t=>t.id===task.id);
    if(old && (old.durationMinutes!==task.durationMinutes || old.workingEstimateMinutes!==task.workingEstimateMinutes)) {
      invalidated.add(task.id);
      return {...task,workingEstimateMinutes:task.durationMinutes};
    }
    return task;
  });
  return {tasks,adjustments:{...adjustments,recoveryHistory:adjustments.recoveryHistory?.map(entry=>({...entry,fingerprint:invalidated.size || previous.length!==next.length ? '' : entry.fingerprint,allocations:entry.allocations.filter(c=>!invalidated.has(c.id) && next.some(t=>t.id===c.id))})),history:adjustments.history.map(group=>group.filter(c=>!invalidated.has(c.id) && next.some(t=>t.id===c.id))).filter(group=>group.length)}};
}
export function undoLastTimeAdjustment(tasks:Task[],adjustments:TimeAdjustments) {
  const index=adjustments.history.findLastIndex(group=>undoTaskShortening(tasks,group).some((t,i)=>t!==tasks[i]));
  if(index<0)return {tasks,adjustments};
  const restored=undoTaskShortening(tasks,adjustments.history[index]);
  const restoredIds=new Set(restored.filter((t,i)=>t!==tasks[i]).map(t=>t.id));
  return {tasks:restored,adjustments:{...adjustments,history:adjustments.history.map((group,i)=>i===index?group.filter(c=>!restoredIds.has(c.id)):group).filter(group=>group.length)}};
}

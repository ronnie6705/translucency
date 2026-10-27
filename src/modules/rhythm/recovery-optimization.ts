import { calculatePlanningSchedule, type PlanningInputs, type PlanningOrder } from './planning-workspace';
import { planTaskShortening, applyTaskShortening, type ShorteningPlan } from './shorten-planning-tasks';
import { workingEstimate } from './time-adjustments';
import { planRecovery, type SchedulingResult } from './recovery/recovery-planner';
import { createDateInTimeZone } from './utils/timezone';
import type { Task } from './types';

export const PRESET_FLEXIBILITY = { balanced:10, 'deep-focus':5, frequent:20, none:0 } as const;
export interface OptimizedRecovery { tasks:Task[]; result:SchedulingResult; order:PlanningOrder|null }
/** Restore only recovery-owned reductions. A newly fixed commitment retains its accepted allocation. */
export function originalAllocations(tasks:Task[]):Task[] {
  return tasks.map(t=>!t.isBreak && !t.fixedStart && t.allowTimeAdjustments!==false ? {...t,durationMinutes:workingEstimate(t)} : {...t});
}
/** Bounded proportional + boundary-focused candidates, all evaluated by the existing planner. */
export function optimizeRecovery(inputs:PlanningInputs, order:PlanningOrder|null, percent:number, protectedIds:ReadonlySet<string>=new Set()):OptimizedRecovery {
  const tasks=originalAllocations(inputs.tasks);
  const baseline={...inputs,tasks};
  const initial=calculatePlanningSchedule(baseline,order);
  const stableOrder=order ?? (initial.baseSchedule.length ? {tasks,config:inputs.config,blocks:initial.baseSchedule} : null);
  let best:OptimizedRecovery={tasks,result:initial,order:stableOrder};
  if(inputs.preferences.preset==='none' || percent<=0) return best;
  // An invalid base may still contain all required work. Derive its demand before reductions.
  const start=createDateInTimeZone(inputs.config.date,inputs.config.startTime,inputs.config.timezone).getTime();
  const end=createDateInTimeZone(inputs.config.date,inputs.config.endTime,inputs.config.timezone).getTime();
  const objective=initial.recommendedRecoveryMinutes || (initial.baseSchedule.length && Number.isFinite(start) && Number.isFinite(end) ? planRecovery(initial.baseSchedule,inputs.preferences,start,end).recommendedRecoveryMinutes : 0);
  if(!objective || initial.status!=='invalid' && initial.scheduledRecoveryMinutes>=objective)return best;
  const eligible=tasks.map(t=>protectedIds.has(t.id)?{...t,allowTimeAdjustments:false}:t);
  const maximum=planTaskShortening(eligible,inputs.preferences,288,Math.max(0,Math.min(20,Math.floor(percent))));
  const caps=new Map(maximum.changes.map(c=>[c.id,c]));
  const orderedIds=[...new Set((stableOrder?.blocks ?? []).map(b=>b.taskId))].filter(id=>caps.has(id));
  for(const t of tasks)if(caps.has(t.id) && !orderedIds.includes(t.id))orderedIds.push(t.id);
  // Up to three focused distributions: earlier boundaries, later boundaries, and before fixed commitments.
  const beforeFixed=(stableOrder?.blocks ?? []).flatMap((b,i,blocks)=>b.isFixed ? blocks.slice(0,i).map(x=>x.taskId).reverse():[]);
  const priorities=[orderedIds,[...orderedIds].reverse(),[...new Set([...beforeFixed,...orderedIds])].filter(id=>caps.has(id))];
  let bestGain=initial.status==='invalid' ? -1 : Math.min(objective,initial.scheduledRecoveryMinutes), bestMinutes=0, bestProportional=true;
  const seen=new Set<string>();
  for(let minutes=1;minutes<=maximum.minutes;minutes++) {
    const proportional=planTaskShortening(eligible,inputs.preferences,minutes,percent);
    const candidates:ShorteningPlan[]=[proportional,...priorities.map(ids=>{
      let left=minutes;
      const changes=ids.flatMap(id=>{const c=caps.get(id)!;const amount=Math.min(left,c.beforeMinutes-c.afterMinutes);left-=amount;return amount?[{...c,afterMinutes:c.beforeMinutes-amount}]:[];});
      return {changes,minutes,percent};
    })];
    for(let i=0;i<candidates.length;i++) {
      const plan=candidates[i];
      const allocations=applyTaskShortening(tasks,plan);
      const key=allocations.map(t=>t.durationMinutes).join(',');if(seen.has(key))continue;seen.add(key);
      const result=calculatePlanningSchedule({...inputs,tasks:allocations},stableOrder);
      if(result.status==='invalid')continue;
      const gain=Math.min(objective,result.scheduledRecoveryMinutes);
      // Fewer recommended minutes never count as gained recovery. Require actual placement gain.
      if(gain<=0 || gain<=Math.max(0,initial.scheduledRecoveryMinutes) && initial.status!=='invalid')continue;
      if(gain>bestGain || gain===bestGain && (minutes<bestMinutes || minutes===bestMinutes && i===0 && !bestProportional)) {
        bestGain=gain;bestMinutes=minutes;bestProportional=i===0;
        best={tasks:allocations,order:stableOrder,result:{...result,recommendedRecoveryMinutes:objective,recoveryShortfallMinutes:Math.max(0,objective-result.scheduledRecoveryMinutes),status:result.scheduledRecoveryMinutes<objective?'adjusted-recovery':'valid'}};
      }
    }
    if(bestGain>=objective)break;
  }
  return best;
}

import { calculatePlanningSchedule, type PlanningInputs, type PlanningOrder } from './planning-workspace';
import type { SchedulingResult } from './recovery/recovery-planner';
import { applyTaskShortening, planTaskShortening, type ShorteningPlan } from './shorten-planning-tasks';
import { ADJUSTMENT_FLEXIBILITY, type AdjustmentFlexibility } from './time-adjustments';
export interface TimeAdjustmentSuggestion { plan:ShorteningPlan; result:SchedulingResult; order:PlanningOrder; canApply:boolean }
/** Evaluate whole-minute proportional candidates through the existing planner, never a second timeline. */
export function suggestTimeAdjustments(inputs:PlanningInputs,current:SchedulingResult,manual:PlanningOrder|null,flexibility:AdjustmentFlexibility):TimeAdjustmentSuggestion {
  const order=manual ?? {tasks:inputs.tasks,config:inputs.config,blocks:current.baseSchedule};
  const percent=ADJUSTMENT_FLEXIBILITY[flexibility].percent;
  const maximum=planTaskShortening(inputs.tasks,inputs.preferences,1440,percent);
  let best:TimeAdjustmentSuggestion={plan:maximum,result:current,order,canApply:false};
  if(current.status==='invalid' || current.recoveryShortfallMinutes<=0 || !maximum.minutes)return {...best,plan:{changes:[],minutes:0,percent:0}};
  let bestGain=0;
  // A valid same-day schedule has at most 1440 work minutes; percentage caps bound this scan.
  for(let minutes=1;minutes<=maximum.minutes;minutes++) {
    const plan=planTaskShortening(inputs.tasks,inputs.preferences,minutes,percent);
    const result=calculatePlanningSchedule({...inputs,tasks:applyTaskShortening(inputs.tasks,plan)},order);
    if(!best.canApply)best={plan,result,order,canApply:false};
    if(result.status==='invalid')continue;
    const gain=Math.min(current.recommendedRecoveryMinutes,result.scheduledRecoveryMinutes)-current.scheduledRecoveryMinutes;
    if(gain<=0)continue;
    if(result.recoveryShortfallMinutes===0)return {plan,result,order,canApply:true};
    if(gain>bestGain){bestGain=gain;best={plan,result,order,canApply:true};}
  }
  return best;
}

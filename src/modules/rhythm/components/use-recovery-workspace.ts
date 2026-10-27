import { useEffect, useRef, useState } from 'react';
import type { Task, DayConfig, ScheduleBlock } from '../types';
import { calculatePlanningSchedule, type PlanningSnapshot, type PlanningOrder } from '../planning-workspace';
import { defaultBreakPreferences, type BreakPreferences } from '../recovery/recovery-types';
import { defaultTimeAdjustments, effectiveFlexibility, reconcileManualTaskEdits, type TimeAdjustments } from '../time-adjustments';
import { PRESET_FLEXIBILITY, optimizeRecovery } from '../recovery-optimization';
import { captureRecoveryChange, undoRecoveryChange, migrateRecoveryHistory } from '../recovery-history';
import type { SchedulingResult } from '../recovery/recovery-planner';
import { SCHEDULE_MOTION_MS } from '../schedule-motion';

export function useRecoveryWorkspace(options:{tasks:Task[];config:DayConfig;initialPreferences?:BreakPreferences;initialAdjustments?:TimeAdjustments;initialSchedule?:ScheduleBlock[];initialBaseSchedule?:ScheduleBlock[];existing?:boolean;publishTasks(tasks:Task[]):void;publishConfig(config:DayConfig):void}) {
  // Initialization deliberately does not optimize a saved accepted schedule.
  const [workspace,setWorkspace]=useState(()=>{
    const tasks=structuredClone(options.tasks),config={...options.config};
    const preferences=structuredClone(options.initialPreferences ?? (options.existing?{preset:'none' as const,overrides:[]}:defaultBreakPreferences()));
    const adjustments=structuredClone(options.initialAdjustments ?? {...defaultTimeAdjustments(),effectivePercent:PRESET_FLEXIBILITY[preferences.preset]});
    const order:PlanningOrder|null=options.initialBaseSchedule || options.initialSchedule ? {tasks,config,blocks:structuredClone(options.initialBaseSchedule ?? options.initialSchedule!.filter(b=>!b.recovery))}:null;
    let result:SchedulingResult;
    if(options.initialSchedule) {
      const scheduled=options.initialSchedule.filter(b=>b.recovery).reduce((n,b)=>n+(Date.parse(b.end)-Date.parse(b.start))/60000,0);
      const recommended=adjustments.recoveryMetrics?.recommended ?? scheduled;
      result={notices:[],inactiveOverrideKeys:[],blocks:structuredClone(options.initialSchedule),baseSchedule:order!.blocks,status:recommended>scheduled?'adjusted-recovery':'valid',errors:[],recommendedRecoveryMinutes:recommended,scheduledRecoveryMinutes:scheduled,recoveryShortfallMinutes:Math.max(0,recommended-scheduled)};
    } else result=calculatePlanningSchedule({tasks,config,preferences},order);
    const snapshot=migrateRecoveryHistory({tasks,config,preferences,adjustments,order,result});
    return {working:snapshot,accepted:result.status==='invalid'?null:snapshot,pendingRecovery:false};
  });
  const latest=useRef(workspace);latest.current=workspace;
  const active=useRef(false),dirty=useRef(false);
  const [toast,setToast]=useState(''),[undoError,setUndoError]=useState('');
  const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),hideTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const clearToast=()=>{if(toastTimer.current)clearTimeout(toastTimer.current);if(hideTimer.current)clearTimeout(hideTimer.current);setToast('');};
  useEffect(()=>()=>{if(toastTimer.current)clearTimeout(toastTimer.current);if(hideTimer.current)clearTimeout(hideTimer.current);},[]);
  const publish=(next:typeof workspace)=>{latest.current=next;setWorkspace(next);options.publishTasks(next.working.tasks);options.publishConfig(next.working.config);};
  const notify=(next:PlanningSnapshot,previous:PlanningSnapshot|null)=>{
    clearToast();
    const result=next.result;
    const changed=next.tasks.filter(t=>{const old=previous?.tasks.find(x=>x.id===t.id);return old ? old.durationMinutes!==t.durationMinutes : t.durationMinutes!==(t.workingEstimateMinutes ?? t.durationMinutes);}).length;
    const message=next.preferences.preset==='none' ? `Automatic recovery turned off${changed?` · ${changed} task allocations restored`:''}` : `${result.scheduledRecoveryMinutes} minutes of recovery scheduled · ${changed?`${changed} task allocations adjusted`:'Task allocations unchanged.'}${result.recoveryShortfallMinutes?` · ${result.recoveryShortfallMinutes} minutes couldn’t fit.`:''}`;
    toastTimer.current=setTimeout(()=>{setToast(message);hideTimer.current=setTimeout(()=>setToast(''),5000);},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:SCHEDULE_MOTION_MS);
  };
  const commit=(requested:PlanningSnapshot,recoveryOperation=false,protectedIds:ReadonlySet<string>=new Set(),force=false)=>{
    const before=latest.current,previous=before.accepted;
    clearToast();setUndoError('');
    let next=requested;
    if(active.current) {
      const calculated=optimizeRecovery(requested,requested.order,effectiveFlexibility(requested.adjustments!),protectedIds);
      next={...requested,...calculated};
    } else {dirty.current=true;next={...requested,result:calculatePlanningSchedule(requested,requested.order)};}
    if(next.result.status==='invalid') {
      if(next.preferences.preset==='none' && previous?.preferences.preset!=='none')next={...next,result:{...next.result,errors:['Restoring task estimates would exceed your available time. Adjust your schedule or cancel this change.',...next.result.errors]}};
      publish({working:next,accepted:previous,pendingRecovery:before.pendingRecovery || recoveryOperation});return;
    }
    const history=next.adjustments!.recoveryHistory ?? [];
    if((recoveryOperation || before.pendingRecovery) && previous)next={...next,adjustments:{...next.adjustments!,recoveryHistory:[...history,captureRecoveryChange(previous)].slice(-20)}};
    next={...next,adjustments:{...next.adjustments!,recoveryMetrics:{recommended:next.result.recommendedRecoveryMinutes,scheduled:next.result.scheduledRecoveryMinutes}}};
    publish({working:next,accepted:next,pendingRecovery:false});
    if(active.current && (force || !previous || JSON.stringify(previous.result.blocks)!==JSON.stringify(next.result.blocks) || JSON.stringify(previous.preferences)!==JSON.stringify(next.preferences) || effectiveFlexibility(previous.adjustments!)!==effectiveFlexibility(next.adjustments!)))notify(next,previous);
  };
  const stableOrder=()=>{const s=latest.current.accepted ?? latest.current.working;return s.order ?? {tasks:s.tasks,config:s.config,blocks:s.result.baseSchedule};};
  const changeTasks=(tasks:Task[])=>{
    const s=latest.current.working;
    const edited=new Set(tasks.filter(t=>{const old=s.tasks.find(x=>x.id===t.id);return old && (old.durationMinutes!==t.durationMinutes || old.workingEstimateMinutes!==t.workingEstimateMinutes);}).map(t=>t.id));
    const changed=reconcileManualTaskEdits(s.tasks,tasks,s.adjustments!);
    commit({...s,...changed,order:active.current?stableOrder():null},false,edited);
  };
  const changeConfig=(config:DayConfig,regenerate=false)=>{const s=latest.current.working;if(!regenerate && JSON.stringify(s.config)===JSON.stringify(config))return;commit({...s,config,order:regenerate?null:stableOrder()});};
  const changePreferences=(preferences:BreakPreferences)=>{const s=latest.current.working;if(JSON.stringify(preferences)===JSON.stringify(s.preferences))return;commit({...s,preferences,order:stableOrder(),adjustments:{...s.adjustments!,effectivePercent:preferences.preset!==s.preferences.preset?PRESET_FLEXIBILITY[preferences.preset]:effectiveFlexibility(s.adjustments!)}},true);};
  const changeFlexibility=(percent:number)=>{const s=latest.current.working;if(s.preferences.preset==='none' || percent===effectiveFlexibility(s.adjustments!))return;commit({...s,order:stableOrder(),adjustments:{...s.adjustments!,effectivePercent:percent}},true);};
  const activate=()=>{if(active.current)return;active.current=true;if(!options.existing || dirty.current)commit(latest.current.working,false,new Set(),true);};
  const undo=()=>{clearToast();const s=latest.current;if(s.working.result.status==='invalid')return;const outcome=undoRecoveryChange(s.working);if(outcome.error){setUndoError(outcome.error);return;}if(outcome.snapshot===s.working)return;setUndoError('');publish({working:outcome.snapshot,accepted:outcome.snapshot,pendingRecovery:false});notify(outcome.snapshot,s.accepted);};
  const cancel=()=>{clearToast();const s=latest.current;if(s.accepted)publish({working:structuredClone(s.accepted),accepted:s.accepted,pendingRecovery:false});};
  const reorder=(blocks:ScheduleBlock[])=>commit({...latest.current.working,order:{tasks:[],config:latest.current.working.config,blocks}});
  return {...workspace,toast,undoError,clearToast,changeTasks,changeConfig,changePreferences,changeFlexibility,activate,undo,cancel,reorder};
}

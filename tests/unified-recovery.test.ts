import {suggestTimeAdjustments} from '../src/modules/rhythm/suggest-time-adjustments';
import {planTaskShortening,applyTaskShortening} from '../src/modules/rhythm/shorten-planning-tasks';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Task,DayConfig} from '../src/modules/rhythm/types';
import {optimizeRecovery} from '../src/modules/rhythm/recovery-optimization';
import {calculatePlanningSchedule,type PlanningSnapshot} from '../src/modules/rhythm/planning-workspace';
import {defaultTimeAdjustments,reconcileManualTaskEdits,validTimeAdjustments,effectiveFlexibility} from '../src/modules/rhythm/time-adjustments';
import {captureRecoveryChange,undoRecoveryChange,migrateRecoveryHistory} from '../src/modules/rhythm/recovery-history';
const config:DayConfig={date:'2026-10-23',startTime:'09:00',endTime:'17:00',timezone:'UTC',chronotype:'Bear'};
const tasks=Array.from({length:8},(_,i):Task=>({id:String(i),name:`Task ${i}`,durationMinutes:60,energyRequired:5,priority:2}));
const input={tasks,config,preferences:{preset:'balanced' as const,overrides:[]}};
const snapshot=():PlanningSnapshot=>({...input,...optimizeRecovery(input,null,10),adjustments:{...defaultTimeAdjustments(),effectivePercent:10,recoveryHistory:[]}});
test('unified presets do not compound; None restores estimates; round trips are deterministic',()=>{
 const a=optimizeRecovery(input,null,10);assert.equal(a.result.status,'valid');assert.equal(a.result.scheduledRecoveryMinutes,35);assert.equal(a.tasks.reduce((n,t)=>n+t.durationMinutes,0),445);
 const off=optimizeRecovery({...input,tasks:a.tasks,preferences:{preset:'none',overrides:[]}},a.order,0);assert.deepEqual(off.tasks.map(t=>t.durationMinutes),tasks.map(t=>t.durationMinutes));assert.equal(off.result.scheduledRecoveryMinutes,0);
 const back=optimizeRecovery({...input,tasks:off.tasks},a.order,10);assert.deepEqual(back.tasks,a.tasks);assert.deepEqual(back.result.blocks,a.result.blocks);
 assert.deepEqual(optimizeRecovery({...input,tasks:a.tasks},a.order,10),a);
});
test('extending the day restores unnecessary reductions',()=>{
 const a=optimizeRecovery(input,null,10);
 const extended=optimizeRecovery({...input,tasks:a.tasks,config:{...config,endTime:'18:00'}},a.order,10);
 assert.equal(extended.result.status,'valid');assert.ok(extended.tasks.every(t=>t.durationMinutes===60));
});
test('an explicit 80 minute estimate is protected for its transaction',()=>{
 const a=snapshot();const changed=reconcileManualTaskEdits(a.tasks,a.tasks.map((t,i)=>i? t:{...t,durationMinutes:80}),a.adjustments!);
 const next=optimizeRecovery({...input,tasks:changed.tasks},a.order,20,new Set(['0']));
 assert.equal(next.tasks[0].workingEstimateMinutes,80);assert.equal(next.tasks[0].durationMinutes,80);
 const later=optimizeRecovery({...input,config:{...config,endTime:'17:30'},tasks:next.tasks.map((t,i)=>i?{...t,durationMinutes:60,allowTimeAdjustments:false}:t)},a.order,20);assert.ok(later.tasks[0].durationMinutes<80);
});
test('None restoration can be invalid without dropping protected work',()=>{
 const a=snapshot();const withBreak={...input,tasks:[...a.tasks,{id:'rest',name:'Rest',durationMinutes:15,energyRequired:1 as const,priority:2 as const,isBreak:true,plannedBreakAfterTaskId:'2'}]};
 const recovered=optimizeRecovery(withBreak,a.order,20);assert.notEqual(recovered.result.status,'invalid');
 const off=optimizeRecovery({...withBreak,tasks:recovered.tasks,preferences:{preset:'none',overrides:[]}},recovered.order,0);
 assert.equal(off.result.status,'invalid');assert.equal(off.tasks.find(t=>t.id==='rest')!.durationMinutes,15);
});
test('fixed, excluded, manual breaks and one-minute caps remain protected',()=>{
 const a=optimizeRecovery({...input,tasks:tasks.map((t,i)=>i===0?{...t,allowTimeAdjustments:false}:i===1?{...t,fixedStart:'10:00'}:t)},null,7);
 assert.equal(a.tasks[0].durationMinutes,60);assert.equal(a.tasks[1].durationMinutes,60);assert.ok(a.tasks.every(t=>60-t.durationMinutes<=4));
 const zero=optimizeRecovery(input,null,0);assert.ok(zero.tasks.every(t=>t.durationMinutes===60));
});
test('Undo restores exact preceding placement and survives serialization',()=>{
 const a=snapshot(),entry=captureRecoveryChange(a);
 const next:PlanningSnapshot={...a,preferences:{preset:'frequent',overrides:[]},...optimizeRecovery({...a,preferences:{preset:'frequent',overrides:[]}},a.order,20),adjustments:{...a.adjustments!,effectivePercent:20,recoveryHistory:[entry]}};
 assert.equal(validTimeAdjustments(JSON.parse(JSON.stringify(next.adjustments))),true);
 const undone=undoRecoveryChange(JSON.parse(JSON.stringify(next)));assert.equal(undone.error,undefined);assert.deepEqual(undone.snapshot.result.blocks,a.result.blocks);assert.deepEqual(undone.snapshot.tasks.map(t=>t.durationMinutes),a.tasks.map(t=>t.durationMinutes));assert.equal(effectiveFlexibility(undone.snapshot.adjustments!),10);
});
test('Undo preserves later explicit task edits and does not consume failed entries',()=>{
 const a=snapshot(),entry=captureRecoveryChange(a);
 let current:PlanningSnapshot={...a,adjustments:{...a.adjustments!,recoveryHistory:[entry]}};
 const edited=reconcileManualTaskEdits(current.tasks,current.tasks.map((t,i)=>i? t:{...t,durationMinutes:80}),current.adjustments!);
 current={...current,...edited,config:{...config,endTime:'18:00'}};
 const undo=undoRecoveryChange(current);assert.equal(undo.error,undefined);assert.equal(undo.snapshot.tasks[0].durationMinutes,80);
 const failed=undoRecoveryChange({...current,config:{...config,endTime:'10:00'}});assert.ok(failed.error);assert.equal(failed.snapshot.adjustments!.recoveryHistory!.length,1);
});
test('a smaller recommendation cannot count as recovered time',()=>{
 const base=calculatePlanningSchedule(input);const result=optimizeRecovery(input,null,5).result;
 assert.equal(result.recommendedRecoveryMinutes,base.recommendedRecoveryMinutes);assert.equal(result.recoveryShortfallMinutes,base.recommendedRecoveryMinutes-result.scheduledRecoveryMinutes);
});

test('placement-aware alternatives retain recovery with less reduction around fixed lunch',()=>{
 const durations=[120,60,60,90,60,30];
 const work=durations.map((durationMinutes,i)=>({...tasks[i],durationMinutes}));
 const constrained={...input,tasks:[...work,{id:'lunch',name:'Lunch',durationMinutes:60,energyRequired:1 as const,priority:2 as const,isBreak:true,fixedStart:'12:00'}]};
 const current=calculatePlanningSchedule(constrained),proportional=suggestTimeAdjustments(constrained,current,null,'moderate'),optimized=optimizeRecovery(constrained,null,10);
 assert.equal(optimized.result.scheduledRecoveryMinutes,proportional.result.scheduledRecoveryMinutes);
 assert.equal(optimized.tasks.reduce((n,t)=>n+(t.workingEstimateMinutes??t.durationMinutes)-t.durationMinutes,0),34);assert.equal(proportional.plan.minutes,35);
 assert.equal(optimized.tasks.at(-1)!.durationMinutes,60);
 assert.equal(optimized.result.blocks.find(b=>b.taskId==='lunch')!.start,'2026-10-23T12:00:00.000Z');
});
test('legacy named flexibility and adjustment Undo migrate without replacing accepted schedules',()=>{
 const plan=planTaskShortening(tasks,input.preferences,20,5),allocated=applyTaskShortening(tasks,plan);
 const legacy:PlanningSnapshot={...input,tasks:allocated,order:null,result:calculatePlanningSchedule({...input,tasks:allocated}),adjustments:{flexibility:'minimal',history:[plan.changes]}};
 const migrated=migrateRecoveryHistory(legacy);assert.equal(effectiveFlexibility(migrated.adjustments!),5);assert.deepEqual(migrated.result,legacy.result);assert.deepEqual(migrated.tasks,legacy.tasks);
 const restored=undoRecoveryChange(migrated);assert.ok(restored.snapshot.tasks.every(t=>t.durationMinutes===60));
});

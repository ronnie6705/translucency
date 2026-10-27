import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Task,DayConfig} from '../src/modules/rhythm/types';
import {calculatePlanningSchedule} from '../src/modules/rhythm/planning-workspace';
import {defaultBreakPreferences} from '../src/modules/rhythm/recovery/recovery-types';
import {planTaskShortening,applyTaskShortening} from '../src/modules/rhythm/shorten-planning-tasks';
import {suggestTimeAdjustments} from '../src/modules/rhythm/suggest-time-adjustments';
import {appendAdjustment,reconcileManualTaskEdits,undoLastTimeAdjustment,activeAdjustmentSummary,validTimeAdjustments,type TimeAdjustments} from '../src/modules/rhythm/time-adjustments';
import {validateLibrary,emptyLibrary} from '../src/modules/rhythm/library';
const config:DayConfig={date:'2026-10-23',startTime:'09:00',endTime:'17:00',timezone:'UTC',chronotype:'Bear'};
const task=(id:string,durationMinutes=60,extra:Partial<Task>={}):Task=>({id,name:id,durationMinutes,energyRequired:5,priority:2,...extra});
const prefs=defaultBreakPreferences();
const full=()=>({tasks:Array.from({length:8},(_,i)=>task(String(i))),config,preferences:prefs});

test('percentage caps round down at one-minute precision against the original baseline',()=>{
 for(const [percent,expected] of [[5,[1,3,4,6]],[10,[3,6,9,12]],[20,[6,12,18,24]]] as const){
  const tasks=[30,60,90,120].map((n,i)=>task(String(i),n));const plan=planTaskShortening(tasks,prefs,1000,percent);
  assert.deepEqual(plan.changes.map(c=>c.beforeMinutes-c.afterMinutes),expected);
  const next=applyTaskShortening(tasks,plan);assert.equal(planTaskShortening(next,prefs,1000,percent).minutes,0);
 }
});
test('preview is pure, Moderate fully fits, Minimal applies only useful partial recovery',()=>{
 const input=full(),before=JSON.stringify(input),current=calculatePlanningSchedule(input);
 const minimal=suggestTimeAdjustments(input,current,null,'minimal');
 assert.equal(minimal.canApply,true);assert.equal(minimal.plan.minutes,20);assert.equal(minimal.result.scheduledRecoveryMinutes,20);assert.ok(minimal.result.recoveryShortfallMinutes>0);
 const moderate=suggestTimeAdjustments(input,current,null,'moderate');
 assert.equal(moderate.canApply,true);assert.equal(moderate.result.recoveryShortfallMinutes,0);assert.equal(moderate.plan.minutes,35);
 const high=suggestTimeAdjustments(input,current,null,'high');assert.equal(high.plan.minutes,35);
 assert.equal(JSON.stringify(input),before);assert.deepEqual(suggestTimeAdjustments(input,current,null,'high'),high);
});
test('all candidate allocations conserve protected fixed tasks, breaks and eligibility',()=>{
 const tasks=[task('a',60,{allowTimeAdjustments:false}),task('b',60,{fixedStart:'12:00'}),task('rest',30,{isBreak:true}),task('c',60,{durationMode:'custom'})];
 const p=planTaskShortening(tasks,prefs,100,20);assert.deepEqual(p.changes.map(c=>c.id),['c']);assert.equal(p.minutes,12);
 assert.deepEqual(applyTaskShortening(tasks,p).slice(0,3),tasks.slice(0,3));
});
test('repeated suggestions use remaining original-estimate capacity; lower caps never expand allocations',()=>{
 let input=full();let result=calculatePlanningSchedule(input);
 const first=suggestTimeAdjustments(input,result,null,'minimal');input={...input,tasks:applyTaskShortening(input.tasks,first.plan)};
 result=calculatePlanningSchedule(input,first.order);
 const second=suggestTimeAdjustments(input,result,first.order,'minimal');assert.equal(second.canApply,false);
 const high=suggestTimeAdjustments(input,result,first.order,'high');assert.equal(high.canApply,true);
 const final=applyTaskShortening(input.tasks,high.plan);assert.ok(final.every(t=>60-t.durationMinutes<=12));
 const noMore=planTaskShortening(final,prefs,100,5);assert.equal(noMore.minutes,0);
});
test('manual estimate change resets only that baseline and cannot be undone by prior history',()=>{
 const original=[task('a'),task('b')],plan=planTaskShortening(original,prefs,12,10),shortened=applyTaskShortening(original,plan);
 const state:TimeAdjustments={flexibility:'moderate',history:[plan.changes]};
 const manual=reconcileManualTaskEdits(shortened,shortened.map(t=>t.id==='a'?{...t,durationMinutes:80}:t),state);
 assert.equal(manual.tasks[0].workingEstimateMinutes,80);assert.equal(manual.tasks[0].durationMinutes,80);assert.equal(manual.tasks[1].durationMinutes,54);
 assert.deepEqual(manual.adjustments.history[0].map(c=>c.id),['b']);
 const undone=undoLastTimeAdjustment(manual.tasks,manual.adjustments);assert.deepEqual(undone.tasks.map(t=>t.durationMinutes),[80,60]);
 const next=planTaskShortening(manual.tasks,prefs,100,10);assert.equal(next.changes[0].beforeMinutes-next.changes[0].afterMinutes,8);
});
test('explicitly accepting the shortened allocation as an estimate invalidates only that task',()=>{
 const original=[task('a'),task('b')],plan=planTaskShortening(original,prefs,12,10),shortened=applyTaskShortening(original,plan);
 const state:TimeAdjustments={flexibility:'moderate',history:[plan.changes]};
 const manual=reconcileManualTaskEdits(shortened,shortened.map(t=>t.id==='a'?{...t,workingEstimateMinutes:54}:t),state);
 assert.deepEqual(manual.adjustments.history[0].map(c=>c.id),['b']);assert.equal(activeAdjustmentSummary(manual.tasks).minutes,6);
});
test('bounded history coalesces older task-level entries and remains completely reversible',()=>{
 const original=[task('a',120),task('b',120)];let tasks=original;let history:TimeAdjustments['history']=[];
 for(let i=0;i<24;i++){const p=planTaskShortening(tasks,prefs,1,20);tasks=applyTaskShortening(tasks,p);history=appendAdjustment(history,p.changes);}
 assert.equal(history.length,20);let state:TimeAdjustments={flexibility:'high',history};
 while(state.history.length){const undo=undoLastTimeAdjustment(tasks,state);assert.notEqual(undo.adjustments,state);tasks=undo.tasks;state=undo.adjustments;}
 assert.deepEqual(tasks,original);
});
test('Undo retains portions temporarily protected by fixed commitments',()=>{
 const original=[task('a'),task('b')],p=planTaskShortening(original,prefs,12,10);
 const tasks=applyTaskShortening(original,p).map(t=>t.id==='a'?{...t,fixedStart:'10:00'}:t);
 const state:TimeAdjustments={flexibility:'moderate',history:[p.changes]};
 const first=undoLastTimeAdjustment(tasks,state);assert.deepEqual(first.tasks.map(t=>t.durationMinutes),[54,60]);assert.equal(first.adjustments.history[0][0].id,'a');
 const second=undoLastTimeAdjustment(first.tasks.map(t=>({...t,fixedStart:undefined})),first.adjustments);assert.equal(second.tasks[0].durationMinutes,60);
});
test('history, baselines, eligibility, flexibility, allocations survive library round-trip',()=>{
 const input=full(),current=calculatePlanningSchedule(input),suggestion=suggestTimeAdjustments(input,current,null,'moderate');
 const tasks=applyTaskShortening(input.tasks,suggestion.plan).map((t,i)=>i? t : {...t,allowTimeAdjustments:false});
 const state:TimeAdjustments={flexibility:'moderate',history:[suggestion.plan.changes]};
 const saved={id:'new',name:'Adjusted',createdAt:'2026-10-23T00:00:00Z',tasks,dayConfig:config,breakPreferences:prefs,timeAdjustments:state,schedule:suggestion.result.blocks,recoveryBaseSchedule:suggestion.result.baseSchedule};
 const restored=validateLibrary(JSON.parse(JSON.stringify({...emptyLibrary(),timeblocks:[saved]}))).timeblocks[0];
 assert.equal(restored.tasks[0].workingEstimateMinutes,60);assert.equal(restored.tasks[0].allowTimeAdjustments,false);
 assert.deepEqual(undoLastTimeAdjustment(restored.tasks,restored.timeAdjustments!).tasks.map(t=>t.durationMinutes),input.tasks.map(t=>t.durationMinutes));
 assert.equal(validTimeAdjustments({...state,flexibility:'unbounded'}),false);
 assert.throws(()=>validateLibrary({...emptyLibrary(),timeblocks:[{...saved,timeAdjustments:{...state,history:[[{id:'a',beforeMinutes:10,afterMinutes:20}]]}}]}));
});
test('no-auto, satisfied schedules and ineligible workloads never offer applicable suggestions',()=>{
 for(const input of [{...full(),preferences:{preset:'none' as const,overrides:[]}},{...full(),tasks:[task('short',30)]},{...full(),tasks:full().tasks.map(t=>({...t,allowTimeAdjustments:false}))}]){
  const current=calculatePlanningSchedule(input);assert.equal(suggestTimeAdjustments(input,current,null,'high').canApply,false);
 }
});

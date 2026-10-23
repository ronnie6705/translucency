import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {DayConfig,Task,ScheduleBlock} from '../src/modules/rhythm/types';
import {generateScheduleResult,planRecovery} from '../src/modules/rhythm/recovery/recovery-planner';
import {defaultBreakPreferences,setRecoveryOverride,type BreakPreferences} from '../src/modules/rhythm/recovery/recovery-types';
import {recoveryLoad} from '../src/modules/rhythm/recovery/recovery-presets';
import {validateSchedule} from '../src/modules/rhythm/schedule-validation';
import {reorderSchedule} from '../src/modules/rhythm/reorder-schedule';
import {blockMinutes} from '../src/modules/rhythm/schedule-placement';
import {scheduleSummary} from '../src/modules/rhythm/workload';
import {validateLibrary,emptyLibrary} from '../src/modules/rhythm/library';
import {serializeICS} from '../src/modules/rhythm/ics';
import {completeTimerTask,validLiveTimer,type LiveTimer} from '../src/modules/rhythm/live-timer';
import {adjustTimerTimeWindow} from '../src/modules/rhythm/update-live-time-window';
import {completeLiveTask} from '../src/modules/rhythm/complete-live-task';
import {createTimeblockRun,launchTimeblockRun} from '../src/modules/rhythm/timeblock-run';
const config:DayConfig={date:'2026-10-23',startTime:'09:00',endTime:'17:00',timezone:'UTC',chronotype:'Bear'};
const task=(id:string,durationMinutes=60,energyRequired:Task['energyRequired']=5,extra:Partial<Task>={}):Task=>({id,name:id,durationMinutes,energyRequired,priority:2,...extra});
const stamp=(minutes:number)=>new Date(Date.parse('2026-10-23T09:00:00Z')+minutes*60000).toISOString();
const base=(tasks:Task[])=>{let cursor=0;return tasks.map(t=>{const start=t.fixedStart?Date.parse(`2026-10-23T${t.fixedStart}:00Z`):Date.parse(stamp(cursor));cursor=(start-Date.parse(stamp(0)))/60000+t.durationMinutes;return {id:t.id,taskId:t.id,taskName:t.name,isBreak:!!t.isBreak,isFixed:!!t.fixedStart,energyRequired:t.energyRequired,start:new Date(start).toISOString(),end:stamp(cursor)};});};
const prefs=defaultBreakPreferences();
const run=(tasks:Task[],preferences=prefs,day=config)=>generateScheduleResult(tasks,day,{preferences,baseSchedule:base(tasks)});
const recovery=(blocks:ScheduleBlock[])=>blocks.filter(b=>b.recovery);
const workIds=(blocks:ScheduleBlock[])=>blocks.filter(b=>!b.isBreak).map(b=>b.taskId);

test('energy weighting is deterministic, neutral for missing energy, and preset-sensitive',()=>{
 assert.ok(Math.abs(recoveryLoad(45,5,1)-63)<1e-9);assert.equal(recoveryLoad(20,3,1),20);
 assert.equal(recoveryLoad(50,1,1),30);assert.equal(recoveryLoad(50,undefined,1),50);
 assert.equal(recoveryLoad(50,4,0.8),48);
});
test('a short task and final demanding task never get a trailing break',()=>{
 for(const tasks of [[task('a',20)],[task('a',60)]]) assert.equal(recovery(run(tasks).blocks).length,0);
});
test('energy load and low-energy continuous work both produce recovery',()=>{
 assert.equal(recovery(run([task('a'),task('b')]).blocks).length,1);
 const low=run(Array.from({length:5},(_,i)=>task(`${i}`,30,1)));
 assert.ok(recovery(low.blocks).length>0);assert.equal(low.status,'valid');
});
test('natural boundary grace defers demanding 55 minutes through the next ten-minute task',()=>{
 const r=run([task('a',55),task('b',10),task('c',30)]);
 assert.deepEqual(r.blocks.map(b=>b.taskName),['a','b','Recovery Break','c']);
});
test('upcoming lunch in twelve minutes satisfies recovery; short gaps retain load, meaningful gaps reset',()=>{
 const lunch=task('lunch',60,1,{isBreak:true});
 const r=run([task('a',55),task('b',12),lunch,task('c',30)]);
 assert.equal(recovery(r.blocks).length,0);
 const tasks=[task('a',55),task('b',30)];
 for(const gap of [3,5]) {
  const b=base(tasks);b[1]={...b[1],start:stamp(55+gap),end:stamp(85+gap)};
  const r=generateScheduleResult(tasks,config,{preferences:prefs,baseSchedule:b});
  assert.equal(recovery(r.blocks).length,gap===5?0:1);
 }
});
test('planned breaks reset counters and are never changed by preset switches',()=>{
 const tasks=[task('a',60),task('lunch',30,1,{isBreak:true,fixedStart:'10:00'}),task('b',60)];
 for(const preset of ['balanced','deep-focus','frequent','none'] as const){
  const r=run(tasks,{preset,overrides:[]});assert.equal(r.status,'valid');
  assert.deepEqual(r.blocks.find(b=>b.taskId==='lunch'),{...base(tasks)[1],...(preset==='none'?{}:{workOffsetMinutes:0})});
  assert.equal(recovery(r.blocks).length,0);
 }
});
test('long tasks split through stable work offsets, conserving all duration across presets',()=>{
 const tasks=[task('long',180),task('last',30)];
 for(const preset of ['balanced','deep-focus','frequent','none'] as const){
  const r=run(tasks,{preset,overrides:[]});assert.equal(r.status,'valid');assert.equal(validateSchedule(tasks,config,r.blocks).valid,true);
  assert.equal(r.blocks.filter(b=>b.taskId==='long').reduce((n,b)=>n+blockMinutes(b),0),180);
  assert.equal(recovery(r.blocks).length>0,preset!=='none');
 }
});
test('long recovery duration is selected by accumulated demanding load',()=>{
 const r=run([task('a',85),task('b',30)]);
 assert.equal(blockMinutes(recovery(r.blocks)[0]),10);
});
test('shortening then omission preserves work and summaries reflect final actual recovery',()=>{
 const tasks=[task('a',85),task('b',30)];
 const short=run(tasks,prefs,{...config,endTime:'11:00'});
 assert.equal(short.status,'adjusted-recovery');assert.equal(scheduleSummary(short.blocks).recoveryBreaks,5);
 const omitted=run(tasks,prefs,{...config,endTime:'10:55'});
 assert.equal(omitted.status,'adjusted-recovery');assert.equal(scheduleSummary(omitted.blocks).recoveryBreaks,0);
 assert.equal(validateSchedule(tasks,{...config,endTime:'10:55'},omitted.blocks).valid,true);
});
test('protected durations block acceptance instead of shrinking work',()=>{
 const tasks=[task('a',60),task('b',30)];const r=run(tasks);
 const p=setRecoveryOverride(prefs,recovery(r.blocks)[0].recovery!.anchor,{durationMinutes:30});
 const conflict=run(tasks,p,{...config,endTime:'10:35'});
 assert.equal(conflict.status,'invalid');assert.equal(blockMinutes(recovery(conflict.blocks)[0]),30);
 assert.equal(conflict.blocks.filter(b=>!b.isBreak).reduce((n,b)=>n+blockMinutes(b),0),90);
});
test('duration and removal overrides survive repeated switching, restore, and invalid anchors remain inactive',()=>{
 const tasks=[task('a'),task('b'),task('c')];const original=run(tasks);
 const anchor=recovery(original.blocks)[0].recovery!.anchor;
 const p=setRecoveryOverride(prefs,anchor,{durationMinutes:15});
 for(let i=0;i<5;i++)for(const preset of ['frequent','none','deep-focus','balanced'] as const){
  const r=run(tasks,{...p,preset});assert.equal(r.status,'valid');assert.equal(new Set(r.blocks.map(b=>b.id)).size,r.blocks.length);
  const found=recovery(r.blocks).find(b=>b.recovery!.anchor.taskId==='a');
  if(preset==='none')assert.equal(found,undefined);else assert.equal(blockMinutes(found!),15);
 }
 const suppressed=run(tasks,setRecoveryOverride(prefs,anchor,{removed:true}));assert.ok(!recovery(suppressed.blocks).some(b=>b.recovery!.anchor.taskId==='a'));
 const restored=run(tasks,setRecoveryOverride(p,anchor));assert.equal(blockMinutes(recovery(restored.blocks)[0]),5);
 const inactive=run(tasks.slice(1),p);assert.equal(inactive.inactiveOverrideKeys.length,1);
});
test('reordering retains manual order and moves overrides only with the original task boundary',()=>{
 const tasks=[task('a'),task('b'),task('c')];const p=setRecoveryOverride(prefs,{taskId:'a',offsetMinutes:60},{durationMinutes:15});
 const ordered=reorderSchedule(base(tasks),tasks,config,2,0);assert.equal(ordered.error,undefined);
 const r=generateScheduleResult(tasks,config,{preferences:p,baseSchedule:ordered.blocks});
 assert.deepEqual(workIds(r.blocks),['c','a','b']);assert.equal(blockMinutes(recovery(r.blocks).find(b=>b.recovery!.anchor.taskId==='a')!),15);
});
test('LinkedIn/lunch fragmented capacity fits with full task coverage across all chronotypes',()=>{
 const tasks=[task('LinkedIn',30,3,{fixedStart:'12:00'}),task('Lunch',60,1,{isBreak:true,fixedStart:'13:00'}),task('a',45),task('b',45)];
 for(const chronotype of ['Lion','Bear','Wolf','Dolphin'] as const) for(const preset of ['balanced','deep-focus','frequent','none'] as const){
  const day={...config,startTime:'12:00',endTime:'15:00',chronotype};
  const r=generateScheduleResult(tasks,day,{preferences:{preset,overrides:[]}});
  assert.notEqual(r.status,'invalid');assert.equal(validateSchedule(tasks,day,r.blocks).valid,true);
 }
});
test('saved preferences, suppression, schedules, timers, and ICS round-trip without library tasks for recovery',()=>{
 const tasks=[task('a'),task('b'),task('c')];const p=setRecoveryOverride(prefs,{taskId:'a',offsetMinutes:60},{removed:true});const r=run(tasks,p);
 const saved={id:'p',name:'Day',createdAt:stamp(0),tasks,dayConfig:config,schedule:r.blocks,breakPreferences:p,recoveryBaseSchedule:r.baseSchedule};
 const timer:LiveTimer={id:'p',name:'Day',timezone:'UTC',blocks:r.blocks,breakPreferences:p};
 const payload={...emptyLibrary(),timeblocks:[saved],liveTimer:timer};
 assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(payload))),payload);
 const ics=serializeICS(r.blocks);assert.equal((ics.match(/BEGIN:VEVENT/g)??[]).length,r.blocks.length);assert.ok(ics.includes('SUMMARY:Recovery Break'));
 const legacy={...saved};delete (legacy as Partial<typeof saved>).breakPreferences;delete (legacy as Partial<typeof saved>).recoveryBaseSchedule;legacy.schedule=base(tasks);
 assert.deepEqual(validateLibrary({...emptyLibrary(),timeblocks:[legacy]}).timeblocks[0],legacy);
});
test('skipping/completing a recovery break records history, preserves elapsed work, and never marks library tasks complete',()=>{
 const tasks=[task('a'),task('b'),task('c')];const r=run(tasks);
 const timer:LiveTimer={id:'p',name:'Day',timezone:'UTC',blocks:r.blocks,breakPreferences:prefs,startedAt:stamp(0),endsAt:stamp(240)};
 const rest=recovery(r.blocks)[0];const now=Date.parse(rest.start)+60000;
 for(const outcome of ['skipped','completed'] as const){
  const run=createTimeblockRun(timer,'Bear');const library=launchTimeblockRun({...emptyLibrary(),timeblocks:[{id:'p',name:'Day',createdAt:stamp(0),dayConfig:config,tasks,schedule:r.blocks,breakPreferences:prefs}]},timer,run);
  const next=completeLiveTask(library,'p',rest.id,now,outcome);
  assert.equal(validLiveTimer(next.liveTimer),true);assert.deepEqual(next.timeblocks[0].tasks,tasks);
  assert.ok(next.runs![0].events.some(e=>e.type===`break-${outcome}`));
  assert.ok(next.liveTimer!.resolvedBreakIds!.includes(rest.id));assert.equal(next.liveTimer!.blocks.filter(b=>b.id===rest.id && Date.parse(b.end)>now).length,0);
  assert.deepEqual(next.liveTimer!.blocks.find(b=>b.taskId==='a'),r.blocks[0]);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(next))),JSON.parse(JSON.stringify(next)));
  assert.equal(completeTimerTask(next.liveTimer!,rest.id,now,outcome),next.liveTimer);
 }
});
test('live time-window editing preserves active block and fixed/planned commitments',()=>{
 const tasks=[task('a'),task('lunch',30,1,{isBreak:true,fixedStart:'11:00'}),task('b'),task('c')];const r=run(tasks);
 const timer:LiveTimer={id:'p',name:'Day',timezone:'UTC',blocks:r.blocks,breakPreferences:prefs,startedAt:stamp(0),endsAt:stamp(360)};
 for(const end of [stamp(300),stamp(420)]){
  const changed=adjustTimerTimeWindow(timer,end,Date.parse(stamp(20)));
  assert.equal(validLiveTimer(changed),true);assert.deepEqual(changed.blocks[0],timer.blocks[0]);
  assert.deepEqual(changed.blocks.find(b=>b.taskId==='lunch'),timer.blocks.find(b=>b.taskId==='lunch'));
  assert.ok(changed.blocks.every(b=>Date.parse(b.end)<=Date.parse(end)));
 }
 assert.throws(()=>adjustTimerTimeWindow(timer,stamp(30),Date.parse(stamp(20))),/active/);
});
test('arbitrary fixed-heavy workloads conserve work and never duplicate recovery IDs',()=>{
 for(let seed=0;seed<25;seed++)for(const preset of ['balanced','deep-focus','frequent','none'] as const){
  const tasks=[task('lunch',60,1,{isBreak:true,fixedStart:'12:00'}),...Array.from({length:5},(_,i)=>task(`t${i}`,25+(seed+i)%5*10,(1+(seed+i)%5) as Task['energyRequired']))];
  const r=generateScheduleResult(tasks,config,{preferences:{preset,overrides:[]}});
  assert.notEqual(r.status,'invalid',`${seed} ${preset}`);assert.equal(validateSchedule(tasks,config,r.blocks).valid,true);
  assert.equal(new Set(r.blocks.map(b=>b.id)).size,r.blocks.length);
 }
});

test('explicit saved task edits keep preferences and recovery snapshots; library renames preserve accepted times', async()=>{
 const {updateRecoveryPlan}=await import('../src/modules/rhythm/recovery/recovery-saved-plan');
 const tasks=[task('a'),task('b'),task('c')];const r=run(tasks);
 const p=setRecoveryOverride(prefs,recovery(r.blocks)[0].recovery!.anchor,{durationMinutes:15});const accepted=run(tasks,p);
 const plan={id:'p',name:'Day',createdAt:stamp(0),tasks,dayConfig:config,schedule:accepted.blocks,breakPreferences:p,recoveryBaseSchedule:accepted.baseSchedule};
 const renamed=updateRecoveryPlan(plan,tasks.map(t=>({...t,name:`New ${t.name}`})));
 assert.deepEqual(renamed.schedule!.map(b=>[b.start,b.end]),plan.schedule.map(b=>[b.start,b.end]));
 const edited=updateRecoveryPlan(plan,tasks.map(t=>t.id==='a'?{...t,durationMinutes:75}:t));
 assert.equal(validateSchedule(edited.tasks,config,edited.schedule!).valid,true);
 assert.equal(blockMinutes(recovery(edited.schedule!).find(b=>b.recovery!.anchor.taskId==='a')!),15);
 const removed=updateRecoveryPlan(plan,tasks.slice(1));assert.deepEqual(removed.breakPreferences,p);assert.equal(removed.schedule!.some(b=>b.taskId==='a'),false);
 assert.equal(plan.tasks[0].durationMinutes,60);
});
test('omitted recovery does not leave unnecessary fragments of one long task',()=>{
 const tasks=[task('long',180)];const r=run(tasks,prefs,{...config,endTime:'12:00'});
 assert.equal(r.status,'adjusted-recovery');assert.equal(r.blocks.length,1);assert.equal(blockMinutes(r.blocks[0]),180);
});
test('time-window edits retain future recovery overrides at task ends after redistribution',()=>{
 const tasks=[task('a'),task('b'),task('c')];const first=run(tasks);
 const p=setRecoveryOverride(prefs,recovery(first.blocks)[1].recovery!.anchor,{durationMinutes:15});const r=run(tasks,p);
 const timer:LiveTimer={id:'p',name:'Day',timezone:'UTC',blocks:r.blocks,breakPreferences:p,startedAt:stamp(0),endsAt:stamp(240)};
 const changed=adjustTimerTimeWindow(timer,stamp(300),Date.parse(stamp(20)));
 assert.equal(validLiveTimer(changed),true);assert.deepEqual(changed.blocks[0],timer.blocks[0]);
 assert.equal(blockMinutes(recovery(changed.blocks).find(b=>b.recovery!.anchor.taskId==='b' && b.recovery!.anchor.atTaskEnd)!),15);
 assert.ok(recovery(changed.blocks).some(b=>b.recovery!.anchor.taskId==='a'));
});

test('repeated live resizing conserves elapsed history and produces unique, bounded blocks',()=>{
 const tasks=[task('a'),task('b',120),task('c',90)];const r=run(tasks);
 const initial:LiveTimer={id:'p',name:'Day',timezone:'UTC',blocks:r.blocks,breakPreferences:prefs,startedAt:stamp(0),endsAt:stamp(360)};
 let timer=initial;
 for(const minutes of [300,480,180,360,240,500,150,350]){
  timer=adjustTimerTimeWindow(timer,stamp(minutes),Date.parse(stamp(20)));
  assert.equal(validLiveTimer(timer),true);assert.deepEqual(timer.blocks[0],initial.blocks[0]);
  assert.equal(new Set(timer.blocks.map(b=>b.id)).size,timer.blocks.length);
  assert.ok(timer.blocks.every(b=>Date.parse(b.end)<=Date.parse(stamp(minutes))));
 }
});
test('completing work in a recovery-enabled run retains elapsed work as history',()=>{
 const tasks=[task('a'),task('b'),task('c')];const r=run(tasks);
 const timer:LiveTimer={id:'p',name:'Day',timezone:'UTC',blocks:r.blocks,breakPreferences:prefs,startedAt:stamp(0),endsAt:stamp(240)};
 const next=completeTimerTask(timer,'a',Date.parse(stamp(40)));
 assert.equal(validLiveTimer(next),true);assert.equal(next.blocks[0].start,timer.blocks[0].start);assert.equal(next.blocks[0].end,stamp(40));
 assert.deepEqual(next.completedTaskIds,['a']);assert.ok(!next.blocks.some(b=>b.taskId==='a' && Date.parse(b.end)>Date.parse(stamp(40))));
});

test('legacy timer resizing cannot reuse an existing nonadjacent segment ID',()=>{
 const day={...config,startTime:'12:00',endTime:'15:00'};
 const tasks=[task('LinkedIn',30,1,{fixedStart:'12:00'}),task('Lunch',60,1,{isBreak:true,fixedStart:'13:00'}),task('a',45,1),task('b',45,1)];
 const r=generateScheduleResult(tasks,day,{preferences:{preset:'none',overrides:[]}});
 const timer:LiveTimer={id:'legacy',name:'Day',timezone:'UTC',blocks:r.blocks,startedAt:r.blocks[0].start,endsAt:r.blocks.at(-1)!.end};
 const changed=adjustTimerTimeWindow(timer,'2026-10-23T16:00:00Z',Date.parse('2026-10-23T12:00:00Z'));
 assert.equal(validLiveTimer(changed),true);assert.equal(new Set(changed.blocks.map(b=>b.id)).size,changed.blocks.length);
});

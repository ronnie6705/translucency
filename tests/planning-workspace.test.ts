import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculatePlanningSchedule,requiredCapacityShortfall,type PlanningInputs,type PlanningOrder} from '../src/modules/rhythm/planning-workspace';
import {defaultBreakPreferences,setRecoveryOverride} from '../src/modules/rhythm/recovery/recovery-types';
import {validateSchedule} from '../src/modules/rhythm/schedule-validation';
import {blockMinutes} from '../src/modules/rhythm/schedule-placement';
import {validateLibrary,emptyLibrary} from '../src/modules/rhythm/library';
import {serializeICS} from '../src/modules/rhythm/ics';
import type {Task,DayConfig,ScheduleBlock} from '../src/modules/rhythm/types';
const config:DayConfig={date:'2026-10-23',startTime:'09:00',endTime:'17:00',timezone:'UTC',chronotype:'Bear'};
const task=(id:string,durationMinutes=60,extra:Partial<Task>={}):Task=>({id,name:id,durationMinutes,energyRequired:5,priority:2,...extra});
const inputs=(tasks:Task[],day=config):PlanningInputs=>({tasks,config:day,preferences:defaultBreakPreferences()});
const order=(tasks:Task[],day=config):PlanningOrder=>{let cursor=Date.parse(`${day.date}T${day.startTime}:00Z`);return {tasks,config:day,blocks:tasks.map(t=>{const start=t.fixedStart?Date.parse(`${day.date}T${t.fixedStart}:00Z`):cursor;cursor=start+t.durationMinutes*60000;return {id:t.id,taskId:t.id,taskName:t.name,start:new Date(start).toISOString(),end:new Date(cursor).toISOString(),isBreak:!!t.isBreak,isFixed:!!t.fixedStart,energyRequired:t.energyRequired};})};};
const ids=(blocks:ScheduleBlock[])=>[...new Set(blocks.filter(b=>!b.isBreak).map(b=>b.taskId))];
const protectedBreak=task('rest',10,{isBreak:true,plannedBreakAfterTaskId:'a'});

test('full day remains valid with an accurately reported optional recovery shortfall',()=>{
 const i=inputs(Array.from({length:8},(_,n)=>task(`${n}`)));
 const r=calculatePlanningSchedule(i,order(i.tasks));
 assert.equal(r.status,'adjusted-recovery');assert.equal(r.scheduledRecoveryMinutes,0);
 assert.ok(r.recommendedRecoveryMinutes>0);assert.equal(r.recoveryShortfallMinutes,r.recommendedRecoveryMinutes);
 assert.equal(validateSchedule(i.tasks,i.config,r.blocks).valid,true);
 assert.equal(requiredCapacityShortfall(i),0);
 const end=17*60+r.recoveryShortfallMinutes;
 const extended={...i,config:{...config,endTime:`${Math.floor(end/60)}:${String(end%60).padStart(2,'0')}`}};
 const next=calculatePlanningSchedule(extended,order(i.tasks));
 assert.equal(next.status,'valid');assert.equal(next.recoveryShortfallMinutes,0);
 assert.deepEqual(ids(next.blocks),ids(r.blocks));
 assert.ok(next.blocks.at(-1) && !next.blocks.at(-1)!.isBreak);
});
test('removed and edited recovery are accounted for before capacity reduction',()=>{
 const i=inputs([task('a',85),task('b',30)],{...config,endTime:'10:55'});
 const first=calculatePlanningSchedule(i,order(i.tasks,i.config));
 assert.equal(first.recommendedRecoveryMinutes,10);assert.equal(first.recoveryShortfallMinutes,10);
 const anchor={taskId:'a',offsetMinutes:85,atTaskEnd:true};
 const removed=calculatePlanningSchedule({...i,preferences:setRecoveryOverride(i.preferences,anchor,{removed:true})},order(i.tasks,i.config));
 assert.equal(removed.recommendedRecoveryMinutes,0);assert.equal(removed.recoveryShortfallMinutes,0);
 const edited=calculatePlanningSchedule({...i,config,preferences:setRecoveryOverride(i.preferences,anchor,{durationMinutes:15})},order(i.tasks,i.config));
 assert.equal(edited.recommendedRecoveryMinutes,15);assert.equal(edited.scheduledRecoveryMinutes,15);
});
test('pending protected break resolves after extension and persists through no-auto switching',()=>{
 const original=inputs([task('a'),task('b')],{...config,endTime:'11:00'});
 const manual=order(original.tasks,original.config);
 const requested={...original,tasks:[...original.tasks,protectedBreak]};
 const failed=calculatePlanningSchedule(requested,manual);
 assert.equal(failed.status,'invalid');assert.equal(failed.blocks.length,0);
 assert.equal(requiredCapacityShortfall(requested),10);
 const extended={...requested,config:{...config,endTime:'11:15'}};
 for(const preset of ['none','balanced','deep-focus','frequent'] as const){
  const r=calculatePlanningSchedule({...extended,preferences:{...extended.preferences,preset}},manual);
  assert.notEqual(r.status,'invalid');assert.equal(blockMinutes(r.blocks.find(b=>b.taskId==='rest')!),10);
  assert.equal(r.blocks[r.blocks.findIndex(b=>b.taskId==='rest')-1].taskId,'a');
 }
 // Cancelling just the pending break retains an independently changed estimate/window.
 const canceled={...requested,config:{...config,endTime:'11:05'},tasks:[task('a',65),task('b')]};
 assert.notEqual(calculatePlanningSchedule(canceled,manual).status,'invalid');
 assert.equal(canceled.tasks[0].durationMinutes,65);
});
test('missing break anchor stays unresolved until explicitly repositioned or cancelled',()=>{
 const i=inputs([task('a'),task('b'),protectedBreak]);const initial=calculatePlanningSchedule(i,order(i.tasks.filter(t=>!t.isBreak)));
 const manual={tasks:i.tasks,config,blocks:initial.baseSchedule};
 const requested={...i,tasks:i.tasks.filter(t=>t.id!=='a')};
 assert.equal(calculatePlanningSchedule(requested,manual).status,'invalid');
 const repositioned={...requested,tasks:requested.tasks.map(t=>t.isBreak?{...t,plannedBreakAfterTaskId:'b'}:t)};
 assert.equal(calculatePlanningSchedule(repositioned,manual).status,'valid');
 assert.equal(calculatePlanningSchedule({...requested,tasks:requested.tasks.filter(t=>!t.isBreak)},manual).status,'valid');
});
test('manual order and anchored breaks survive removal, estimates, ranges and repeated presets',()=>{
 const original=[task('c'),task('a'),task('b')];const manual=order(original);
 let i=inputs([...original,protectedBreak]);
 for(let n=0;n<4;n++)for(const preset of ['balanced','deep-focus','none','frequent'] as const){
  i={...i,config:{...config,endTime:n%2?'18:00':'17:00'},preferences:{preset,overrides:[]},tasks:i.tasks.map(t=>t.id==='a'?{...t,durationMinutes:75+n*5}:t)};
  const r=calculatePlanningSchedule(i,manual);
  assert.notEqual(r.status,'invalid');assert.deepEqual(ids(r.blocks),['c','a','b']);
  assert.equal(validateSchedule(i.tasks,i.config,r.blocks).valid,true);
  assert.equal(new Set(r.blocks.map(b=>b.id)).size,r.blocks.length);
  assert.equal(r.blocks.filter(b=>b.taskId==='rest').length,1);
 }
 const removed=calculatePlanningSchedule({...i,tasks:i.tasks.filter(t=>t.id!=='c')},manual);
 assert.deepEqual(ids(removed.blocks),['a','b']);assert.equal(original.length,3);assert.equal(original[1].durationMinutes,60);
});
test('protected insertion splits work around fixed lunch, conserving duration and task order',()=>{
 const tasks=[task('a'),task('b',180),task('lunch',60,{isBreak:true,fixedStart:'13:00'}),task('c')];
 const i=inputs([...tasks,protectedBreak]);const r=calculatePlanningSchedule(i,order(tasks));
 assert.notEqual(r.status,'invalid');assert.equal(validateSchedule(i.tasks,config,r.blocks).valid,true);
 assert.deepEqual(ids(r.blocks),['a','b','c']);
 const lunch=r.blocks.find(b=>b.taskId==='lunch')!;assert.equal(lunch.start,'2026-10-23T13:00:00.000Z');assert.equal(blockMinutes(lunch),60);
 assert.equal(r.blocks.filter(b=>b.taskId==='b').reduce((n,b)=>n+blockMinutes(b),0),180);
});
test('split task total edits/removals apply to every segment without mutating the accepted snapshot',()=>{
 const tasks=[task('a',180),task('lunch',60,{isBreak:true,fixedStart:'11:00'}),task('b')];
 const i=inputs(tasks);const first=calculatePlanningSchedule(i);assert.notEqual(first.status,'invalid');
 const manual={tasks,config,blocks:first.baseSchedule};const before=JSON.stringify(manual);
 for(const durationMinutes of [90,240]){
  const requested={...i,tasks:tasks.map(t=>t.id==='a'?{...t,durationMinutes}:t)};
  const r=calculatePlanningSchedule(requested,manual);assert.notEqual(r.status,'invalid');
  assert.equal(r.blocks.filter(b=>b.taskId==='a').reduce((n,b)=>n+blockMinutes(b),0),durationMinutes);
 }
 assert.equal(calculatePlanningSchedule({...i,tasks:tasks.filter(t=>t.id!=='a')},manual).blocks.some(b=>b.taskId==='a'),false);
 assert.equal(JSON.stringify(manual),before);
});
test('invalid ranges, fixed conflicts and oversized work produce pending results with no invalid timeline',()=>{
 for(const i of [inputs([task('a')],{...config,endTime:'08:00'}),inputs([task('a',600)]),inputs([task('a',90,{fixedStart:'10:00'}),task('b',90,{fixedStart:'11:00'})])]){
  const r=calculatePlanningSchedule(i);assert.equal(r.status,'invalid');
 }
});
test('protected break metadata roundtrips and ICS contains only accepted, fully placed blocks',()=>{
 const i=inputs([task('a'),task('b'),protectedBreak]);const r=calculatePlanningSchedule(i);assert.notEqual(r.status,'invalid');
 const saved={id:'new',name:'Copy',createdAt:'2026-10-23T00:00:00Z',dayConfig:config,tasks:i.tasks,schedule:r.blocks,breakPreferences:i.preferences,recoveryBaseSchedule:r.baseSchedule};
 const original={...saved,id:'old',tasks:[task('old')],schedule:undefined,recoveryBaseSchedule:undefined};
 const library={...emptyLibrary(),timeblocks:[saved,original]};
 const restored=validateLibrary(JSON.parse(JSON.stringify(library)));assert.deepEqual(restored.timeblocks[0],saved);assert.equal(restored.timeblocks[1].tasks[0].id,'old');
 const ics=serializeICS(r.blocks);assert.match(ics,/SUMMARY:rest/);assert.equal((ics.match(/BEGIN:VEVENT/g)??[]).length,r.blocks.length);
});

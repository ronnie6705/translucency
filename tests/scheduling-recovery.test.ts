import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchedule } from '../src/modules/rhythm/rhythmScheduler';
import { adjustTimerTimeWindow } from '../src/modules/rhythm/update-live-time-window';
import { serializeICS } from '../src/modules/rhythm/ics';
import { validateSchedule } from '../src/modules/rhythm/schedule-validation';
import { completeTimerTask, validLiveTimer } from '../src/modules/rhythm/live-timer';
import { updateTaskEstimate, DEFAULT_TASK_ESTIMATE, ENERGY_DURATIONS } from '../src/modules/rhythm/task-duration';
import { validateLibrary } from '../src/modules/rhythm/library';
import { reorderTimerBlocks, insertItemIntoTimer } from '../src/modules/rhythm/insert-live-task';
import type { Task, DayConfig } from '../src/modules/rhythm/types';
const task = (id: string, minutes: number, extra: Partial<Task> = {}): Task => ({ id, name: id, durationMinutes: minutes, energyRequired: 1, priority: 2, ...extra });
const config: DayConfig = { date:'2026-10-16', startTime:'12:00', endTime:'15:00', timezone:'Australia/Melbourne', chronotype:'Bear' };
const anchors = [task('LinkedIn',30,{fixedStart:'12:00'}),task('Lunch',60,{fixedStart:'13:00',isBreak:true})];
const tasks = [...anchors, task('A',45),task('B',45)];
const minutes = (blocks: ReturnType<typeof generateSchedule>, id: string) => blocks.filter(b=>b.taskId===id).reduce((n,b)=>n+(Date.parse(b.end)-Date.parse(b.start))/60000,0);

test('the LinkedIn/lunch gap uses split work, preserves all estimates and validates for both outputs',()=>{
 const original=structuredClone(tasks), blocks=generateSchedule(tasks,config);
 assert.equal(validateSchedule(tasks,config,blocks).valid,true);
 assert.deepEqual(tasks,original);
 assert.equal(blocks.length,5);
 for(const t of tasks) assert.equal(minutes(blocks,t.id),t.durationMinutes);
 assert.ok(blocks.some(b=>b.start==='2026-10-16T01:30:00.000Z'));
 assert.ok(['A','B'].some(id=>blocks.filter(b=>b.taskId===id).length===2));
 const ics=serializeICS(blocks);
 assert.equal((ics.match(/BEGIN:VEVENT/g)??[]).length,blocks.length);
 for(const b of blocks) assert.ok(ics.includes('DTSTART:'+b.start.replace(/[-:]/g,'').replace('.000','')));
 assert.equal(blocks.filter(b=>b.isFixed).length,2);
 const timer={id:'p',name:'Plan',timezone:config.timezone,blocks};
 assert.equal(validLiveTimer(timer),true);
 const restored=validateLibrary({version:1,spaces:[],taskLists:[],timeblocks:[{id:'p',name:'Plan',createdAt:'2026-10-16T00:00:00Z',tasks,dayConfig:config,schedule:blocks}],liveTimer:timer});
 assert.deepEqual(restored.liveTimer!.blocks,restored.timeblocks[0].schedule);
});

test('unused gaps are accepted and spare capacity avoids splitting',()=>{
 const day={...config,endTime:'15:30'},blocks=generateSchedule(tasks,day);
 assert.equal(blocks.length,4);
 assert.equal(validateSchedule(tasks,day,blocks).valid,true);
 assert.equal(blocks.find(b=>b.taskId==='A')!.start,'2026-10-16T03:00:00.000Z');
});

test('backtracking finds the unsplit solution for 45/60/75 minute tasks',()=>{
 const day={...config,startTime:'11:00',endTime:'16:00'};
 const selected=[...anchors,task('A',45),task('B',60),task('C',75)];
 const blocks=generateSchedule(selected,day);
 assert.equal(validateSchedule(selected,day,blocks).valid,true);
 assert.equal(blocks.length,selected.length);
 assert.equal(blocks.find(b=>b.taskId==='B')!.start,'2026-10-16T00:00:00.000Z');
});

test('partial coverage, overlaps, excess duration, unknown blocks and moved anchors never pass the output gate',()=>{
 const blocks=generateSchedule(tasks,config);
 const segment=blocks.find(b=>(Date.parse(b.end)-Date.parse(b.start))/60000===15)!;
 const partial=blocks.filter(b=>b.id!==segment.id);
 assert.equal(validateSchedule(tasks,config,partial).valid,false);
 assert.equal(validateSchedule(tasks,config,partial).unallocated.find(t=>t.taskId===segment.taskId)!.minutes,15);
 for(const mutate of [
  ()=>[...blocks,{...blocks[0],id:'duplicate'}],
  ()=>blocks.map((b,i)=>i===0?{...b,start:new Date(Date.parse(b.start)+60000).toISOString()}:b),
  ()=>blocks.map((b,i)=>i===0?{...b,taskId:'unknown'}:b),
  ()=>[...blocks].reverse(),
 ]) assert.equal(validateSchedule(tasks,config,mutate()).valid,false);
 const over=[...tasks,task('C',45)];
 const result=validateSchedule(over,config,generateSchedule(over,config));
 assert.equal(result.excess,45);assert.equal(result.valid,false);assert.match(result.message,/exceed/);
});

test('energy edits instantly replace estimates; dropdown edits and fixed commitments remain supported',()=>{
 const initial={...task('new',45),...DEFAULT_TASK_ESTIMATE};
 for(const energy of [1,2,3,4,5] as const) assert.equal(updateTaskEstimate(initial,{energyRequired:energy}).durationMinutes,ENERGY_DURATIONS[energy]);
 const custom=updateTaskEstimate(initial,{durationMinutes:20});
 assert.equal(custom.durationMode,'custom');
 assert.equal(custom.durationMinutes,20);
 assert.equal(updateTaskEstimate(custom,{name:'Renamed'}).durationMinutes,20);
 assert.equal(updateTaskEstimate(custom,{energyRequired:5}).durationMinutes,90);
 assert.equal(updateTaskEstimate({...custom,energyRequired:5},{durationMode:'automatic'}).durationMinutes,90);
 assert.equal(updateTaskEstimate(task('legacy',90),{energyRequired:1}).durationMinutes,15);
 for(const protectedTask of [{...initial,fixedStart:'12:00'},{...initial,isBreak:true}]) assert.equal(updateTaskEstimate(protectedTask,{energyRequired:5}).durationMinutes,45);
 const changed=updateTaskEstimate(initial,{energyRequired:5});
 assert.equal(validateSchedule([changed],{...config,endTime:'13:00'},generateSchedule([changed],{...config,endTime:'13:00'})).excess,30);
});

test('completion and skipping preserve fixed non-break appointments and fixed lunches',()=>{
 const day={...config,startTime:'11:00',endTime:'16:00'};
 const selected=[task('early',45),...anchors,task('A',45),task('B',45)];
 const blocks=generateSchedule(selected,day);
 const timer={id:'p',name:'Plan',timezone:config.timezone,blocks,startedAt:blocks[0].start,endsAt:'2026-10-16T05:00:00.000Z'};
 for(const outcome of ['completed','skipped'] as const){
  const next=completeTimerTask(timer,'early',Date.parse('2026-10-16T00:20:00.000Z'),outcome);
  for(const anchor of blocks.filter(b=>b.isFixed)) assert.deepEqual(next.blocks.find(b=>b.id===anchor.id),anchor);
  assert.equal(validLiveTimer(next),true);
 }
 assert.deepEqual(reorderTimerBlocks(timer,blocks.findIndex(b=>b.taskId==='LinkedIn'),0,Date.parse('2026-10-15T23:00:00.000Z')),timer);
 assert.throws(()=>insertItemIntoTimer(timer,{title:'Too long',durationMinutes:120,isBreak:false,anchorId:blocks[0].id,position:'after'},Date.parse('2026-10-16T00:00:00.000Z')),/fixed appointment/);
});

test('many fragmented plans retain every minute with no overlaps across chronotypes',()=>{
 for(const chronotype of ['Lion','Bear','Wolf','Dolphin'] as const) for(let seed=0;seed<15;seed++){
  const day={...config,startTime:'09:00',endTime:'18:00',chronotype};
  const selected=[...anchors,...Array.from({length:5},(_,i)=>task(`t${i}`,30+((seed+i)%5)*15,{energyRequired:(1+(seed+i)%5) as Task['energyRequired']}))];
  const blocks=generateSchedule(selected,day);
  assert.equal(validateSchedule(selected,day,blocks).valid,true,`${chronotype} ${seed}`);
 }
});


test('legacy saved appointments acquire fixed metadata without changing time or estimates',()=>{
 const blocks=generateSchedule(tasks,config).map(({isFixed,...block})=>block);
 const payload={version:1,spaces:[],taskLists:[],timeblocks:[{id:'legacy',name:'Plan',createdAt:'2026-10-16T00:00:00Z',tasks,dayConfig:config,schedule:blocks}],liveTimer:{id:'legacy',name:'Plan',timezone:config.timezone,blocks}};
 const original=structuredClone(payload),restored=validateLibrary(payload);
 assert.deepEqual(payload,original);
 assert.equal(restored.liveTimer!.blocks.filter(b=>b.isFixed).length,2);
 assert.deepEqual(restored.timeblocks[0].tasks,tasks);
 assert.deepEqual(restored.liveTimer!.blocks.map(({isFixed,...b})=>b),blocks);
});

test('end-time edits cannot cut through a fixed appointment',()=>{
 const blocks=generateSchedule(tasks,config);
 const timer={id:'p',name:'Plan',timezone:config.timezone,blocks,startedAt:blocks[0].start,endsAt:blocks.at(-1)!.end};
 assert.throws(()=>adjustTimerTimeWindow(timer,'2026-10-16T02:30:00.000Z',Date.parse('2026-10-16T01:00:00.000Z')),/fixed appointments/);
 const changed=adjustTimerTimeWindow(timer,'2026-10-16T05:00:00.000Z',Date.parse('2026-10-16T01:00:00.000Z'));
 assert.deepEqual(changed.blocks.filter(b=>b.isFixed),blocks.filter(b=>b.isFixed));
 assert.equal(validLiveTimer(changed),true);
});

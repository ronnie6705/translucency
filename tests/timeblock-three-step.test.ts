import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchedule } from '../src/modules/rhythm/rhythmScheduler';
import { workloadSummary, energyBand, scheduleSummary } from '../src/modules/rhythm/workload';
import { validateLibrary } from '../src/modules/rhythm/library';
import type { Task, DayConfig } from '../src/modules/rhythm/types';
const tasks: Task[] = [
 { id:'high',name:'Deep work',durationMinutes:90,energyRequired:5,priority:1 },
 { id:'low',name:'Admin',durationMinutes:30,energyRequired:1,priority:2 },
 { id:'fixed',name:'Lunch',durationMinutes:45,energyRequired:1,priority:2,isBreak:true,fixedStart:'12:00' },
];
const config: DayConfig = {date:'2026-09-25',startTime:'09:00',endTime:'18:00',timezone:'Australia/Melbourne',chronotype:'Lion'};
test('chronotypes change placement without mutating assessments or identities, retaining fixed breaks and duration',()=>{
 const original=structuredClone(tasks);
 const lion=generateSchedule(tasks,config), wolf=generateSchedule(tasks,{...config,chronotype:'Wolf'});
 assert.deepEqual(tasks,original);
 assert.notEqual(lion.find(b=>b.taskId==='high')!.start,wolf.find(b=>b.taskId==='high')!.start);
 for(const task of tasks){
  const a=lion.find(b=>b.taskId===task.id)!,b=wolf.find(b=>b.taskId===task.id)!;
  assert.equal(a.id,b.id); assert.equal((Date.parse(a.end)-Date.parse(a.start))/60000,task.durationMinutes);
  assert.equal((Date.parse(b.end)-Date.parse(b.start))/60000,task.durationMinutes);
 }
 assert.equal(lion.find(b=>b.isBreak)!.start,wolf.find(b=>b.isBreak)!.start);
 for(const blocks of [lion,wolf]) blocks.forEach((b,i)=>{if(i) assert.ok(Date.parse(b.start)>=Date.parse(blocks[i-1].end));});
});
test('workload counts energy bands consistently and includes breaks in capacity',()=>{
 const summary=workloadSummary(tasks,'09:00','11:00');
 assert.deepEqual(summary.distribution,{Low:1,Moderate:0,High:1});
 assert.equal(summary.count,2); assert.equal(summary.average,3); assert.equal(summary.excess,45);
 assert.deepEqual([1,2,3,4,5].map(energyBand),['Low','Low','Moderate','High','High']);
});
test('overfull plans retain full estimates, omit unplaced tasks, and never truncate durations',()=>{
 const blocks=generateSchedule(tasks,{...config,endTime:'10:00'});
 assert.equal(blocks.some(b=>b.taskId==='high'),false);
 assert.equal(tasks[0].durationMinutes,90);
 assert.equal(scheduleSummary(blocks).work,30);
});
test('saved exact schedules round-trip through library validation and malformed schedules are rejected',()=>{
 const schedule=generateSchedule(tasks,config);
 const payload={version:1,spaces:[],taskLists:[],timeblocks:[{id:'plan',name:'Today',createdAt:new Date().toISOString(),tasks,dayConfig:config,schedule}]};
 assert.deepEqual(validateLibrary(payload).timeblocks[0].schedule,schedule);
 assert.throws(()=>validateLibrary({...payload,timeblocks:[{...payload.timeblocks[0],schedule:[{...schedule[0],end:'invalid'}]}]}));
});

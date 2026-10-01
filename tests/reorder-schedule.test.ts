import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reorderSchedule } from '../src/modules/rhythm/reorder-schedule';
import type { DayConfig, Task, ScheduleBlock } from '../src/modules/rhythm/types';
const config: DayConfig = {date:'2026-10-01',startTime:'09:00',endTime:'13:00',timezone:'UTC',chronotype:'Bear'};
const task = (id:string, durationMinutes=30, fixedStart?:string):Task => ({id,name:id,durationMinutes,energyRequired:3,priority:1,...(fixedStart?{fixedStart}:{})});
const block = (id:string, start:string, end:string, taskId=id, isBreak=false):ScheduleBlock => ({id,taskId,taskName:taskId,energyRequired:3,isBreak,start:`2026-10-01T${start}:00.000Z`,end:`2026-10-01T${end}:00.000Z`});
test('moves blocks without changing IDs, per-segment duration, energy, breaks or source data',()=>{
 const blocks=[block('a1','09:00','09:30','a'),block('break','09:30','09:40','break',true),block('a2','09:40','10:00','a'),block('b','10:00','10:30')];
 const copy=structuredClone(blocks); const tasks=[task('a',50),{...task('break',10),isBreak:true},task('b')];
 const result=reorderSchedule(blocks,tasks,config,3,0);
 assert.equal(result.error,undefined);assert.deepEqual(result.blocks.map(b=>b.id),['b','a1','break','a2']);
 for(const b of result.blocks){const old=blocks.find(x=>x.id===b.id)!;assert.equal(Date.parse(b.end)-Date.parse(b.start),Date.parse(old.end)-Date.parse(old.start)); assert.deepEqual({...b,start:old.start,end:old.end},old);}
 assert.deepEqual(blocks,copy);
});
test('permits crossing a fixed appointment only when all blocks fit, keeps its original timestamp',()=>{
 const blocks=[block('a','09:00','09:30'),block('fixed','10:00','10:30'),block('b','10:30','11:00')];
 const tasks=[task('a'),task('fixed',30,'10:00'),task('b')];
 const result=reorderSchedule(blocks,tasks,config,2,0);
 assert.equal(result.error,undefined);assert.deepEqual(result.blocks.at(-1),blocks[1]);
 assert.ok(reorderSchedule(blocks,tasks,config,1,0).error);
});
test('rejects overlap and overflow atomically instead of truncating, splitting or moving a fixed task',()=>{
 const blocks=[block('a','09:00','10:00'),block('fixed','10:00','10:30'),block('b','10:30','11:00')];
 const tasks=[task('a',60),task('fixed',30,'10:00'),task('b')];
 const result=reorderSchedule(blocks,tasks,config,2,1);
 assert.ok(result.error);assert.equal(result.blocks,blocks);
 const overflow=reorderSchedule(blocks,tasks,{...config,endTime:'10:45'},0,2);
 assert.ok(overflow.error);assert.equal(overflow.blocks,blocks);
});
test('uses existing fixed-time validation',()=>{
 const blocks=[block('a','09:00','10:00'),block('b','10:00','10:30')];
 const result=reorderSchedule(blocks,[task('a',60,'09:00'),task('b',30,'09:30')],config,1,0);
 assert.match(result.error!,/overlap/);assert.equal(result.blocks,blocks);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { stepPriority, sortTasksByPriority } from '../src/modules/rhythm/task-priority';
import { changeTasks, updateTask } from '../src/modules/rhythm/task-spaces';
import { emptyLibrary, validateLibrary } from '../src/modules/rhythm/library';
import { timerBlockHeight } from '../src/modules/rhythm/live-timer';
import type { Task, ScheduleBlock } from '../src/modules/rhythm/types';
const task: Task = { id:'task', name:'Task', priority:2, durationMinutes:45, durationMode:'custom', energyRequired:3, completed:false };
const block: ScheduleBlock = { id:'block',taskId:task.id,taskName:task.name,start:'2026-10-22T04:00:00Z',end:'2026-10-22T04:45:00Z',isBreak:false };
const data = { ...emptyLibrary(),spaces:[{id:'space',name:'Work',icon:'grid',color:'#ffffff',createdAt:block.start,tasks:[task]}], timeblocks:[{id:'plan',name:'Plan',createdAt:block.start,tasks:[task],schedule:[block],dayConfig:{date:'2026-10-22',startTime:'15:00',endTime:'16:00',timezone:'Australia/Sydney',chronotype:'Bear' as const}}],liveTimer:{id:'live',name:'Live',timezone:'Australia/Sydney',blocks:[block]} };
test('priority boundaries, stable ordering and unset persistence', () => {
  assert.equal(stepPriority(4,'decrease'),4); assert.equal(stepPriority(1,'increase'),1);
  assert.deepEqual([4,3,2].map(p=>stepPriority(p as Task['priority'],'increase')),[3,2,1]);
  const tasks = [4,2,1,3,2].map((priority,i)=>({...task,id:String(i),priority:priority as Task['priority']}));
  assert.deepEqual(sortTasksByPriority(tasks).map(t=>t.id),['2','1','4','3','0']);
  assert.deepEqual(tasks.map(t=>t.id),['0','1','2','3','4']);
  const next=updateTask(data,{spaceId:'space',taskId:task.id},{priority:4});
  assert.equal(validateLibrary(JSON.parse(JSON.stringify(next))).spaces![0].tasks[0].priority,4);
  assert.deepEqual(next.spaces![0].tasks[0],{...task,priority:4});
  assert.strictEqual(next.timeblocks,data.timeblocks); assert.strictEqual(next.liveTimer,data.liveTimer);
});
test('source deletion preserves accepted schedule snapshots and live timer', () => {
  const next=changeTasks(data,{spaceId:'space'},tasks=>tasks.filter(t=>t.id!==task.id));
  assert.equal(next.spaces![0].tasks.length,0);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(next))).timeblocks[0].schedule,[block]);
  assert.strictEqual(next.timeblocks,data.timeblocks); assert.strictEqual(next.liveTimer,data.liveTimer);
});
test('live blocks retain the original readable sizing for short tasks and breaks', () => {
  assert.equal(timerBlockHeight({...block,end:new Date(Date.parse(block.start)+5*60000).toISOString()}),82);
  assert.equal(timerBlockHeight({...block,isBreak:true}),64);
  assert.equal(timerBlockHeight({...block,end:new Date(Date.parse(block.start)+60*60000).toISOString()}),111);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planTaskShortening,applyTaskShortening,undoTaskShortening} from '../src/modules/rhythm/shorten-planning-tasks';
import {calculatePlanningSchedule} from '../src/modules/rhythm/planning-workspace';
import {validateSchedule} from '../src/modules/rhythm/schedule-validation';
import {defaultBreakPreferences} from '../src/modules/rhythm/recovery/recovery-types';
import type {Task,DayConfig} from '../src/modules/rhythm/types';
const task=(id:string,durationMinutes=60,extra:Partial<Task>={}):Task=>({id,name:id,durationMinutes,energyRequired:5,priority:2,...extra});
const prefs=defaultBreakPreferences();
const config:DayConfig={date:'2026-10-23',startTime:'09:00',endTime:'17:00',timezone:'UTC',chronotype:'Bear'};
test('eight one-hour estimates free forty minutes proportionally and Undo restores exact estimates',()=>{
 const tasks=Array.from({length:8},(_,i)=>task(String(i)));const before=structuredClone(tasks);
 const plan=planTaskShortening(tasks,prefs,40);assert.equal(plan.minutes,40);assert.equal(plan.changes.length,8);
 const shortened=applyTaskShortening(tasks,plan);assert.ok(shortened.every(t=>t.durationMinutes===55 && t.durationMode==='custom'));
 assert.deepEqual(undoTaskShortening(shortened,plan.changes),before);assert.deepEqual(tasks,before);
});
test('whole-minute rounding conserves requested reduction with deterministic weighted shares',()=>{
 const tasks=[task('a',30),task('b',60),task('c',90)];
 const plan=planTaskShortening(tasks,prefs,17);assert.equal(plan.minutes,17);
 assert.deepEqual(plan.changes.map(c=>c.beforeMinutes-c.afterMinutes),[3,6,8]);
 assert.deepEqual(planTaskShortening(tasks,prefs,17),plan);
});
test('minimum floors redistribute shares; already-short, fixed and planned tasks never shrink',()=>{
 const tasks=[task('short',3),task('small',6),task('large',60),task('fixed',60,{fixedStart:'12:00'}),task('break',30,{isBreak:true})];
 const plan=planTaskShortening(tasks,prefs,100);assert.equal(plan.minutes,56);
 const next=applyTaskShortening(tasks,plan);assert.deepEqual(next.map(t=>t.durationMinutes),[3,5,5,60,30]);
 assert.equal(planTaskShortening(next,prefs,20).minutes,0);
});
test('manual recovery offsets stay valid; task-end overrides remain attached',()=>{
 const preferences={...prefs,overrides:[{anchor:{taskId:'a',offsetMinutes:50},durationMinutes:15},{anchor:{taskId:'b',offsetMinutes:60,atTaskEnd:true},durationMinutes:10}]};
 const next=applyTaskShortening([task('a'),task('b')],planTaskShortening([task('a'),task('b')],preferences,40));
 assert.equal(next[0].durationMinutes,51);assert.equal(next[1].durationMinutes,29);
 assert.equal(planTaskShortening([task('a')],{...prefs,overrides:[{anchor:{taskId:'a',offsetMinutes:60},durationMinutes:10}]},10).minutes,0);
});
test('no-auto and absent or malformed shortfalls cannot trigger shortening',()=>{
 for(const shortfall of [0,-1,NaN,Infinity])assert.equal(planTaskShortening([task('a')],prefs,shortfall).minutes,0);
 assert.equal(planTaskShortening([task('a')],{preset:'none',overrides:[]},20).minutes,0);
});
test('Undo keeps later duration edits, fixed changes, removals and unrelated fields',()=>{
 const original=[task('a'),task('b'),task('c'),task('d')];const plan=planTaskShortening(original,prefs,40);
 const edited=applyTaskShortening(original,plan).filter(t=>t.id!=='d').map(t=>t.id==='a'?{...t,durationMinutes:25}:t.id==='b'?{...t,fixedStart:'12:00'}:{...t,name:'Renamed'});
 const undone=undoTaskShortening(edited,plan.changes);
 assert.deepEqual(undone.map(t=>t.durationMinutes),[25,50,60]);assert.equal(undone[2].name,'Renamed');assert.equal(undone.length,3);
});
test('shortening a full day inserts recovery through existing planning, preserving chosen order',()=>{
 const tasks=Array.from({length:8},(_,i)=>task(String(i)));const inputs={tasks,config,preferences:prefs};
 const initial=calculatePlanningSchedule(inputs);assert.equal(initial.status,'adjusted-recovery');
 const order={tasks,config,blocks:initial.baseSchedule};
 const nextTasks=applyTaskShortening(tasks,planTaskShortening(tasks,prefs,initial.recoveryShortfallMinutes));
 const result=calculatePlanningSchedule({...inputs,tasks:nextTasks},order);
 assert.notEqual(result.status,'invalid');assert.equal(result.recoveryShortfallMinutes,0);assert.ok(result.scheduledRecoveryMinutes>0);
 assert.equal(validateSchedule(nextTasks,config,result.blocks).valid,true);
 assert.deepEqual([...new Set(result.blocks.filter(b=>!b.isBreak).map(b=>b.taskId))],initial.baseSchedule.map(b=>b.taskId));
 const restored=calculatePlanningSchedule({...inputs,tasks:undoTaskShortening(nextTasks,planTaskShortening(tasks,prefs,initial.recoveryShortfallMinutes).changes)},order);
 assert.deepEqual(restored,initial);
});

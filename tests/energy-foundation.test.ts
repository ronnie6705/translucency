import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { energyAtDate, energyAtMinute, getChronotypeCurve, validateEnergyCurve, EnergyCurveValidationError } from '../src/modules/rhythm/energy-curve';
import { generateSchedule } from '../src/modules/rhythm/rhythmScheduler';
import { EnergyCurveGraph } from '../src/modules/rhythm/components/EnergyCurveGraph';
import { TASK_ENERGY_COLORS, taskEnergyColors } from '../src/modules/rhythm/task-energy';
import type { Chronotype, DayConfig, Task } from '../src/modules/rhythm/types';
const task: Task = {id:'work',name:'Work',energyRequired:5,durationMinutes:60,priority:1};
const config: DayConfig = {date:'2026-10-01',startTime:'06:00',endTime:'23:00',timezone:'UTC',chronotype:'Bear'};
for (const [chronotype, peak] of [['Lion','08:00'],['Bear','09:00'],['Wolf','16:00'],['Dolphin','10:00']] as [Chronotype,string][]) {
 test(`${chronotype}: unchanged peak placement, five minute search and shared curve`,()=>{
  const curve = getChronotypeCurve(chronotype);
  const schedule = generateSchedule([task],{...config,chronotype});
  assert.equal(schedule[0].start,`2026-10-01T${peak}:00.000Z`);
  assert.deepEqual(schedule,generateSchedule([task],{...config,chronotype},curve));
  assert.equal(curve.bands.reduce((n,b)=>n+b.endMinutes-b.startMinutes,0),1440);
  for(const band of curve.bands) { assert.equal(energyAtMinute(curve,band.startMinutes),band.level); assert.equal(energyAtMinute(curve,band.endMinutes-.01),band.level); }
  const graph = renderToStaticMarkup(createElement(EnergyCurveGraph,{curve}));
  assert.equal((graph.match(/ H/g)??[]).length,curve.bands.length*2);
 });
}
test('custom curves validate, normalize midnight and do not silently fall back',()=>{
 const curve = validateEnergyCurve({version:1,bands:[{startMinutes:1320,endMinutes:360,level:5},{startMinutes:360,endMinutes:1320,level:1}]});
 assert.equal(energyAtMinute(curve,0),5); assert.equal(energyAtMinute(curve,360),1);
 assert.equal(generateSchedule([task],config,curve)[0].start,'2026-10-01T22:00:00.000Z');
 for(const value of [null,{version:2,bands:[]},{version:1,bands:[{startMinutes:0,endMinutes:1440,level:6}]},{version:1,bands:[{startMinutes:1,endMinutes:1440,level:1}]},{version:1,bands:[{startMinutes:0,endMinutes:1000,level:1},{startMinutes:900,endMinutes:1440,level:2}]}]) assert.throws(()=>generateSchedule([task],config,value as never),EnergyCurveValidationError);
});
test('timezone and tolerance remain correct',()=>{
 const curve=getChronotypeCurve('Lion');
 assert.equal(energyAtDate(curve,new Date('2026-09-30T22:00:00Z'),'Australia/Melbourne'),5);
 assert.equal(energyAtDate(curve,new Date('2026-10-01T00:00:00Z'),'UTC'),1);
 const low=validateEnergyCurve({version:1,bands:[{startMinutes:0,endMinutes:1440,level:1}]});
 assert.equal(generateSchedule([task],{...config,startTime:'06:05'},low)[0].start,'2026-10-01T06:05:00.000Z');
});
test('canonical energy colors and neutral breaks/legacy values',()=>{
 assert.deepEqual(Object.values(TASK_ENERGY_COLORS).map(c=>[c.solid,c.tint]),[['#827FFF','#827FFF4D'],['#4D9FFF','#4D9FFF4D'],['#37CDB4','#37CDB44D'],['#FF8536','#FF85364D'],['#FF5C68','#FF5C684D']]);
 assert.deepEqual(taskEnergyColors(5,true),taskEnergyColors(undefined));
 assert.deepEqual(taskEnergyColors(0),taskEnergyColors(undefined));
});

test('96 mixed-task schedules match the pre-refactor scheduler baseline', async()=>{
 const { createHash } = await import('node:crypto');
 const outputs=[];
 for(const chronotype of ['Lion','Bear','Wolf','Dolphin'] as Chronotype[]) for(let seed=0;seed<24;seed++) {
   const tasks=Array.from({length:8},(_,i)=>({id:String(i),name:'Task '+i,durationMinutes:15+((seed+i)%6)*15,energyRequired:(1+(seed+i)%5) as Task['energyRequired'],priority:(1+i%3) as Task['priority'],...(i===0?{fixedStart:'13:00'}:{})}));
   outputs.push(generateSchedule(tasks,{date:'2026-10-01',startTime:'05:'+(seed%2?'05':'00'),endTime:'23:00',timezone:'Australia/Melbourne',chronotype}));
 }
 assert.equal(createHash('sha256').update(JSON.stringify(outputs)).digest('hex'),'3342539b8bbf9190d83f5cb43d4288daa8c8fe4841bfcd7a450f1012cc984489');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteSpace, spaceContents } from '../src/modules/rhythm/delete-space';
import { emptyLibrary, validateLibrary } from '../src/modules/rhythm/library';
import type { Space, Task } from '../src/modules/rhythm/types';
const task:Task={id:'task',name:'Task',durationMinutes:30,energyRequired:3,priority:2,completed:true};
const space=(id:string,tasks:Task[]=[]):Space=>({id,name:id,icon:'general',color:'#ffffff',createdAt:'2026-10-27T00:00:00Z',tasks});
const fixture=()=>({...emptyLibrary(),spaces:[space('source',[task]),space('target')],taskLists:[{id:'list',spaceId:'source',name:'List',createdAt:'2026-10-27T00:00:00Z',tasks:[{...task,id:'listed'}]}]});
test('move preserves tasks, completion, lists, IDs and accepted history without mutating source',()=>{
 const data=fixture(), before=structuredClone(data);
 const next=deleteSpace(data,'source',{mode:'move',destinationId:'target'});
 assert.deepEqual(data,before);assert.equal(next.spaces!.length,1);assert.deepEqual(next.spaces![0].tasks,[task]);
 assert.equal(next.taskLists[0].spaceId,'target');assert.equal(next.taskLists[0].id,'list');assert.equal(next.taskLists[0].tasks,data.taskLists[0].tasks);
 assert.equal(next.timeblocks,data.timeblocks);assert.equal(next.liveTimer,data.liveTimer);assert.equal(next.runs,data.runs);validateLibrary(next);
});
test('explicit delete removes only source contents',()=>{
 const data=fixture();const next=deleteSpace(data,'source',{mode:'delete',expectedContents:spaceContents(data,'source').fingerprint});
 assert.deepEqual(next.spaces,[data.spaces[1]]);assert.deepEqual(next.taskLists,[]);validateLibrary(next);
});
test('last nonempty space can move into a new General space',()=>{
 const data=fixture();data.spaces=data.spaces.slice(0,1);
 const next=deleteSpace(data,'source',{mode:'move',newSpace:space('general')});
 assert.equal(next.spaces![0].id,'general');assert.equal(next.taskLists[0].spaceId,'general');validateLibrary(next);
});
test('last empty space can be deleted without a destination',()=>{
 const data={...emptyLibrary(),spaces:[space('only')]};assert.deepEqual(deleteSpace(data,'only',{mode:'move'}).spaces,[]);
});
test('stale destructive confirmation fails instead of deleting newly added contents',()=>{
 const data=fixture(),expectedContents=spaceContents(data,'source').fingerprint;
 data.spaces[0].tasks.push({...task,id:'new'});
 assert.throws(()=>deleteSpace(data,'source',{mode:'delete',expectedContents}),/changed while/);
});
test('missing or same-space destination and duplicate tasks are rejected',()=>{
 const data=fixture();for(const destinationId of ['source','missing'])assert.throws(()=>deleteSpace(data,'source',{mode:'move',destinationId}),/destination/);
 data.spaces[1].tasks=[task];assert.throws(()=>deleteSpace(data,'source',{mode:'move',destinationId:'target'}),/already contains/);
 assert.throws(()=>deleteSpace(data,'missing',{mode:'move'}),/no longer exists/);
});

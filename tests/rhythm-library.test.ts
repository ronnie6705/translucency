import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, mergeLibraries, validateLibrary } from '../src/modules/rhythm/library';
const task = {id:'t1',name:'Write',durationMinutes:60,energyRequired:4,priority:1};
const list = {id:'l1',name:'Today',createdAt:'2026-09-08T00:00:00Z',tasks:[task]};
test('Rhythm backup validation rejects corrupt or future data before importing', () => {
  assert.throws(() => validateLibrary({version:2,taskLists:[],timeblocks:[]}));
  assert.throws(() => validateLibrary({version:1,taskLists:[{...list,tasks:[{...task,durationMinutes:-10}]}],timeblocks:[]}));
  assert.throws(() => validateLibrary({version:1,taskLists:[],timeblocks:[{...list,dayConfig:{date:'2026-09-08',startTime:'09:00',endTime:'18:00',chronotype:'Bear',timezone:'invalid'}}]}));
});
test('Rhythm migration retains task details, day settings and fixed commitments', () => {
  const library = validateLibrary({version:1,taskLists:[list],timeblocks:[{...list,dayConfig:{date:'2026-09-08',startTime:'09:00',endTime:'18:00',chronotype:'Bear',timezone:'Australia/Melbourne'},tasks:[{...task,fixedStart:'10:00',isBreak:false}]}]});
  assert.equal(library.timeblocks[0].tasks[0].fixedStart,'10:00');
  assert.equal(library.timeblocks[0].dayConfig.timezone,'Australia/Melbourne');
});
test('repeated imports are idempotent and do not replace local edits', () => {
  const original = validateLibrary({...emptyLibrary(),taskLists:[list]});
  const incoming = validateLibrary({...emptyLibrary(),taskLists:[{...list,name:'Different'}, {...list,id:'l2'}]});
  const once = mergeLibraries(original,incoming);
  assert.equal(once.taskLists.length,2);
  assert.equal(once.taskLists[0].name,'Today');
  assert.deepEqual(mergeLibraries(once,incoming),once);
  assert.equal(original.taskLists.length,1);
});

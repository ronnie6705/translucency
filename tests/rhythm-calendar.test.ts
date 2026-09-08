import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeICS } from '../src/modules/rhythm/ics';
import { buildManualSchedule } from '../src/modules/rhythm/utils/manualSchedule';
test('calendar keeps fixed times in the chosen zone when the browser zone differs', () => {
  const blocks = buildManualSchedule([{id:'call',name:'Call',durationMinutes:30,priority:1,energyRequired:3,fixedStart:'10:00'}], {date:'2026-09-08',startTime:'09:00',endTime:'12:00',chronotype:'Bear',timezone:'America/New_York'});
  assert.equal(blocks[0].start,'2026-09-08T14:00:00.000Z');
  assert.equal(blocks[0].end,'2026-09-08T14:30:00.000Z');
});
test('ICS serializes UTC instants, escapes text and folds Unicode without corrupting it', () => {
  const name='Plan, review; then rest\n'+ '✨'.repeat(60);
  const ics=serializeICS([{id:'test',taskId:'test',taskName:name,start:'2026-09-08T00:00:00Z',end:'2026-09-08T01:00:00Z',isBreak:false,energyRequired:3}],new Date('2026-09-08T02:00:00Z'));
  assert.match(ics,/DTSTAMP:20260908T020000Z/);
  assert.match(ics,/DTSTART:20260908T000000Z/);
  assert.ok(ics.replaceAll('\r\n ','').includes('SUMMARY:Plan\\, review\\; then rest\\n'+'✨'.repeat(60)));
  assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { timerPosition, validLiveTimer } from '../src/modules/rhythm/live-timer';
import { buildManualSchedule } from '../src/modules/rhythm/utils/manualSchedule';
import { emptyLibrary, mergeLibraries, validateLibrary } from '../src/modules/rhythm/library';

const blocks = buildManualSchedule([
  { id: 'write', name: 'Write', durationMinutes: 30, energyRequired: 4, priority: 1 },
  { id: 'rest', name: 'Short break', durationMinutes: 10, energyRequired: 1, priority: 1, isBreak: true },
], { date: '2026-09-09', startTime: '12:00', endTime: '13:00', timezone: 'Australia/Sydney', chronotype: 'Bear' });
const timer = { id: 'timer', name: "Today's Plan", timezone: 'Australia/Sydney', blocks };
test('timer follows scheduled instants across timezones, exact boundaries and tab suspension', () => {
  const start = Date.parse(blocks[0].start);
  assert.equal(new Date(start).toISOString(), '2026-09-09T02:00:00.000Z');
  assert.equal(timerPosition(blocks, start - 1).phase, 'scheduled');
  assert.equal(timerPosition(blocks, start).activeIndex, 0);
  assert.equal(timerPosition(blocks, start + 15 * 60000).progress, .5);
  assert.equal(timerPosition(blocks, Date.parse(blocks[0].end)).activeIndex, 1);
  assert.equal(timerPosition(blocks, Date.parse(blocks[1].end)).phase, 'complete');
  assert.equal(timerPosition(blocks, start + 86400000).phase, 'complete');
});
test('unscheduled gaps do not extend a task or mark the next task active early', () => {
  const delayed = [blocks[0], { ...blocks[1], start: '2026-09-09T02:45:00Z', end: '2026-09-09T02:55:00Z' }];
  assert.equal(timerPosition(delayed, Date.parse('2026-09-09T02:40:00Z')).phase, 'gap');
  assert.equal(timerPosition(delayed, Date.parse('2026-09-09T02:45:00Z')).activeIndex, 1);
});
test('persisted timers round trip with backups and survive unrelated imports', () => {
  const library = { ...emptyLibrary(), liveTimer: timer };
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(library))).liveTimer, timer);
  assert.deepEqual(mergeLibraries(library, emptyLibrary()).liveTimer, timer);
  assert.deepEqual(validateLibrary(emptyLibrary()), emptyLibrary());
  assert.equal(validLiveTimer({ ...timer, blocks: [] }), false);
  assert.equal(validLiveTimer({ ...timer, blocks: [blocks[1], blocks[0]] }), false);
  assert.throws(() => validateLibrary({ ...library, liveTimer: { ...timer, timezone: 'invalid' } }));
});

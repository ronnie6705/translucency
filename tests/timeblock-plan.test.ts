import test from 'node:test';
import assert from 'node:assert/strict';
import { TIME_OPTIONS, validateTimeblockPlan } from '../src/modules/rhythm/timeblock-plan';
import { buildManualSchedule } from '../src/modules/rhythm/utils/manualSchedule';
import type { Task } from '../src/modules/rhythm/types';

const task: Task = { id: 'task', name: 'Write', durationMinutes: 45, energyRequired: 2, priority: 2 };
const lunch: Task = { ...task, id: 'lunch', name: 'Lunch', isBreak: true, fixedStart: '13:00' };

test('plan requires task estimates, energy, and a valid quarter-hour range; breaks are optional', () => {
  assert.equal(TIME_OPTIONS.length, 96);
  assert.equal(validateTimeblockPlan([task], '09:00', '17:30').valid, true);
  for (const [start, end] of [['', ''], ['17:30', '09:00'], ['09:00', '09:00'], ['09:01', '17:30']]) {
    assert.equal(validateTimeblockPlan([task], start, end).valid, false);
  }
  for (const update of [{ durationMinutes: 0 }, { durationMinutes: NaN }, { energyRequired: 0 }, { energyRequired: undefined }]) {
    assert.equal(validateTimeblockPlan([{ ...task, ...update } as Task], '09:00', '17:30').valid, false);
  }
  assert.equal(validateTimeblockPlan([], '09:00', '17:30').valid, false);
});

test('fixed breaks must fit fully and cannot overlap other commitments', () => {
  assert.equal(validateTimeblockPlan([task, lunch], '09:00', '17:30').valid, true);
  assert.equal(validateTimeblockPlan([task, lunch], '09:00', '13:30').valid, false);
  assert.equal(validateTimeblockPlan([task, lunch], '14:00', '17:30').valid, false);
  assert.equal(validateTimeblockPlan([task, lunch, { ...lunch, id: 'walk', fixedStart: '13:30' }], '09:00', '17:30').valid, false);
  assert.equal(validateTimeblockPlan([task, lunch, { ...lunch, id: 'walk', fixedStart: '13:45' }], '09:00', '17:30').valid, true);
  assert.equal(validateTimeblockPlan([task, { ...lunch, name: ' ' }], '09:00', '17:30').valid, false);
  assert.equal(validateTimeblockPlan([task, { ...lunch, fixedStart: undefined }], '09:00', '17:30').valid, true);
});

test('manual schedule and exports respect edited task order regardless of priority and energy', () => {
  const urgent: Task = { ...task, id: 'urgent', energyRequired: 5, priority: 1 };
  const config = { date: '2026-09-11', startTime: '09:00', endTime: '17:30', chronotype: 'Bear' as const, timezone: 'UTC' };
  const blocks = buildManualSchedule([task, urgent, lunch], config);
  assert.deepEqual(blocks.map(block => block.taskId), ['task', 'urgent', 'lunch']);
  assert.equal(blocks[2].start, '2026-09-11T13:00:00.000Z');
  assert.deepEqual(buildManualSchedule([urgent, task, lunch], config).map(block => block.taskId), ['urgent', 'task', 'lunch']);
});

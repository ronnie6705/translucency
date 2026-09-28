import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchedule, planSchedule } from '../src/modules/rhythm/rhythmScheduler';
import { energyAtMinute, getEnergyProfile, getEnergyLevelAt } from '../src/modules/rhythm/energy-profiles';
import { acceptedSchedule, explainPlacement, moveScheduleBlock, updateAcceptedTask } from '../src/modules/rhythm/schedule';
import { validateLibrary } from '../src/modules/rhythm/library';
import { completeTimerTask } from '../src/modules/rhythm/live-timer';
import { insertItemIntoTimer, reorderTimerBlocks } from '../src/modules/rhythm/insert-live-task';
import type { Chronotype, DayConfig, SavedTimeblock, ScheduleBlock, Task } from '../src/modules/rhythm/types';

const config: DayConfig = { date: '2026-09-28', startTime: '09:00', endTime: '18:00', timezone: 'UTC', chronotype: 'Bear' };
const task = (id: string, energy: Task['energyRequired'], durationMinutes = 60, priority: Task['priority'] = 2): Task => ({ id, name: id, energyRequired: energy, durationMinutes, priority });
const at = (time: string) => `2026-09-28T${time}:00.000Z`;
const block = (id: string, start: string, end: string, extra: Partial<ScheduleBlock> = {}): ScheduleBlock => ({ id, taskId: id, taskName: id, start: at(start), end: at(end), energyRequired: 3, isBreak: false, ...extra });
const saved = (tasks: Task[], schedule?: ScheduleBlock[]): SavedTimeblock => ({ id: 'plan', name: 'Plan', createdAt: at('08:00'), dayConfig: config, tasks, schedule });

test('shared numerical profiles cover all minutes and use exact band boundaries', () => {
  for (const type of ['Lion', 'Bear', 'Wolf', 'Dolphin'] as Chronotype[]) {
    const bands = getEnergyProfile(type);
    assert.equal(bands[0].startMinutes, 0);
    assert.equal(bands.at(-1)!.endMinutes, 1440);
    bands.forEach((b, i) => { if (i) assert.equal(b.startMinutes, bands[i - 1].endMinutes); });
    for (let minute = 0; minute < 1440; minute++) assert.ok(energyAtMinute(type, minute) >= 1 && energyAtMinute(type, minute) <= 5);
  }
  assert.equal(energyAtMinute('Lion', 629), 5);
  assert.equal(energyAtMinute('Lion', 630), 4);
  assert.equal(getEnergyLevelAt('Bear', new Date('2026-09-28T00:00:00Z'), 'UTC'), 1);
});

test('light work prefers a dip and demanding work retains the peak even at lower priority', () => {
  const blocks = generateSchedule([task('admin', 1, 60, 1), task('deep', 5, 90, 2)], config);
  assert.equal(blocks.find(b => b.taskId === 'deep')!.start, at('09:00'));
  assert.equal(blocks.find(b => b.taskId === 'admin')!.start, at('13:00'));
});

test('the whole duration is scored; crossing a dip is worse than a later continuous match', () => {
  const blocks = generateSchedule([task('deep', 4, 120)], { ...config, startTime: '11:00' });
  assert.equal(blocks[0].start, at('15:00'));
});

test('coverage outranks energy fit and below-preferred placement is explained', () => {
  const tasks = [task('deep', 5, 60), task('admin', 1, 60)];
  const result = planSchedule(tasks, { ...config, startTime: '13:00', endTime: '15:00' });
  assert.equal(result.blocks.length, 2); assert.deepEqual(result.issues, []);
  const explanation = explainPlacement(result.blocks.find(b => b.taskId === 'deep')!, config);
  assert.equal(explanation.belowPreferred, true); assert.match(explanation.text, /60 min/);
});

test('packing alternatives recover tasks when an energy-optimal first placement fragments the day', () => {
  const tasks = [task('deep', 5, 60), task('long', 2, 180)];
  const result = planSchedule(tasks, { ...config, startTime: '07:00', endTime: '11:00' });
  assert.equal(result.blocks.length, 2); assert.equal(result.issues.length, 0);
});

test('priority determines which work fits when capacity is insufficient', () => {
  const result = planSchedule([task('low', 1, 60, 3), task('important', 5, 60, 1)], { ...config, endTime: '10:00' });
  assert.equal(result.blocks.length, 1); assert.equal(result.blocks[0].taskId, 'important');
  assert.match(result.issues[0].message, /Not enough free time/);
});

test('fragmented capacity does not split or truncate a task and gives a specific explanation', () => {
  const tasks = [task('long', 3, 90), { ...task('meeting', 1, 30), fixedStart: '10:00' }];
  const result = planSchedule(tasks, { ...config, endTime: '11:30' });
  assert.equal(result.blocks.length, 1); assert.match(result.issues[0].message, /smaller gaps/);
  assert.equal(tasks[0].durationMinutes, 90);
});

test('pins and fixed commitments survive profile changes and regeneration', () => {
  const tasks = [task('deep', 5), task('admin', 1), { ...task('lunch', 1, 30), isBreak: true, fixedStart: '12:00' }];
  const previous = [block('deep', '09:00', '10:00', { pinned: true, energyRequired: 5 })];
  const result = planSchedule(tasks, { ...config, chronotype: 'Wolf' }, { previous });
  assert.equal(result.blocks.find(b => b.taskId === 'deep')!.start, at('09:00'));
  assert.equal(result.blocks.find(b => b.taskId === 'deep')!.pinned, true);
  assert.equal(result.blocks.find(b => b.taskId === 'lunch')!.start, at('12:00'));
  assert.equal(result.blocks.find(b => b.taskId === 'lunch')!.fixed, true);
  assert.deepEqual(planSchedule(tasks, { ...config, chronotype: 'Wolf' }, { previous: result.blocks }).blocks, result.blocks);
});

test('invalid and overlapping pins are reported instead of silently relocated', () => {
  const tasks = [task('deep', 5, 120), { ...task('meeting', 1), fixedStart: '10:00' }];
  const previous = [block('deep', '09:00', '10:00', { pinned: true })];
  const result = planSchedule(tasks, config, { previous });
  assert.ok(result.issues.some(i => i.taskId === 'deep' && i.pinned && /overlaps/.test(i.message)));
  const smaller = planSchedule([tasks[0]], { ...config, startTime: '10:00' }, { previous });
  assert.equal(smaller.blocks.length, 0); assert.match(smaller.issues[0].message, /Pinned time no longer fits/);
  const splitPins = planSchedule([tasks[0]], config, { previous: [previous[0], { ...previous[0], id: 'second-part', start: at('13:00'), end: at('14:00') }] });
  assert.equal(splitPins.blocks.length, 0); assert.match(splitPins.issues[0].message, /multiple pinned segments/);
});

test('manual move changes only the crossed span and pins the selected task', () => {
  const blocks = [block('a', '09:00', '10:00'), block('b', '11:00', '11:30'), block('c', '14:00', '15:00')];
  const before = structuredClone(blocks);
  const moved = moveScheduleBlock(blocks, 0, 1);
  assert.equal(moved[0].taskId, 'b'); assert.equal(moved[1].pinned, true);
  assert.deepEqual(moved[2], blocks[2]); assert.deepEqual(blocks, before);
  assert.throws(() => moveScheduleBlock([blocks[0], { ...blocks[1], pinned: true }], 0, 1), /fixed or pinned|does not fit/);
  assert.throws(() => moveScheduleBlock([{ ...blocks[0], fixed: true }, blocks[1]], 0, 1), /Fixed commitments/);
});

test('accepted schedule, pins and exact instants survive serialization without repacking', () => {
  const schedule = [block('a', '15:00', '16:00', { pinned: true })];
  const timeblock = saved([task('a', 3)], schedule);
  const library = validateLibrary(JSON.parse(JSON.stringify({ version: 1, spaces: [], taskLists: [], timeblocks: [timeblock] })));
  assert.deepEqual(acceptedSchedule(library.timeblocks[0]), schedule);
  const changed = updateAcceptedTask(library.timeblocks[0], 'a', { name: 'Renamed' });
  assert.equal(changed.schedule![0].start, at('15:00')); assert.equal(changed.schedule![0].pinned, true);
  assert.equal(changed.schedule![0].taskName, 'Renamed');
  assert.throws(() => validateLibrary({ ...library, timeblocks: [{ ...timeblock, schedule: [{ ...schedule[0], pinned: 'yes' }] }] }));
});

test('legacy accepted order migrates once, including empty plans', () => {
  const library = validateLibrary({ version: 1, taskLists: [], timeblocks: [saved([task('a', 1), task('b', 5)]), { ...saved([]), id: 'empty' }] });
  assert.equal(library.timeblocks[0].schedule![0].taskId, 'a');
  assert.deepEqual(validateLibrary(library), library);
  const fixed = acceptedSchedule(saved([{ ...task('a', 1), fixedStart: '15:00' }], [block('a', '15:00', '16:00')]));
  assert.equal(fixed[0].fixed, true); assert.equal(fixed[0].start, at('15:00'));
});

test('completion reflow retains pinned work and fixed commitments', () => {
  const blocks = [block('done', '09:00', '10:00'), block('pin', '11:00', '12:00', { pinned: true }), block('fixed', '13:00', '14:00', { fixed: true }), block('flex', '14:00', '15:00')];
  const result = completeTimerTask({ id: 'timer', name: 'Timer', timezone: 'UTC', blocks, startedAt: at('09:00'), endsAt: at('15:00') }, 'done', Date.parse(at('09:30')));
  assert.deepEqual(result.blocks.find(b => b.taskId === 'pin'), blocks[1]);
  assert.deepEqual(result.blocks.find(b => b.taskId === 'fixed'), blocks[2]);
});

test('live insertions and reorders cannot displace pins or fixed work', () => {
  const blocks = [block('a', '09:00', '10:00'), block('pin', '10:30', '11:00', { pinned: true }), block('b', '11:00', '12:00')];
  const timer = { id: 'timer', name: 'Timer', timezone: 'UTC', blocks, startedAt: at('09:00'), endsAt: at('12:00') };
  const params = { title: 'Extra', durationMinutes: 15, isBreak: false, anchorId: 'a', position: 'after' as const };
  const inserted = insertItemIntoTimer(timer, params, Date.parse(at('08:00')));
  assert.deepEqual(inserted.blocks.find(b => b.taskId === 'pin'), blocks[1]);
  assert.throws(() => insertItemIntoTimer(timer, { ...params, durationMinutes: 60 }, Date.parse(at('08:00'))), /pinned or fixed/);
  assert.throws(() => reorderTimerBlocks(timer, 1, 2, Date.parse(at('08:00'))), /Unpin/);
  assert.deepEqual(timer.blocks, blocks);
});

test('generated plans are deterministic, immutable, full-duration and non-overlapping in multiple timezones', () => {
  const tasks = Array.from({ length: 12 }, (_, i) => task(`task-${i}`, (i % 5 + 1) as Task['energyRequired'], [15, 30, 45, 60][i % 4], (i % 3 + 1) as Task['priority']));
  const before = structuredClone(tasks);
  for (const timezone of ['UTC', 'Australia/Sydney', 'America/New_York']) for (const chronotype of ['Lion', 'Bear', 'Wolf', 'Dolphin'] as Chronotype[]) {
    const settings = { ...config, timezone, chronotype };
    const blocks = generateSchedule(tasks, settings);
    assert.equal(blocks.length, tasks.length);
    assert.deepEqual(generateSchedule(tasks, settings), blocks);
    blocks.forEach((b, i) => {
      assert.equal((Date.parse(b.end) - Date.parse(b.start)) / 60_000, tasks.find(t => t.id === b.taskId)!.durationMinutes);
      if (i) assert.ok(Date.parse(b.start) >= Date.parse(blocks[i - 1].end));
    });
  }
  assert.deepEqual(tasks, before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTimerTask, formatDurationHM, insertItemIntoTimer, reorderTimerBlocks, timerPosition, validLiveTimer, type LiveTimer } from '../src/modules/rhythm/live-timer';
import { completeLiveTask } from '../src/modules/rhythm/complete-live-task';
import { insertLiveTimerItem, reorderLiveTimer } from '../src/modules/rhythm/insert-live-task';
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

const instant = (minutes: number) => new Date(Date.UTC(2026, 8, 14, 2, minutes)).toISOString();
const segment = (id: string, start: number, end: number, isBreak = false) => ({ id, taskId: id, taskName: id, start: instant(start), end: instant(end), isBreak, energyRequired: 3 });
const allocation = (timer: LiveTimer, id: string) => timer.blocks.filter(b => b.taskId === id).reduce((sum, b) => sum + (Date.parse(b.end) - Date.parse(b.start)) / 60000, 0);
const adaptive: LiveTimer = { id: 'adaptive', name: 'Plan', timezone: 'Australia/Sydney', blocks: [segment('a', 0, 30), segment('b', 30, 50), segment('c', 50, 60)] };

test('completion redistributes remaining time proportionally and retains the original finish', () => {
  const next = completeTimerTask(adaptive, 'a', Date.parse(instant(0)));
  assert.equal(allocation(next, 'b'), 40);
  assert.equal(allocation(next, 'c'), 20);
  assert.equal(next.blocks[0].start, instant(0));
  assert.equal(next.blocks.at(-1)!.end, instant(60));
  assert.equal(validLiveTimer(next), true);
  assert.equal(adaptive.blocks.length, 3);
  assert.strictEqual(completeTimerTask(next, 'a', Date.parse(instant(0))), next);
});

test('elapsed time is not credited back, and completions before start preserve the start', () => {
  const next = completeTimerTask(adaptive, 'a', Date.parse(instant(15)));
  assert.equal(next.blocks[0].start, instant(15));
  assert.equal(allocation(next, 'b'), 30);
  assert.equal(allocation(next, 'c'), 15);
  assert.equal(completeTimerTask(adaptive, 'a', Date.parse(instant(-15))).blocks[0].start, instant(0));
});

test('completing a future task increases every remaining allocation, excluding elapsed active time', () => {
  const next = completeTimerTask(adaptive, 'c', Date.parse(instant(15)));
  assert.equal(next.blocks[0].start, instant(0));
  assert.ok(allocation(next, 'a') > 30);
  assert.ok(allocation(next, 'b') > 20);
  assert.ok(Math.abs((allocation(next, 'a') - 15) / allocation(next, 'b') - 15 / 20) < .00001);
  assert.equal(next.blocks.at(-1)!.end, instant(60));
});

test('rebalancing preserves elapsed blocks and only extends the unelapsed running task', () => {
  const plan = { ...adaptive, blocks: [segment('past', 0, 20), segment('running', 20, 40), segment('future', 40, 60), segment('later', 60, 90)] };
  const next = completeTimerTask(plan, 'future', Date.parse(instant(30)));
  assert.deepEqual(next.blocks[0], plan.blocks[0]);
  assert.equal(next.blocks[1].start, instant(20));
  assert.ok(Math.abs(Date.parse(next.blocks[1].end) - Date.parse(instant(45))) <= 1);
  assert.equal(next.blocks[2].start, next.blocks[1].end);
  assert.equal(next.blocks[2].end, instant(90));
  assert.equal(validLiveTimer(next), true);
});

test('break instants are preserved and a task split around a break completes as one task', () => {
  const withBreak = { ...adaptive, blocks: [segment('a', 0, 20), segment('lunch', 20, 30, true), segment('b', 30, 50), segment('c', 50, 60)] };
  const next = completeTimerTask(withBreak, 'a', Date.parse(instant(0)));
  assert.deepEqual(next.blocks.find(b => b.isBreak), withBreak.blocks[1]);
  assert.equal(next.blocks.filter(b => b.taskId === 'b').length, 2);
  assert.ok(Math.abs(allocation(next, 'b') - 100 / 3) < .001);
  assert.equal(validLiveTimer(next), true);
  const last = completeTimerTask(next, 'b', Date.parse(instant(0)));
  assert.equal(last.blocks.some(b => b.taskId === 'b'), false);
  assert.equal(allocation(last, 'c'), 50);
  assert.equal(validLiveTimer(last), true);
  assert.strictEqual(completeTimerTask(withBreak, 'lunch', Date.parse(instant(0))), withBreak);
});

test('rapid completions and the final task produce a valid, reloadable finished timer', () => {
  const one = completeTimerTask(adaptive, 'b', Date.parse(instant(0)));
  const two = completeTimerTask(one, 'a', Date.parse(instant(0)));
  assert.equal(allocation(two, 'c'), 60);
  const done = completeTimerTask(two, 'c', Date.parse(instant(0)));
  assert.deepEqual(done.blocks, []);
  assert.deepEqual(done.completedTaskIds, ['b', 'a', 'c']);
  assert.equal(validLiveTimer(done), true);
  assert.deepEqual(validateLibrary({ ...emptyLibrary(), liveTimer: done }).liveTimer, done);
  assert.equal(validLiveTimer({ ...done, endsAt: instant(-1) }), false);
});

test('completion after the deadline removes the task without inventing more time', () => {
  const next = completeTimerTask(adaptive, 'a', Date.parse(instant(90)));
  assert.deepEqual(next.blocks, adaptive.blocks.slice(1));
  assert.equal(next.endsAt, instant(60));
});

test('completing at the deadline cannot silently drop unfinished tasks through rounding', () => {
  const start = Date.parse(instant(0));
  const short = { ...adaptive, blocks: [segment('a', 0, 30), segment('b', 30, 50), segment('c', 50, 60)] };
  const next = completeTimerTask(short, 'a', start + 60 * 60000 - 1);
  assert.deepEqual(next.blocks.map(b => b.taskId), ['b', 'c']);
  assert.equal(validLiveTimer(next), true);
});

test('timer and task copies complete in one transaction, preserving estimates and unrelated data', () => {
  const task = { id: 'a', name: 'a', durationMinutes: 30, energyRequired: 3 as const, priority: 1 as const };
  const data = { ...emptyLibrary(), liveTimer: adaptive, spaces: [{ id: 'space', name: 'Home', icon: 'home', color: '#ffffff', createdAt: instant(0), tasks: [task] }], taskLists: [{ id: 'list', spaceId: 'space', name: 'List', createdAt: instant(0), tasks: [task] }] };
  const next = completeLiveTask(data, 'adaptive', 'a', Date.parse(instant(0)));
  assert.equal(next.spaces![0].tasks[0].completed, true);
  assert.equal(next.taskLists[0].tasks[0].completed, true);
  assert.equal(next.taskLists[0].tasks[0].durationMinutes, 30);
  assert.equal(next.liveTimer!.blocks.some(b => b.taskId === 'a'), false);
  assert.equal('completed' in data.taskLists[0].tasks[0], false);
  assert.throws(() => completeLiveTask(data, 'different-timer', 'a', Date.parse(instant(0))), /changed/);
});

test('crossing a task records not-done separately and redistributes time without completing the source task', () => {
  const task = { id: 'a', name: 'a', durationMinutes: 30, energyRequired: 3 as const, priority: 1 as const };
  const data = { ...emptyLibrary(), liveTimer: adaptive, spaces: [{ id: 'space', name: 'Home', icon: 'home', color: '#ffffff', createdAt: instant(0), tasks: [task] }], taskLists: [{ id: 'list', spaceId: 'space', name: 'List', createdAt: instant(0), tasks: [task] }] };
  const next = completeLiveTask(data, 'adaptive', 'a', Date.parse(instant(0)), 'skipped');
  assert.deepEqual(next.liveTimer!.skippedTaskIds, ['a']);
  assert.deepEqual(next.liveTimer!.completedTaskIds ?? [], []);
  assert.strictEqual(next.spaces, data.spaces);
  assert.strictEqual(next.taskLists, data.taskLists);
  assert.equal(allocation(next.liveTimer!, 'b'), 40);
  assert.equal(allocation(next.liveTimer!, 'c'), 20);
  assert.strictEqual(completeTimerTask(next.liveTimer!, 'a', Date.parse(instant(0))), next.liveTimer);
  assert.equal(validLiveTimer(next.liveTimer), true);
});

test('all skipped and mixed outcomes survive reload and cannot claim the same task twice', () => {
  const first = completeTimerTask(adaptive, 'a', Date.parse(instant(0)), 'skipped');
  const second = completeTimerTask(first, 'b', Date.parse(instant(0)), 'skipped');
  const done = completeTimerTask(second, 'c', Date.parse(instant(0)), 'skipped');
  assert.deepEqual(done.blocks, []);
  assert.equal(validLiveTimer(done), true);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify({ ...emptyLibrary(), liveTimer: done }))).liveTimer, done);
  assert.equal(validLiveTimer({ ...done, completedTaskIds: ['a'] }), false);
  assert.equal(validLiveTimer({ ...done, skippedTaskIds: ['a', 'a'] }), false);
});

test('inserting a task after current task shifts future blocks and preserves elapsed time', () => {
  const plan: LiveTimer = {
    id: 'timer-insert',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(60),
    blocks: [segment('a', 0, 30), segment('b', 30, 60)]
  };
  // Running halfway through task a at minute 15
  const now = Date.parse(instant(15));
  const next = insertItemIntoTimer(plan, {
    title: 'New Task',
    durationMinutes: 20,
    isBreak: false,
    anchorId: 'a',
    position: 'after'
  }, now);

  assert.equal(next.blocks.length, 3);
  assert.equal(next.blocks[0].taskId, 'a');
  assert.equal(next.blocks[0].start, instant(0));
  assert.equal(next.blocks[0].end, instant(30));

  assert.equal(next.blocks[1].taskName, 'New Task');
  assert.equal(next.blocks[1].isBreak, false);
  assert.equal(next.blocks[1].start, instant(30));
  assert.equal(next.blocks[1].end, instant(50));

  assert.equal(next.blocks[2].taskId, 'b');
  assert.equal(next.blocks[2].start, instant(50));
  assert.equal(next.blocks[2].end, instant(80));

  assert.equal(next.endsAt, instant(80));
  assert.equal(validLiveTimer(next), true);
});

test('inserting a break after current task provides immediate upcoming break', () => {
  const plan: LiveTimer = {
    id: 'timer-break',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(60),
    blocks: [segment('a', 0, 30), segment('b', 30, 60)]
  };
  const now = Date.parse(instant(10));
  const next = insertItemIntoTimer(plan, {
    title: 'Coffee Break',
    durationMinutes: 10,
    isBreak: true,
    anchorId: 'a',
    position: 'after'
  }, now);

  assert.equal(next.blocks.length, 3);
  assert.equal(next.blocks[1].isBreak, true);
  assert.equal(next.blocks[1].taskName, 'Coffee Break');
  assert.equal(next.blocks[1].start, instant(30));
  assert.equal(next.blocks[1].end, instant(40));
  assert.equal(next.blocks[2].start, instant(40));
  assert.equal(next.blocks[2].end, instant(70));
  assert.equal(validLiveTimer(next), true);
});

test('inserting before an upcoming task places item before anchor and shifts schedule', () => {
  const plan: LiveTimer = {
    id: 'timer-before',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(60),
    blocks: [segment('a', 0, 30), segment('b', 30, 60)]
  };
  const now = Date.parse(instant(10));
  const next = insertItemIntoTimer(plan, {
    title: 'Prep work',
    durationMinutes: 15,
    isBreak: false,
    anchorId: 'b',
    position: 'before'
  }, now);

  assert.equal(next.blocks.length, 3);
  assert.equal(next.blocks[1].taskName, 'Prep work');
  assert.equal(next.blocks[1].start, instant(30));
  assert.equal(next.blocks[1].end, instant(45));
  assert.equal(next.blocks[2].taskId, 'b');
  assert.equal(next.blocks[2].start, instant(45));
  assert.equal(next.blocks[2].end, instant(75));
  assert.equal(validLiveTimer(next), true);
});

test('cannot insert into elapsed history before active running task', () => {
  const plan: LiveTimer = {
    id: 'timer-guard',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(60),
    blocks: [segment('a', 0, 30), segment('b', 30, 60)]
  };
  const now = Date.parse(instant(15));
  // Attempting to insert 'before' task a while task a is already running
  const next = insertItemIntoTimer(plan, {
    title: 'Attempted Past Task',
    durationMinutes: 10,
    isBreak: false,
    anchorId: 'a',
    position: 'before'
  }, now);

  // Should be constrained to after active task a, never rewriting history before minute 15
  assert.equal(next.blocks[0].taskId, 'a');
  assert.equal(next.blocks[0].start, instant(0));
  assert.equal(next.blocks[1].taskName, 'Attempted Past Task');
  assert.equal(next.blocks[1].start, instant(30));
  assert.equal(validLiveTimer(next), true);
});

test('formatDurationHM formats elapsed and remaining times accurately', () => {
  assert.equal(formatDurationHM(0), '0m');
  assert.equal(formatDurationHM(-1000), '0m');
  assert.equal(formatDurationHM(15 * 60000), '15m');
  assert.equal(formatDurationHM(60 * 60000), '1h');
  assert.equal(formatDurationHM(135 * 60000), '2h 15m');
  assert.equal(formatDurationHM(285 * 60000), '4h 45m');
});

test('insertLiveTimerItem persists new task into RhythmLibrary spaces and liveTimer', () => {
  const plan: LiveTimer = {
    id: 'timer-lib',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(60),
    blocks: [segment('a', 0, 30), segment('b', 30, 60)]
  };
  const data = {
    ...emptyLibrary(),
    liveTimer: plan,
    spaces: [{ id: 'space', name: 'Home', icon: 'home', color: '#ffffff', createdAt: instant(0), tasks: [] }],
    taskLists: [],
    timeblocks: [{ id: 'plan', name: 'Plan', createdAt: instant(0), dayConfig: { date: '2026-09-14', startTime: '12:00', endTime: '13:00', timezone: 'Australia/Sydney', chronotype: 'Bear' as const }, tasks: [] }]
  };
  const now = Date.parse(instant(10));
  const next = insertLiveTimerItem(data, 'timer-lib', {
    title: 'Inserted Workspace Task',
    durationMinutes: 25,
    isBreak: false,
    anchorId: 'a',
    position: 'after',
    energyRequired: 4
  }, now);

  assert.equal(next.liveTimer!.blocks.length, 3);
  assert.equal(next.liveTimer!.endsAt, instant(85));
  assert.equal(next.spaces![0].tasks.length, 1);
  assert.equal(next.spaces![0].tasks[0].name, 'Inserted Workspace Task');
  assert.equal(next.spaces![0].tasks[0].durationMinutes, 25);
  assert.equal(next.spaces![0].tasks[0].energyRequired, 4);
});

test('proportional relative durations maintain exact ratios when blocks are added', () => {
  // Requirement 9: Task A = 2h, Task B = 1h, Break = 30m
  // Task A is visually 2x Task B and 4x Break
  const plan: LiveTimer = {
    id: 'timer-ratios',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(210),
    blocks: [segment('a', 0, 120), segment('b', 120, 180)]
  };
  const now = Date.parse(instant(0));
  const next = insertItemIntoTimer(plan, {
    title: 'Short Break',
    durationMinutes: 30,
    isBreak: true,
    anchorId: 'b',
    position: 'after'
  }, now);

  const durA = Date.parse(next.blocks[0].end) - Date.parse(next.blocks[0].start);
  const durB = Date.parse(next.blocks[1].end) - Date.parse(next.blocks[1].start);
  const durBreak = Date.parse(next.blocks[2].end) - Date.parse(next.blocks[2].start);

  assert.equal(durA, 120 * 60000);
  assert.equal(durB, 60 * 60000);
  assert.equal(durBreak, 30 * 60000);
  assert.equal(durA / durB, 2);
  assert.equal(durA / durBreak, 4);
});

test('reorderTimerBlocks shifts future blocks start and end times while preserving durations', () => {
  const plan: LiveTimer = {
    id: 'timer-reorder',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(120),
    blocks: [segment('active', 0, 30), segment('task-1', 30, 60), segment('task-2', 60, 90), segment('task-3', 90, 120)],
  };
  const now = Date.parse(instant(15)); // 'active' is currently running (activeIndex = 0)

  // Move task-3 (index 3) to index 1 (before task-1)
  const reordered = reorderTimerBlocks(plan, 3, 1, now);

  assert.equal(reordered.blocks.length, 4);
  assert.equal(reordered.blocks[0].id, 'active');
  assert.equal(reordered.blocks[1].id, 'task-3');
  assert.equal(reordered.blocks[2].id, 'task-1');
  assert.equal(reordered.blocks[3].id, 'task-2');

  // Verify times are continuous and durations are preserved:
  assert.equal(reordered.blocks[0].start, instant(0));
  assert.equal(reordered.blocks[0].end, instant(30));
  assert.equal(reordered.blocks[1].start, instant(30));
  assert.equal(reordered.blocks[1].end, instant(60));
  assert.equal(reordered.blocks[2].start, instant(60));
  assert.equal(reordered.blocks[2].end, instant(90));
  assert.equal(reordered.blocks[3].start, instant(90));
  assert.equal(reordered.blocks[3].end, instant(120));

  assert.equal(reordered.endsAt, instant(120));
});

test('reorderTimerBlocks disallows dragging or dropping into active or completed history', () => {
  const plan: LiveTimer = {
    id: 'timer-reorder-guard',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(90),
    blocks: [segment('past', 0, 30), segment('active', 30, 60), segment('future', 60, 90)],
  };
  const now = Date.parse(instant(45)); // 'active' is currently running (activeIndex = 1)

  // Attempting to move past block (fromIndex 0 < minMovableIndex 2)
  const movePast = reorderTimerBlocks(plan, 0, 2, now);
  assert.deepEqual(movePast, plan);

  // Attempting to move active block (fromIndex 1 < minMovableIndex 2)
  const moveActive = reorderTimerBlocks(plan, 1, 2, now);
  assert.deepEqual(moveActive, plan);

  // Attempting to drop future block before active block (toIndex 0 or 1 < minMovableIndex 2)
  const dropIntoPast = reorderTimerBlocks(plan, 2, 0, now);
  assert.deepEqual(dropIntoPast, plan);

  const dropIntoActive = reorderTimerBlocks(plan, 2, 1, now);
  assert.deepEqual(dropIntoActive, plan);
});

test('reorderTimerBlocks allows reordering any blocks when phase is scheduled', () => {
  const plan: LiveTimer = {
    id: 'timer-scheduled',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(60),
    endsAt: instant(150),
    blocks: [segment('a', 60, 90), segment('b', 90, 120), segment('c', 120, 150)],
  };
  const now = Date.parse(instant(0)); // Before timer starts (phase = scheduled)

  // Move c (index 2) to first position (index 0)
  const reordered = reorderTimerBlocks(plan, 2, 0, now);
  assert.equal(reordered.blocks[0].id, 'c');
  assert.equal(reordered.blocks[1].id, 'a');
  assert.equal(reordered.blocks[2].id, 'b');

  assert.equal(reordered.blocks[0].start, instant(60));
  assert.equal(reordered.blocks[0].end, instant(90));
  assert.equal(reordered.blocks[1].start, instant(90));
  assert.equal(reordered.blocks[1].end, instant(120));
  assert.equal(reordered.blocks[2].start, instant(120));
  assert.equal(reordered.blocks[2].end, instant(150));
});

test('reorderLiveTimer persists reordered timer in RhythmLibrary', () => {
  const plan: LiveTimer = {
    id: 'timer-lib-reorder',
    name: 'Plan',
    timezone: 'Australia/Sydney',
    startedAt: instant(0),
    endsAt: instant(90),
    blocks: [segment('active', 0, 30), segment('t1', 30, 60), segment('t2', 60, 90)],
  };
  const data = { ...emptyLibrary(), liveTimer: plan };
  const now = Date.parse(instant(10));

  const next = reorderLiveTimer(data, 'timer-lib-reorder', 2, 1, now);
  assert.equal(next.liveTimer?.blocks[1].id, 't2');
  assert.equal(next.liveTimer?.blocks[2].id, 't1');
});




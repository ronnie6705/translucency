import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyLibrary, validateLibrary } from '../src/modules/rhythm/library';
import {
  findTaskReference,
  updateTask,
  updateTimeblockTask,
} from '../src/modules/rhythm/task-spaces';
import type { Space, Task, SavedTimeblock } from '../src/modules/rhythm/types';
import type { Timer } from '../src/modules/rhythm/components/LiveTimer';

const task = (id: string, name = id): Task => ({
  id,
  name,
  durationMinutes: 30,
  energyRequired: 3,
  priority: 2,
});

const space = (id: string, tasks: Task[] = []): Space => ({
  id,
  name: id,
  icon: 'home',
  color: '#81b8ff',
  createdAt: '2026-09-10T00:00:00Z',
  tasks,
});

const timeblock = (id: string, tasks: Task[] = []): SavedTimeblock => ({
  id,
  name: `Timeblock ${id}`,
  createdAt: '2026-09-10T08:00:00Z',
  dayConfig: {
    date: '2026-09-10',
    startTime: '09:00',
    endTime: '17:00',
    chronotype: 'Bear',
    timezone: 'Australia/Sydney',
  },
  tasks,
});

test('findTaskReference locates tasks across spaces and task lists', () => {
  const data = validateLibrary({
    ...emptyLibrary(),
    spaces: [space('space-1', [task('t1')]), space('space-2', [])],
    taskLists: [
      {
        id: 'list-1',
        name: 'Sprint',
        spaceId: 'space-2',
        createdAt: '2026-09-10T00:00:00Z',
        tasks: [task('t2')],
      },
    ],
  });

  const ref1 = findTaskReference(data, 't1');
  assert.deepEqual(ref1, { spaceId: 'space-1', taskId: 't1' });

  const ref2 = findTaskReference(data, 't2');
  assert.deepEqual(ref2, {
    spaceId: 'space-2',
    listId: 'list-1',
    taskId: 't2',
  });

  const missing = findTaskReference(data, 'non-existent');
  assert.equal(missing, null);
});

test('updateTimeblockTask updates task fields within timeblock and syncs with space and liveTimer', () => {
  const t1 = task('t1', 'Initial Task 1');
  const t2 = task('t2', 'Initial Task 2');
  const liveTimer: Timer = {
    id: 'tb1',
    name: 'Timeblock tb1',
    timezone: 'Australia/Sydney',
    startedAt: '2026-09-10T09:00:00Z',
    endsAt: '2026-09-10T10:00:00Z',
    blocks: [
      {
        id: 'b1',
        taskId: 't1',
        taskName: 'Initial Task 1',
        start: '2026-09-10T09:00:00Z',
        end: '2026-09-10T09:30:00Z',
        isBreak: false,
        energyRequired: 3,
      },
      {
        id: 'b2',
        taskId: 't2',
        taskName: 'Initial Task 2',
        start: '2026-09-10T09:30:00Z',
        end: '2026-09-10T10:00:00Z',
        isBreak: false,
        energyRequired: 3,
      },
    ],
  };

  const initial = validateLibrary({
    ...emptyLibrary(),
    spaces: [space('home', [t1])],
    taskLists: [
      {
        id: 'list-1',
        name: 'List 1',
        spaceId: 'home',
        createdAt: '2026-09-10T00:00:00Z',
        tasks: [t2],
      },
    ],
    timeblocks: [timeblock('tb1', [t1, t2])],
    liveTimer,
  });

  const updated = updateTimeblockTask(initial, 'tb1', 't1', {
    name: 'Updated Task 1',
    energyRequired: 5,
    durationMinutes: 45,
    completed: true,
  });

  // 1. Timeblock task is updated
  const tbTask = updated.timeblocks[0].tasks.find((t) => t.id === 't1');
  assert.equal(tbTask?.name, 'Updated Task 1');
  assert.equal(tbTask?.energyRequired, 5);
  assert.equal(tbTask?.durationMinutes, 45);
  assert.equal(tbTask?.completed, true);

  // 2. Space task is synchronized
  const spaceTask = updated.spaces![0].tasks.find((t) => t.id === 't1');
  assert.equal(spaceTask?.name, 'Updated Task 1');
  assert.equal(spaceTask?.energyRequired, 5);
  assert.equal(spaceTask?.durationMinutes, 45);
  assert.equal(spaceTask?.completed, true);

  // 3. Live timer blocks are synchronized
  const liveBlock = updated.liveTimer?.blocks.find((b) => b.taskId === 't1');
  assert.equal(liveBlock?.taskName, 'Updated Task 1');
  assert.equal(liveBlock?.energyRequired, 5);

  // 4. Untouched task remains unchanged
  const tbTask2 = updated.timeblocks[0].tasks.find((t) => t.id === 't2');
  assert.equal(tbTask2?.name, 'Initial Task 2');
  assert.equal(tbTask2?.energyRequired, 3);
});

test('updateTimeblockTask cleanly updates tasks not tied to an existing space', () => {
  const adhocTask = task('adhoc-99', 'Adhoc Task');
  const initial = validateLibrary({
    ...emptyLibrary(),
    spaces: [space('home', [])],
    timeblocks: [timeblock('tb-adhoc', [adhocTask])],
  });

  const updated = updateTimeblockTask(initial, 'tb-adhoc', 'adhoc-99', {
    name: 'Renamed Adhoc',
    energyRequired: 1,
    priority: 1,
  });

  const tbTask = updated.timeblocks[0].tasks[0];
  assert.equal(tbTask.name, 'Renamed Adhoc');
  assert.equal(tbTask.energyRequired, 1);
  assert.equal(tbTask.priority, 1);
  assert.equal(updated.spaces![0].tasks.length, 0);
});

test('updateTask from Tasks panel synchronizes across all containing timeblocks and liveTimer', () => {
  const t1 = task('shared-task', 'Original Shared Name');
  const liveTimer: Timer = {
    id: 'live-tb',
    name: 'Live Timeblock',
    timezone: 'Australia/Sydney',
    startedAt: '2026-09-10T09:00:00Z',
    endsAt: '2026-09-10T10:00:00Z',
    blocks: [
      {
        id: 'block-st',
        taskId: 'shared-task',
        taskName: 'Original Shared Name',
        start: '2026-09-10T09:00:00Z',
        end: '2026-09-10T10:00:00Z',
        isBreak: false,
        energyRequired: 3,
      },
    ],
  };

  const initial = validateLibrary({
    ...emptyLibrary(),
    spaces: [space('work', [t1])],
    timeblocks: [
      timeblock('tb-morning', [t1]),
      timeblock('tb-afternoon', [t1]),
    ],
    liveTimer,
  });

  const updated = updateTask(
    initial,
    { spaceId: 'work', taskId: 'shared-task' },
    { name: 'Updated Across All', energyRequired: 4, durationMinutes: 60 }
  );

  // Space task updated
  assert.equal(updated.spaces![0].tasks[0].name, 'Updated Across All');
  assert.equal(updated.spaces![0].tasks[0].energyRequired, 4);
  assert.equal(updated.spaces![0].tasks[0].durationMinutes, 60);

  // Both timeblocks updated
  assert.equal(
    updated.timeblocks[0].tasks[0].name,
    'Updated Across All'
  );
  assert.equal(
    updated.timeblocks[1].tasks[0].name,
    'Updated Across All'
  );
  assert.equal(updated.timeblocks[0].tasks[0].energyRequired, 4);
  assert.equal(updated.timeblocks[1].tasks[0].energyRequired, 4);

  // Live timer synchronized
  assert.equal(
    updated.liveTimer?.blocks[0].taskName,
    'Updated Across All'
  );
  assert.equal(updated.liveTimer?.blocks[0].energyRequired, 4);
});

test('updateTimeblockTask throws descriptive errors when timeblock or task is missing', () => {
  const data = validateLibrary({
    ...emptyLibrary(),
    timeblocks: [timeblock('tb-valid', [task('t1')])],
  });

  assert.throws(
    () => updateTimeblockTask(data, 'tb-nonexistent', 't1', { name: 'New' }),
    /This timeblock no longer exists\./
  );

  assert.throws(
    () => updateTimeblockTask(data, 'tb-valid', 't-ghost', { name: 'New' }),
    /This task is not part of the timeblock\./
  );
});


import type { RhythmLibrary } from './library';
import { timerPosition, type LiveTimer } from './live-timer';
import type { ScheduleBlock, Task } from './types';

export interface InsertItemParams {
  title: string;
  durationMinutes: number;
  isBreak: boolean;
  anchorId: string;
  position: 'before' | 'after';
  energyRequired?: number;
}

/**
 * Insert a task or break into an active LiveTimer, reflowing all future blocks
 * and adjusting the timebox end without modifying past history.
 */
export function insertItemIntoTimer(timer: LiveTimer, params: InsertItemParams, now: number): LiveTimer {
  const title = params.title.trim();
  const durationMinutes = Math.max(1, Math.round(params.durationMinutes));
  if (!title || !timer.blocks.length) return timer;

  const blocks = [...timer.blocks];
  const { activeIndex } = timerPosition(blocks, now);

  // Locate the anchor block
  let anchorIndex = blocks.findIndex(b => b.id === params.anchorId || b.taskId === params.anchorId);
  if (anchorIndex === -1) {
    anchorIndex = activeIndex >= 0 ? activeIndex : blocks.length - 1;
  }

  let insertIndex = params.position === 'after' ? anchorIndex + 1 : anchorIndex;

  // Constraint (Req 12): Never insert into completed history.
  // If active block is running and anchor is active block, insertion before it would be in the past.
  if (activeIndex >= 0) {
    if (insertIndex <= activeIndex && Date.parse(blocks[activeIndex].start) < now) {
      insertIndex = activeIndex + 1;
    }
  } else {
    // If no active index, find first future block
    const firstFutureIndex = blocks.findIndex(b => Date.parse(b.end) > now);
    if (firstFutureIndex >= 0 && insertIndex < firstFutureIndex) {
      insertIndex = firstFutureIndex;
    }
  }

  insertIndex = Math.max(0, Math.min(blocks.length, insertIndex));

  const durationMs = durationMinutes * 60000;
  const newBlockId = `live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newTaskId = params.isBreak ? `break-${newBlockId}` : `task-${newBlockId}`;

  let insertStartMs: number;
  if (insertIndex === 0) {
    insertStartMs = Date.parse(timer.startedAt ?? blocks[0].start);
  } else {
    insertStartMs = Date.parse(blocks[insertIndex - 1].end);
  }
  const insertEndMs = insertStartMs + durationMs;

  const newBlock: ScheduleBlock = {
    id: newBlockId,
    taskId: newTaskId,
    taskName: title,
    start: new Date(insertStartMs).toISOString(),
    end: new Date(insertEndMs).toISOString(),
    isBreak: params.isBreak,
    energyRequired: params.energyRequired ?? (params.isBreak ? 1 : 3),
  };

  const updatedBlocks: ScheduleBlock[] = [];
  for (let i = 0; i < insertIndex; i++) {
    updatedBlocks.push(blocks[i]);
  }
  updatedBlocks.push(newBlock);
  for (let i = insertIndex; i < blocks.length; i++) {
    const b = blocks[i];
    updatedBlocks.push({
      ...b,
      start: new Date(Date.parse(b.start) + durationMs).toISOString(),
      end: new Date(Date.parse(b.end) + durationMs).toISOString(),
    });
  }

  const currentEndsAt = Date.parse(timer.endsAt ?? blocks[blocks.length - 1].end);
  const newEndsAt = new Date(currentEndsAt + durationMs).toISOString();

  return {
    ...timer,
    endsAt: newEndsAt,
    blocks: updatedBlocks,
  };
}

/**
 * Persists a live timer task or break insertion into the Rhythm library.
 */
export function insertLiveTimerItem(
  data: RhythmLibrary,
  timerId: string,
  params: InsertItemParams,
  now: number
): RhythmLibrary {
  if (!data.liveTimer || data.liveTimer.id !== timerId) {
    throw new Error('This live timer has changed. Reopen it and try again.');
  }

  const liveTimer = insertItemIntoTimer(data.liveTimer, params, now);
  if (liveTimer === data.liveTimer) return data;

  if (params.isBreak) {
    return { ...data, liveTimer };
  }

  // Find the inserted task block to mirror into the workspace
  const insertedBlock = liveTimer.blocks.find(b => !data.liveTimer!.blocks.some(prev => prev.id === b.id));
  if (!insertedBlock) return { ...data, liveTimer };

  const newTask: Task = {
    id: insertedBlock.taskId,
    name: insertedBlock.taskName,
    durationMinutes: params.durationMinutes,
    energyRequired: (params.energyRequired ?? 3) as Task['energyRequired'],
    priority: 1,
  };

  const spaces = data.spaces?.map((space, i) =>
    i === 0 ? { ...space, tasks: [...space.tasks, newTask] } : space
  );

  const timeblocks = data.timeblocks?.map(block =>
    block.name === liveTimer.name ? { ...block, tasks: [...block.tasks, newTask] } : block
  );

  return {
    ...data,
    liveTimer,
    spaces: spaces ?? data.spaces,
    timeblocks: timeblocks ?? data.timeblocks,
  };
}

/**
 * Reorder blocks within a running timer by moving a block from one index to another.
 * Recalculates all start/end times while preserving durations.
 * Does not allow reordering completed blocks (those before the current active block).
 */
export function reorderTimerBlocks(
  timer: LiveTimer,
  fromIndex: number,
  toIndex: number,
  now: number
): LiveTimer {
  const blocks = [...timer.blocks];
  if (!blocks.length || fromIndex === toIndex) return timer;
  if (fromIndex < 0 || fromIndex >= blocks.length || toIndex < 0 || toIndex >= blocks.length) return timer;

  const { activeIndex, nextIndex, phase } = timerPosition(blocks, now);
  if (phase === 'complete') return timer;

  const minMovableIndex = activeIndex >= 0 ? activeIndex + 1 : (nextIndex >= 0 ? nextIndex : 0);
  if (fromIndex < minMovableIndex || toIndex < minMovableIndex) {
    return timer;
  }

  const [movedBlock] = blocks.splice(fromIndex, 1);
  blocks.splice(toIndex, 0, movedBlock);

  const startIndex = Math.min(fromIndex, toIndex);
  for (let i = startIndex; i < blocks.length; i++) {
    const b = blocks[i];
    const duration = Date.parse(b.end) - Date.parse(b.start);
    const startMs = i === 0
      ? Date.parse(timer.startedAt ?? blocks[0].start)
      : Date.parse(blocks[i - 1].end);
    
    blocks[i] = {
      ...b,
      start: new Date(startMs).toISOString(),
      end: new Date(startMs + duration).toISOString(),
    };
  }

  const endsAt = blocks[blocks.length - 1]?.end ?? timer.endsAt;

  return {
    ...timer,
    blocks,
    endsAt,
  };
}

/**
 * Persists live timer block reordering into the Rhythm library.
 */
export function reorderLiveTimer(
  data: RhythmLibrary,
  timerId: string,
  fromIndex: number,
  toIndex: number,
  now: number
): RhythmLibrary {
  if (!data.liveTimer || data.liveTimer.id !== timerId) {
    throw new Error('This live timer has changed. Reopen it and try again.');
  }

  const liveTimer = reorderTimerBlocks(data.liveTimer, fromIndex, toIndex, now);
  return { ...data, liveTimer };
}


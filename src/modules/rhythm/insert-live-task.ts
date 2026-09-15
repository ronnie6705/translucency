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

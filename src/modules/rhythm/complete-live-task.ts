import { mutationCommand, recordTaskOutcome, recordBreakOutcome, type RunCommand } from './timeblock-run';
import type { RhythmLibrary } from './library';
import { completeTimerTask, type TimerTaskOutcome } from './live-timer';
import type { Task } from './types';

/** One existing library transaction saves both the timer budget and task completion. */
export function completeLiveTask(data: RhythmLibrary, timerId: string, taskId: string, now: number, outcome: TimerTaskOutcome = 'completed', command?: RunCommand): RhythmLibrary {
  if (!data.liveTimer || data.liveTimer.id !== timerId) throw new Error('This live timer has changed. Reopen it and try again.');
  const liveTimer = completeTimerTask(data.liveTimer, taskId, now, outcome);
  if (liveTimer === data.liveTimer) return data;
  const rest = data.liveTimer.blocks.find(b => b.isBreak && (b.id===taskId || b.taskId===taskId));
  if (rest) return {...recordBreakOutcome(data,data.liveTimer,liveTimer,rest.id,outcome,now,command ?? mutationCommand(data.liveTimer,`break:${rest.id}`,now)),liveTimer};
  data = recordTaskOutcome(data, data.liveTimer, liveTimer, taskId, outcome, now, command ?? mutationCommand(data.liveTimer, `outcome:${taskId}`, now));
  if (outcome === 'skipped') return { ...data, liveTimer };
  const complete = (tasks: Task[]) => tasks.map(task => task.id === taskId ? { ...task, completed: true } : task);
  return {
    ...data,
    liveTimer,
    spaces: data.spaces?.map(space => ({ ...space, tasks: complete(space.tasks) })),
    taskLists: data.taskLists.map(list => ({ ...list, tasks: complete(list.tasks) })),
    timeblocks: data.timeblocks.map(block => ({ ...block, tasks: complete(block.tasks) })),
  };
}

import { replanTimerRecovery } from './recovery/recovery-timer';
import { rebudgetRemainingTimer, type LiveTimer } from './live-timer';
import type { RhythmLibrary } from './library';
import { hasRunCommand, mutationCommand, recordScheduleChange, type RunCommand } from './timeblock-run';

export function adjustTimerTimeWindow(timer: LiveTimer, newEndTime: string, now: number): LiveTimer {
  const end = Date.parse(newEndTime);
  const start = Date.parse(timer.startedAt ?? timer.blocks[0]?.start);
  if (!Number.isFinite(now) || !Number.isFinite(end) || end <= Math.max(now,start)) throw new Error('Choose an end time after the current time and session start.');
  const oldEnd = timer.endsAt ?? timer.blocks.at(-1)?.end;
  if (end === Date.parse(oldEnd!)) return timer;
  if (timer.breakPreferences) {
    const active = timer.blocks.find(b => Date.parse(b.start)<now && Date.parse(b.end)>now);
    if (active && Date.parse(active.end)>end) throw new Error('The end time must preserve the active block.');
    if (timer.blocks.some(b => (b.isFixed || b.isBreak && !b.recovery) && Date.parse(b.end)>end)) throw new Error('The end time must preserve planned breaks and fixed appointments.');
    return replanTimerRecovery({...timer,endsAt:new Date(end).toISOString()},now,60_000);
  }
  const eligible = timer.blocks.filter(b=>!b.isBreak && !b.isFixed && Date.parse(b.end)>now && !timer.completedTaskIds?.includes(b.taskId) && !timer.skippedTaskIds?.includes(b.taskId));
  if (!eligible.length) throw new Error('There is no remaining work to resize.');
  const breaks = timer.blocks.filter(b=>(b.isBreak || b.isFixed) && Date.parse(b.end)>now);
  if (breaks.some(b=>Date.parse(b.end)>end)) throw new Error('The end time must leave all remaining breaks and fixed appointments intact.');
  const available = end - Math.max(now,start) - breaks.reduce((sum,b)=>sum+Date.parse(b.end)-Math.max(now,Date.parse(b.start)),0);
  const count = eligible.reduce((sum,block,index)=>sum + (index === 0 || eligible[index-1].taskId !== block.taskId ? 1 : 0),0);
  if (available < count * 60_000) throw new Error('Allow at least one minute per remaining task, plus scheduled breaks.');
  const active = timer.blocks.find(b => Date.parse(b.start)<now && Date.parse(b.end)>now);
  if (active && Date.parse(active.end)>end) throw new Error('The end time must preserve the active block.');
  const input = active ? {...timer,blocks:timer.blocks.map(b => b.id===active.id ? {...b,isFixed:true} : b)} : timer;
  const resized = rebudgetRemainingTimer({...input,endsAt:new Date(end).toISOString()},now,60_000);
  const result = active ? {...resized,blocks:resized.blocks.map(b => b.id===active.id ? active : b)} : resized;
  if (result.blocks.some(b=>Date.parse(b.end)<=Date.parse(b.start))) throw new Error('This time window cannot safely hold the remaining work.');
  return result;
}
export function updateLiveTimerTimeWindow({ library, timerId, newEndTime, now, command }: { library: RhythmLibrary; timerId: string; newEndTime: string; now: number; command?: RunCommand }): RhythmLibrary {
  const before = library.liveTimer;
  if (!before || before.id !== timerId) throw new Error('This live timer has changed. Reopen it and try again.');
  command ??= mutationCommand(before,'time-window-change',now);
  if (hasRunCommand(library,before,command)) return library;
  const liveTimer = adjustTimerTimeWindow(before,newEndTime,now);
  if (liveTimer === before) return library;
  return {...recordScheduleChange(library,before,liveTimer,'time-window-change',now,command),liveTimer};
}

import type { LiveTimer } from '../live-timer';
import { rebudgetTimerWork } from '../live-timer';
import { blockMinutes, placeOrderedBlocks } from '../schedule-placement';
import { planRecovery } from './recovery-planner';
import type { ScheduleBlock } from '../types';

/** Rebudget future work only. Historical and active blocks are immutable inputs. */
export function replanTimerRecovery(timer: LiveTimer, now: number, minimum = 1): LiveTimer {
  if (!timer.breakPreferences || !timer.blocks.length) return rebudgetTimerWork(timer,now,minimum);
  const end = Date.parse(timer.endsAt ?? timer.blocks.at(-1)!.end);
  const frozen = timer.blocks.filter(b => Date.parse(b.start) < now);
  const active = frozen.find(b => Date.parse(b.end)>now);
  const start = Math.max(now,active ? Date.parse(active.end) : Date.parse(timer.startedAt ?? timer.blocks[0].start));
  if (start >= end) return timer;
  const future = timer.blocks.filter(b => Date.parse(b.start)>=now && !b.recovery);
  // Existing planned breaks keep their accepted instants during execution.
  const fixed = future.map(b => b.isBreak ? {...b,isFixed:true} : b);
  const prefix = frozen.map(({recovery,...block}) => ({...block,isFixed:true}));
  const planningStart = prefix.length ? Date.parse(prefix[0].start) : start;
  const finalize = (blocks: ScheduleBlock[]) => {
    const original = new Map(future.map(b => [b.id,b]));
    const frozenIds = new Set(frozen.map(b => b.id));
    const futureBlocks = blocks.filter(b => !frozenIds.has(b.id)).map(b => original.get(b.id)?.isBreak && !original.get(b.id)?.isFixed ? {...b,isFixed:original.get(b.id)?.isFixed} : b);
    return {...timer,blocks:[...frozen,...futureBlocks].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))};
  };
  if (!future.some(b => !b.isBreak && !b.isFixed)) {
    const result = planRecovery([...prefix,...fixed],timer.breakPreferences,planningStart,end,start);
    if (result.status==='invalid') throw new Error(result.errors[0]);
    return finalize(result.blocks);
  }
  const compact = placeOrderedBlocks(fixed,start,Infinity);
  const seed = compact.error ? fixed : compact.blocks;
  const desired = planRecovery([...prefix,...seed],timer.breakPreferences,planningStart,Math.max(end,...seed.map(b => Date.parse(b.end)))+86400000,start);
  let reserve = desired.blocks.filter(b => b.recovery).reduce((n,b) => n+blockMinutes(b)*60000,0);
  const protectedMinutes = desired.blocks.filter(b => b.recovery?.source==='manual-override').reduce((n,b) => n+blockMinutes(b)*60000,0);
  const commitments = fixed.filter(b => b.isFixed);
  if (commitments.some(b => Date.parse(b.end)>end)) throw new Error('The time window must preserve planned breaks and fixed appointments.');
  const available = end-start-commitments.reduce((n,b) => n+blockMinutes(b)*60000,0);
  const count = fixed.filter(b => !b.isFixed).length;
  if (available < count*minimum+protectedMinutes) throw new Error('Allow time for remaining work and protected recovery breaks.');
  // Reserve recovery before proportional redistribution, otherwise work fills every minute.
  // A temporary end marker is consumed only by the existing budget allocator, never saved.
  const allocate = (reserve: number) => {
    const budget = Math.min(reserve,Math.max(0,available-count*minimum));
    const reservations: ScheduleBlock[] = [];
    let remaining = budget;
    let cursor = end;
    for (const commitment of [...commitments].sort((a,b)=>Date.parse(b.start)-Date.parse(a.start))) {
      const gap = Math.max(0,cursor-Date.parse(commitment.end));
      const take = Math.min(remaining,gap);
      if (take>0) reservations.push(marker(cursor-take,cursor,reservations.length));
      remaining-=take; cursor=Date.parse(commitment.start);
    }
    if (remaining>0) reservations.push(marker(cursor-remaining,cursor,reservations.length));
    const budgeted = rebudgetTimerWork({...timer,startedAt:new Date(start).toISOString(),blocks:[...fixed,...reservations].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))},start,minimum);
    const work = budgeted.blocks.filter(b => !b.id.startsWith('__recovery-reserve:'));
    return placeOrderedBlocks(work,start,end);
  };
  let ordered = allocate(reserve);
  // Recompute the reservation as resized tasks cross focus boundaries. Bounded
  // passes avoid oscillation; the planner can still reduce optional recovery.
  for (let pass=0;pass<4 && !ordered.error;pass++) {
    const demand = planRecovery([...prefix,...ordered.blocks],timer.breakPreferences,planningStart,end+86400000,start);
    const required = demand.blocks.filter(b => b.recovery).reduce((n,b)=>n+blockMinutes(b)*60000,0);
    if (required <= reserve) break;
    reserve = required;
    ordered = allocate(reserve);
  }
  if (ordered.error) throw new Error(ordered.error);
  const planned = planRecovery([...prefix,...ordered.blocks],timer.breakPreferences,planningStart,end,start);
  if (planned.status==='invalid') throw new Error(planned.errors[0]);
  return finalize(planned.blocks);
}
function marker(start: number,end: number,index:number): ScheduleBlock {
  return {id:`__recovery-reserve:${index}`,taskId:`__recovery-reserve:${index}`,taskName:'',isBreak:true,isFixed:true,start:new Date(start).toISOString(),end:new Date(end).toISOString()};
}

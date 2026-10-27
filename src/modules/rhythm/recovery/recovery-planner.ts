import type { DayConfig, ScheduleBlock, Task } from '../types';
import { generateSchedule } from '../rhythmScheduler';
import { validateSchedule } from '../schedule-validation';
import { blockMinutes, placeOrderedBlocks, sliceScheduleBlock } from '../schedule-placement';
import { createDateInTimeZone } from '../utils/timezone';
import { BREAK_PRESETS, MIN_MEANINGFUL_BREAK_MINUTES, NATURAL_BOUNDARY_GRACE_MINUTES, PLANNED_BREAK_DEFERRAL_MINUTES, recoveryLoad } from './recovery-presets';
import { anchorKey, defaultBreakPreferences, type BreakPreferences, type RecoveryAnchor } from './recovery-types';

export interface SchedulingResult {
  status: 'valid' | 'adjusted-recovery' | 'invalid';
  blocks: ScheduleBlock[];
  baseSchedule: ScheduleBlock[];
  errors: string[];
  notices: string[];
  inactiveOverrideKeys: string[];
  /** Desired recovery after overrides, before capacity reduction. */
  recommendedRecoveryMinutes: number;
  scheduledRecoveryMinutes: number;
  recoveryShortfallMinutes: number;
}
/** Split through the same primitive as capacity recovery. Never split fixed work or planned breaks. */
function recoverySegments(base: ScheduleBlock[], preferences: BreakPreferences, origins: Map<string,string>): ScheduleBlock[] {
  const preset = preferences.preset === 'none' ? undefined : BREAK_PRESETS[preferences.preset];
  const offsets = new Map<string, number>();
  return base.flatMap(block => {
    const offset = block.workOffsetMinutes ?? offsets.get(block.taskId) ?? 0;
    const minutes = blockMinutes(block);
    offsets.set(block.taskId, offset + minutes);
    const boundaries = new Set<number>([0, minutes]);
    if (!block.isBreak && !block.isFixed && preset) {
      for (const override of preferences.overrides) {
        const at = override.anchor.offsetMinutes - offset;
        if (!override.anchor.atTaskEnd && override.anchor.taskId === block.taskId && at > 0 && at < minutes) boundaries.add(at);
      }
      // Existing short tasks stay whole; split only work beyond the soft maximum.
      const chunk = preset.splittingPreference === 'avoid' ? preset.maxContinuousWorkMinutes : preset.targetWorkMinutes;
      let cursor = 0;
      while (minutes - cursor > preset.maxContinuousWorkMinutes) { cursor += chunk; boundaries.add(cursor); }
    }
    const cuts = [...boundaries].sort((a,b) => a-b);
    return cuts.slice(0,-1).map((at, i) => {
      const id = at === 0 ? block.id : `${block.id}-recovery-${offset+at}`;
      origins.set(id,block.id);
      return {...sliceScheduleBlock(block,at,cuts[i+1]-at,id),workOffsetMinutes:offset+at};
    });
  });
}

/** Pure recovery policy. Placement remains in the shared scheduler placement layer. */
export function planRecovery(baseSchedule: ScheduleBlock[], preferences: BreakPreferences, start: number, end: number, recoveryAfter = start): SchedulingResult {
  const base = baseSchedule.filter(b => !b.recovery);
  const origins = new Map<string,string>();
  const joinUnusedSplits = (blocks: ScheduleBlock[]) => {
    const joined: ScheduleBlock[] = [];
    for (const block of blocks) {
      const previous = joined.at(-1);
      if (previous && !block.isBreak && !previous.isBreak && origins.get(block.id) !== undefined && origins.get(block.id) === origins.get(previous.id) && block.start === previous.end) joined[joined.length-1] = {...previous,end:block.end};
      else joined.push(block);
    }
    return joined;
  };
  let recommendedRecoveryMinutes = 0;
  const result = (blocks: ScheduleBlock[], status: SchedulingResult['status'], errors: string[] = [], notices: string[] = [], inactiveOverrideKeys: string[] = []): SchedulingResult => ({ blocks:status==='invalid' ? blocks : joinUnusedSplits(blocks), status, errors, notices, inactiveOverrideKeys, baseSchedule: base, recommendedRecoveryMinutes, scheduledRecoveryMinutes: blocks.reduce((n,b) => n + (b.recovery ? blockMinutes(b) : 0),0), recoveryShortfallMinutes: Math.max(0,recommendedRecoveryMinutes - blocks.reduce((n,b) => n + (b.recovery ? blockMinutes(b) : 0),0)) });
  if (preferences.preset === 'none') {
    const placed = placeOrderedBlocks(base, start, end, true);
    return result(placed.blocks, placed.error ? 'invalid' : 'valid', placed.error ? [placed.error] : []);
  }
  const preset = BREAK_PRESETS[preferences.preset];
  const segments = recoverySegments(base, preferences, origins);
  const taskEnds = new Map<string,number>();
  segments.forEach(b => {if (!b.isBreak) taskEnds.set(b.taskId,Math.max(taskEnds.get(b.taskId) ?? 0,(b.workOffsetMinutes ?? 0)+blockMinutes(b)));});
  const overrides = new Map(preferences.overrides.map(o => [anchorKey(o.anchor),o]));
  const active = new Set<string>();
  const candidates: ScheduleBlock[] = [];
  let work = 0, load = 0, previousEnd = start;
  let missedTarget = false;
  for (let index = 0; index < segments.length; index++) {
    const block = segments[index];
    const minutes = blockMinutes(block);
    if ((Date.parse(block.start)-previousEnd)/60000 >= MIN_MEANINGFUL_BREAK_MINUTES) { work=0; load=0; }
    const effectiveStart = block.isFixed ? Date.parse(block.start) : Math.max(previousEnd,Date.parse(block.start));
    previousEnd = effectiveStart + minutes*60000;
    candidates.push(block);
    if (block.isBreak) { if (minutes >= MIN_MEANINGFUL_BREAK_MINUTES) { work=0; load=0; } continue; }
    work += minutes;
    load += recoveryLoad(minutes,block.energyRequired,preset.energySensitivity);
    if (work > preset.maxContinuousWorkMinutes) missedTarget = true;
    const next = segments[index+1];
    if (previousEnd < recoveryAfter) continue;
    const offsetMinutes = (block.workOffsetMinutes ?? 0)+minutes;
    const anchor: RecoveryAnchor = {taskId:block.taskId, offsetMinutes, ...(offsetMinutes===taskEnds.get(block.taskId) ? {atTaskEnd:true} : {})};
    const key = anchorKey(anchor);
    const offsetKey = anchorKey({...anchor,atTaskEnd:undefined});
    const override = overrides.get(key) ?? overrides.get(offsetKey);
    // A final boundary has no upcoming work to recover for. Keep its override dormant.
    if (!next || !segments.slice(index+1).some(b => !b.isBreak)) continue;
    if (override) active.add(anchorKey(override.anchor));
    if (override?.removed) continue;
    const gap = (Date.parse(next.start)-previousEnd)/60000;
    const nextIsRest = next.isBreak && blockMinutes(next) >= MIN_MEANINGFUL_BREAK_MINUTES;
    const plannedBreak = segments.slice(index+1).find(b => b.isBreak && blockMinutes(b) >= MIN_MEANINGFUL_BREAK_MINUTES);
    const untilRest = plannedBreak ? Math.max(0,(Date.parse(plannedBreak.start)-previousEnd)/60000) : Infinity;
    const deferRest = untilRest <= PLANNED_BREAK_DEFERRAL_MINUTES && work+untilRest <= preset.maxContinuousWorkMinutes;
    const deferShortTask = !next.isBreak && blockMinutes(next) <= NATURAL_BOUNDARY_GRACE_MINUTES && work+blockMinutes(next) <= preset.maxContinuousWorkMinutes;
    const due = load >= preset.recoveryThreshold || work >= preset.targetWorkMinutes || work+(!next.isBreak ? blockMinutes(next) : 0) > preset.maxContinuousWorkMinutes;
    // Manual duration overrides remain protected even if recovery is no longer due.
    if (!override?.durationMinutes && (!due || gap >= MIN_MEANINGFUL_BREAK_MINUTES || nextIsRest || deferRest || deferShortTask)) continue;
    const duration = override?.durationMinutes ?? (load >= preset.longBreakThreshold ? preset.longBreakMinutes : preset.shortBreakMinutes);
    candidates.push({ id:`recovery-${key}`, taskId:`recovery-${key}`, taskName:'Recovery Break', isBreak:true,
      start:new Date(previousEnd).toISOString(), end:new Date(previousEnd+duration*60000).toISOString(),
      recovery:{anchor,source:override?.durationMinutes ? 'manual-override' : 'automatic'} });
    previousEnd += duration*60000;
    work=0; load=0;
  }
  recommendedRecoveryMinutes = candidates.reduce((n,b) => n + (b.recovery ? blockMinutes(b) : 0),0);
  const inactive = preferences.overrides.map(o => anchorKey(o.anchor)).filter(key => !active.has(key));
  const notices = missedTarget ? ['Some work exceeds your preferred focus duration to preserve commitments and task boundaries.'] : [];
  let placed = placeOrderedBlocks(candidates,start,end,true);
  if (!placed.error) return result(placed.blocks,'valid',[],notices,inactive);
  // Shorten only optional recovery; never change work or an explicit duration.
  let reduced = candidates.map(b => b.recovery?.source === 'automatic' && blockMinutes(b)>MIN_MEANINGFUL_BREAK_MINUTES ? sliceScheduleBlock(b,0,MIN_MEANINGFUL_BREAK_MINUTES) : b);
  placed = placeOrderedBlocks(reduced,start,end,true);
  // Bounded, deterministic omission. Try a single omission first to avoid unnecessary loss.
  while (placed.error) {
    const optional = reduced.filter(b => b.recovery?.source === 'automatic');
    if (!optional.length) break;
    const single = optional.map(b => reduced.filter(candidate => candidate.id !== b.id)).find(blocks => !placeOrderedBlocks(blocks,start,end,true).error);
    reduced = single ?? reduced.filter(b => b.id !== optional[0].id);
    placed = placeOrderedBlocks(reduced,start,end,true);
  }
  if (placed.error) return result(placed.blocks,'invalid',[placed.error],notices,inactive);
  return result(placed.blocks,'adjusted-recovery',[],['Recovery breaks reduced to fit your schedule.', ...notices],inactive);
}

/** Structured API; the existing generateSchedule signature and historical callers stay unchanged. */
export function generateScheduleResult(tasks: Task[], config: DayConfig, options: { preferences?: BreakPreferences; baseSchedule?: ScheduleBlock[] } = {}): SchedulingResult {
  const base = options.baseSchedule ?? generateSchedule(tasks,config);
  const validation = validateSchedule(tasks,config,base);
  if (!validation.valid) return {status:'invalid',blocks:base,baseSchedule:base,errors:[validation.message],notices:[],inactiveOverrideKeys:[],recommendedRecoveryMinutes:0,scheduledRecoveryMinutes:0,recoveryShortfallMinutes:0};
  const result = planRecovery(base, options.preferences ?? defaultBreakPreferences(), createDateInTimeZone(config.date,config.startTime,config.timezone).getTime(), createDateInTimeZone(config.date,config.endTime,config.timezone).getTime());
  const final = validateSchedule(tasks,config,result.blocks);
  return final.valid ? result : {...result,status:'invalid',errors:[...new Set([...result.errors,final.message])]};
}

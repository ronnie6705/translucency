import type { Chronotype, ScheduleBlock } from './types';
import type { EnergyCurve } from './energy-curve';
import { getChronotypeCurve, validateEnergyCurve } from './energy-curve';
import type { RhythmLibrary } from './library';
import type { LiveTimer } from './live-timer';

export type ScheduleChangeReason = 'completion' | 'skip' | 'insert' | 'reorder' | 'time-window-change';
export interface RunCommand { id: string; recordedAt: string }
/** Call before entering a retryable storage mutation. */
export function createRunCommand(): RunCommand { return { id: crypto.randomUUID(), recordedAt: new Date().toISOString() }; }
export interface SchedulePatch { removed: string[]; upsert: ScheduleBlock[]; order: string[]; oldEnd?: string; newEnd?: string }
type EventDetail = { type: 'task-completed' | 'task-skipped'; taskId: string; blockIds: string[]; outcome: 'completed' | 'skipped' }
  | { type: 'schedule-changed'; reason: ScheduleChangeReason; patch: SchedulePatch }
  | { type: 'session-ended'; reason: 'resolved' | 'replaced' };
export type RunEvent = EventDetail & { id: string; sequence: number; occurredAt: string; recordedAt: string; source: 'user' | 'system' | 'migration'; commandId: string };
export interface TimeblockRun {
  version: 1; id: string; timeblockId?: string; nameAtLaunch: string; timezone: string; launchedAt: string;
  historyCoverage: 'from-launch' | 'partial';
  initialPlan: { start: string; end: string; blocks: ScheduleBlock[]; energy?: { curve: EnergyCurve; source: { kind: 'chronotype'; chronotype: Chronotype } | { kind: 'learned'; profileId: string; revision: number } } };
  events: RunEvent[];
}
export function createTimeblockRun(timer: LiveTimer, chronotype: Chronotype, timeblockId?: string): TimeblockRun {
  return { version:1, id:crypto.randomUUID(), timeblockId, nameAtLaunch:timer.name, timezone:timer.timezone, launchedAt:new Date().toISOString(), historyCoverage:'from-launch', initialPlan:{start:timer.startedAt ?? timer.blocks[0].start,end:timer.endsAt ?? timer.blocks.at(-1)!.end,blocks:structuredClone(timer.blocks),energy:{curve:getChronotypeCurve(chronotype),source:{kind:'chronotype',chronotype}}}, events:[] };
}
function append(data: RhythmLibrary, timer: LiveTimer, detail: EventDetail, now: number, command: RunCommand, source: RunEvent['source'] = 'user'): RhythmLibrary {
  if (!timer.runId || !data.runs?.some(run => run.id === timer.runId)) return data;
  const id = `${command.id}:${detail.type}`;
  return { ...data, runs: data.runs.map(run => run.id !== timer.runId || run.events.some(event => event.id === id || detail.type === 'session-ended' && event.type === 'session-ended') ? run : {
    ...run, events:[...run.events,{...detail,id,sequence:(run.events.at(-1)?.sequence ?? 0)+1,occurredAt:new Date(now).toISOString(),recordedAt:command.recordedAt,source,commandId:command.id}],
  }) };
}
export function launchTimeblockRun(data: RhythmLibrary, timer: LiveTimer, run: TimeblockRun): RhythmLibrary {
  if (data.runs?.some(old => old.id === run.id)) return data;
  if (data.liveTimer) data = append(data,data.liveTimer,{type:'session-ended',reason:'replaced'},Date.parse(run.launchedAt),{id:`launch:${run.id}`,recordedAt:run.launchedAt},'system');
  return {...data,liveTimer:{...timer,runId:run.id},runs:[...(data.runs ?? []),run]};
}
/** Deterministic fallback keeps existing domain callers retry-safe without generating IDs in callbacks. */
export function mutationCommand(timer: LiveTimer, operation: string, now: number): RunCommand {
  return { id:`${timer.runId ?? timer.id}:${operation}:${now}`,recordedAt:new Date(now).toISOString() };
}
export function hasRunCommand(data: RhythmLibrary, timer: LiveTimer, command: RunCommand) {
  return data.runs?.find(run => run.id === timer.runId)?.events.some(event => event.commandId === command.id) ?? false;
}
export function recordScheduleChange(data: RhythmLibrary, before: LiveTimer, after: LiveTimer, reason: ScheduleChangeReason, now: number, command: RunCommand): RhythmLibrary {
  const upsert = after.blocks.filter(block => JSON.stringify(before.blocks.find(old => old.id === block.id)) !== JSON.stringify(block));
  const removed = before.blocks.filter(block => !after.blocks.some(next => next.id === block.id)).map(block => block.id);
  const orderChanged = before.blocks.map(b=>b.id).join() !== after.blocks.map(b=>b.id).join();
  if (!upsert.length && !removed.length && !orderChanged && before.endsAt === after.endsAt) return data;
  return append(data,before,{type:'schedule-changed',reason,patch:{upsert,removed,order:after.blocks.map(b=>b.id),oldEnd:before.endsAt,newEnd:after.endsAt}},now,command);
}
export function recordTaskOutcome(data: RhythmLibrary, before: LiveTimer, after: LiveTimer, taskId: string, outcome: 'completed' | 'skipped', now: number, command: RunCommand): RhythmLibrary {
  data = append(data,before,{type:outcome === 'completed' ? 'task-completed' : 'task-skipped',taskId,blockIds:before.blocks.filter(b=>b.taskId===taskId && !b.isBreak).map(b=>b.id),outcome},now,command);
  data = recordScheduleChange(data,before,after,outcome === 'completed' ? 'completion' : 'skip',now,command);
  if (!after.blocks.some(b=>!b.isBreak && Date.parse(b.end)>now)) data = append(data,before,{type:'session-ended',reason:'resolved'},now,command,'system');
  return data;
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const stamp = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x=>typeof x === 'string');
function blocks(v: unknown): v is ScheduleBlock[] {
  return Array.isArray(v) && v.every(b=>object(b) && typeof b.id==='string' && typeof b.taskId==='string' && typeof b.taskName==='string' && typeof b.isBreak==='boolean' && (b.energyRequired === undefined || Number.isFinite(b.energyRequired)) && stamp(b.start) && stamp(b.end) && Date.parse(String(b.end))>Date.parse(String(b.start)));
}
export function validateRuns(value: unknown): asserts value is TimeblockRun[] {
  const fail = (): never => { throw new Error('Invalid execution history in Rhythm backup.'); };
  if (!Array.isArray(value)) fail();
  const runs = value as unknown[];
  const ids = new Set<string>();
  for (const run of runs) {
    if (!object(run) || run.version!==1 || typeof run.id!=='string' || ids.has(run.id) || (run.timeblockId!==undefined && typeof run.timeblockId!=='string') || typeof run.nameAtLaunch!=='string' || typeof run.timezone!=='string' || !stamp(run.launchedAt) || !['from-launch','partial'].includes(String(run.historyCoverage)) || !object(run.initialPlan) || !Array.isArray(run.events)) fail();
    const r = run as unknown as TimeblockRun;
    ids.add(r.id);
    try { new Intl.DateTimeFormat('en',{timeZone:r.timezone}).format(); } catch { fail(); }
    if (!stamp(r.initialPlan.start) || !stamp(r.initialPlan.end) || Date.parse(r.initialPlan.end)<=Date.parse(r.initialPlan.start) || !blocks(r.initialPlan.blocks)) fail();
    if (r.initialPlan.energy!==undefined) {
      if (!object(r.initialPlan.energy)) fail();
      validateEnergyCurve(r.initialPlan.energy.curve);
      const source = r.initialPlan.energy.source;
      if (!object(source) || !(source.kind==='chronotype' && ['Lion','Bear','Wolf','Dolphin'].includes(String(source.chronotype)) || source.kind==='learned' && typeof source.profileId==='string' && Number.isInteger(source.revision) && Number(source.revision)>=0)) fail();
    }
    const eventIds = new Set<string>(); let sequence = 0;
    for (const event of r.events) {
      if (!object(event) || typeof event.id!=='string' || eventIds.has(event.id) || !Number.isInteger(event.sequence) || event.sequence<=sequence || !stamp(event.occurredAt) || !stamp(event.recordedAt) || !['user','system','migration'].includes(event.source) || typeof event.commandId!=='string') fail();
      eventIds.add(event.id); sequence=event.sequence;
      if (event.type==='task-completed' || event.type==='task-skipped') {
        if (typeof event.taskId!=='string' || !strings(event.blockIds) || event.outcome!==(event.type==='task-completed'?'completed':'skipped')) fail();
      } else if (event.type==='schedule-changed') {
        if (!['completion','skip','insert','reorder','time-window-change'].includes(event.reason) || !object(event.patch) || !strings(event.patch.removed) || !strings(event.patch.order) || !blocks(event.patch.upsert) || event.patch.oldEnd!==undefined && !stamp(event.patch.oldEnd) || event.patch.newEnd!==undefined && !stamp(event.patch.newEnd)) fail();
      } else if (event.type!=='session-ended' || !['resolved','replaced'].includes(event.reason)) fail();
    }
  }
}

/** Append-only histories merge by event identity; existing snapshots remain authoritative. */
export function mergeRuns(existing: TimeblockRun[], incoming: TimeblockRun[]): TimeblockRun[] {
  const merged = existing.map(run => {
    const added = incoming.find(other=>other.id===run.id);
    if (!added) return run;
    const events = [...run.events];
    for (const event of added.events) if (!events.some(old=>old.id===event.id || old.commandId===event.commandId && old.type===event.type)) events.push({...event,sequence:(events.at(-1)?.sequence ?? 0)+1});
    return {...run,events};
  });
  return [...merged,...incoming.filter(run=>!existing.some(old=>old.id===run.id))];
}

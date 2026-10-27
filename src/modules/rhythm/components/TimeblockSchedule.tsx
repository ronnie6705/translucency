import type { TimeAdjustments } from '../time-adjustments';
import { RecoveryPanel } from './RecoveryPanel';
import { setRecoveryOverride, type BreakPreferences as Preferences } from '../recovery/recovery-types';
import type { SchedulingResult } from '../recovery/recovery-planner';
import { validateTimeblockPlan } from '../timeblock-plan';
import { validateSchedule } from '../schedule-validation';
import { useState } from 'react';
import { requiredCapacityShortfall, type PlanningSnapshot } from '../planning-workspace';
import type { DayConfig, ScheduleBlock, Task } from '../types';
import { formatTaskDuration } from '../task-spaces';
import { scheduleSummary, workloadSummary } from '../workload';
import { ChronotypeSelector } from './ChronotypeSelector';
import type { CatalogSpace } from './PlanTaskCatalog';
import { FlowIcon } from './TimeblockWorkload';
import { ScheduleBlocks } from './ScheduleBlocks';

export function TimeblockSchedule({ preferences, onPreferencesChange, recovery, onUndo, canUndo, toast, onDismissToast, undoError, adjustments, onFlexibilityChange, lastValid, onConfigChange, onTasksChange, onCancelPending, blocks, tasks, spaces, config, onChronotype, onRegenerate, onScheduleChange, launch, exportCalendar, onLaunchChange, onExportChange, onFinish, busy }: {
  adjustments:TimeAdjustments; onFlexibilityChange(value:number):void;
  onUndo():void; canUndo:boolean; toast:string; onDismissToast():void; undoError:string;
  preferences: Preferences; onPreferencesChange(value: Preferences): void; recovery: SchedulingResult; lastValid: PlanningSnapshot | null; onConfigChange(config:DayConfig):void; onTasksChange(tasks:Task[]):void; onCancelPending():void;
  blocks: ScheduleBlock[]; tasks: Task[]; spaces: CatalogSpace[]; config: DayConfig;
  onChronotype(value: DayConfig['chronotype']): void; onRegenerate(): void; onScheduleChange(blocks: ScheduleBlock[]): void;
  launch: boolean; exportCalendar: boolean; onLaunchChange(value: boolean): void; onExportChange(value: boolean): void; onFinish(): void; busy: boolean;
}) {
  const summary = scheduleSummary(blocks);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const pending = recovery.status === 'invalid';
  const rangeValid = validateTimeblockPlan(tasks,config.startTime,config.endTime).validRange;
  const displayedConfig = pending ? lastValid?.config ?? config : config;
  const validation = validateSchedule(tasks, config, blocks);
  const requestedSummary = workloadSummary(tasks,config.startTime,config.endTime);
  const requiredShortfall = requiredCapacityShortfall({tasks,config,preferences});
  const pendingBreaks = pending ? tasks.filter(t=>t.plannedBreakAfterTaskId && (!lastValid?.tasks.some(old=>old.id===t.id) || !tasks.some(owner=>owner.id===t.plannedBreakAfterTaskId))) : [];
  const update = (id:string,patch:Partial<Task>)=>onTasksChange(tasks.map(t=>t.id===id ? {...t,...patch} : t));
  const remove = (id:string)=>onTasksChange(tasks.filter(t=>t.id!==id));
  const time = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: displayedConfig.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  const pendingDescriptions = pending && lastValid ? [
    ...(JSON.stringify(config)!==JSON.stringify(lastValid.config) ? [`Time window / profile: ${config.startTime}–${config.endTime}, ${config.timezone}, ${config.chronotype}`] : []),
    ...tasks.filter(t=>JSON.stringify(t)!==JSON.stringify(lastValid.tasks.find(old=>old.id===t.id))).map(t=>`${t.name}: ${formatTaskDuration(t.durationMinutes)}${t.fixedStart ? `, fixed at ${t.fixedStart}` : ''}`),
    ...lastValid.tasks.filter(t=>!tasks.some(next=>next.id===t.id)).map(t=>`${t.name}: removed from this timeblock`),
    ...(JSON.stringify(preferences)!==JSON.stringify(lastValid.preferences) ? ['Break preferences or recovery overrides changed'] : []),
  ] : [];
  return <>
    {toast && <div className="tb-adjustment-toast" role="status" aria-live="polite"><span className="tb-toast-icon"><img src="/rhythm/recovery/toast-stopwatch.svg" alt="" /></span><span className="tb-toast-message">{toast.split(/(\d+ minutes|\d+ tasks?)/g).map((part,index)=>/^\d+ (minutes|tasks?)$/.test(part)?<strong key={index}>{part}</strong>:part)}</span><button type="button" aria-label="Dismiss recovery notification" onClick={onDismissToast}><img src="/rhythm/recovery/toast-close.svg" alt="" /></button></div>}
    <section className="tb-schedule-panel live-timer-card" aria-label="Schedule preview">
      <div className="tb-schedule-toolbar"><div><h3>Today</h3><span>{new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${config.date}T12:00:00`))}</span></div><div>
        <button type="button" className="tb-small" onClick={() => { onRegenerate(); setMessage('Schedule regenerated using your current energy profile.'); }}><FlowIcon name="refresh" />Regenerate schedule</button>
        <button type="button" className="tb-small tb-icon-only" aria-label="Edit schedule order" aria-pressed={editing} onClick={() => setEditing(!editing)}><FlowIcon name="more" /></button></div></div>
      {pending && <div className="tb-capacity-notice" role="status">
        <strong>{requiredShortfall > 0 ? `At least ${formatTaskDuration(requiredShortfall)} more needed` : 'Your adjustment is pending'}</strong>
        <p>{blocks.length ? 'Showing the last valid arrangement. Requested changes have not been applied to this timeline.' : 'There is no valid arrangement yet.'}</p>
        <p>{recovery.errors.join(' ')}</p>
        {requiredShortfall > 0 && <p>Fixed commitments and task order may require more room than this minimum.</p>}
        {pendingDescriptions.length>0 && <ul aria-label="Pending changes">{pendingDescriptions.map((text,i)=><li key={i}>{text}</li>)}</ul>}

        {lastValid && <button type="button" className="tb-small" onClick={onCancelPending}>Cancel pending adjustments</button>}
        {pendingBreaks.map(task=><div className="tb-pending-break" key={task.id}>
          <strong>{task.name} · {formatTaskDuration(task.durationMinutes)} pending</strong>
          <label>Place after<select aria-label={`Position for ${task.name}`} value={tasks.some(t=>t.id===task.plannedBreakAfterTaskId) ? task.plannedBreakAfterTaskId : ''} onChange={e=>update(task.id,{plannedBreakAfterTaskId:e.target.value})}>
            <option value="" disabled>Choose a task boundary</option>{tasks.filter(t=>!t.isBreak).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select></label>
          <button type="button" className="tb-small" onClick={()=>remove(task.id)}>Cancel break</button>
        </div>)}
      </div>}
      <p className="tb-schedule-message" role="status">{message}</p>
      <ScheduleBlocks preferences={preferences} onOverride={(anchor, override) => onPreferencesChange(setRecoveryOverride(preferences,anchor,override))} blocks={blocks} tasks={tasks} config={displayedConfig} spaces={spaces} editing={editing} onChange={onScheduleChange} onMessage={setMessage}
        pending={pending} pendingBreak={pendingBreaks.length>0} onTaskUpdate={update} onTaskRemove={remove}
        onAddBreak={(id,minutes)=>onTasksChange([...tasks,{id:crypto.randomUUID(),name:'Planned break',durationMinutes:minutes,energyRequired:1,priority:2,isBreak:true,plannedBreakAfterTaskId:id}])} />

    </section>
    <aside className="tb-schedule-sidebar">
      <section className="tb-profile"><h3>Energy Profile</h3><p>Change to see a different schedule.</p><ChronotypeSelector value={config.chronotype} onChange={onChronotype} variant="schedule" /></section>
      <RecoveryPanel tasks={tasks} preferences={preferences} onPreferencesChange={onPreferencesChange} result={recovery} adjustments={adjustments} onFlexibilityChange={onFlexibilityChange} onUndo={onUndo} canUndo={canUndo} busy={busy} undoError={undoError}/>
      <section className="tb-schedule-summary"><h3>Schedule Summary</h3><p>{pending ? "Last valid timeline; requested capacity is shown separately." : "A quick overview of your planned day."}</p><dl>
        <div><dt>Available time{pending ? " (requested)" : ""}</dt><dd>{rangeValid ? formatTaskDuration(requestedSummary.available) : "Invalid range"}</dd></div>
        {pending && <div><dt>Required workload (requested)</dt><dd>{formatTaskDuration(requestedSummary.estimated)}</dd></div>}
        <div><dt><FlowIcon name="summary-file" />Tasks</dt><dd>{summary.count}</dd></div><div><dt><FlowIcon name="summary-duration" />Task Time</dt><dd>{formatTaskDuration(summary.work)}</dd></div>
        <div><dt><FlowIcon name="summary-break" />Planned breaks</dt><dd>{formatTaskDuration(summary.plannedBreaks)}</dd></div><div><dt>Total scheduled</dt><dd>{formatTaskDuration(summary.work+summary.breaks)}</dd></div><div><dt><FlowIcon name="summary-time" />Finish time</dt><dd>{summary.finish ? time(summary.finish) : '—'}</dd></div>
      </dl></section>
      <section className="tb-outputs"><h3>After scheduling</h3><p>Choose what you'd like to do with this schedule.</p>
        <label className={`tb-output${launch ? ' checked' : ''}`}><span className="tb-output-icon"><FlowIcon name="play" /></span><span><strong>Start Live Timer</strong><small>Open your schedule in focus mode with the Live Timer.</small></span><input type="checkbox" checked={launch} onChange={e => onLaunchChange(e.target.checked)} /><span className="tb-output-check" aria-hidden="true">{launch && <FlowIcon name="output-check" />}</span></label>
        <label className={`tb-output${exportCalendar ? ' checked' : ''}`}><span className="tb-output-icon"><FlowIcon name="calendar" /></span><span><strong>Export to Calendar</strong><small>Add today's schedule to your calendar (ICS file).</small></span><input type="checkbox" checked={exportCalendar} onChange={e => onExportChange(e.target.checked)} /><span className="tb-output-check" aria-hidden="true">{exportCalendar && <FlowIcon name="output-check" />}</span></label>
        <button type="button" className="tb-finish" disabled={busy || (!launch && !exportCalendar) || !validation.valid || recovery.status === 'invalid'} onClick={onFinish} aria-describedby="tb-output-status">{busy ? 'Saving…' : launch && exportCalendar ? 'Start & Export' : launch ? 'Start Live Timer' : 'Export to Calendar'}<FlowIcon name="start" /></button>
        <p id="tb-output-status" className="tb-output-status" role="status">{!launch && !exportCalendar ? 'Choose at least one option to continue.' : pending || !validation.valid ? 'Resolve or cancel pending changes before starting or exporting.' : ''}</p>
      </section>
    </aside>
  </>;
}

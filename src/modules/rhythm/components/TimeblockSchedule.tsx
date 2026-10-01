import { useState } from 'react';
import type { DayConfig, ScheduleBlock, Task } from '../types';
import { formatTaskDuration } from '../task-spaces';
import { scheduleSummary } from '../workload';
import { ChronotypeSelector } from './ChronotypeSelector';
import type { CatalogSpace } from './PlanTaskCatalog';
import { FlowIcon } from './TimeblockWorkload';
import { ScheduleBlocks } from './ScheduleBlocks';

export function TimeblockSchedule({ blocks, tasks, spaces, config, onChronotype, onRegenerate, onScheduleChange, launch, exportCalendar, onLaunchChange, onExportChange, onFinish, busy }: {
  blocks: ScheduleBlock[]; tasks: Task[]; spaces: CatalogSpace[]; config: DayConfig;
  onChronotype(value: DayConfig['chronotype']): void; onRegenerate(): void; onScheduleChange(blocks: ScheduleBlock[]): void;
  launch: boolean; exportCalendar: boolean; onLaunchChange(value: boolean): void; onExportChange(value: boolean): void; onFinish(): void; busy: boolean;
}) {
  const summary = scheduleSummary(blocks);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const missing = tasks.filter(task => !blocks.some(block => block.taskId === task.id));
  const time = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  return <>
    <section className="tb-schedule-panel live-timer-card" aria-label="Schedule preview">
      <div className="tb-schedule-toolbar"><div><h3>Today</h3><span>{new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${config.date}T12:00:00`))}</span></div><div>
        <button type="button" className="tb-small" onClick={() => { onRegenerate(); setMessage('Schedule regenerated using your current energy profile.'); }}><FlowIcon name="refresh" />Regenerate schedule</button>
        <button type="button" className="tb-small tb-icon-only" aria-label="Edit schedule order" aria-pressed={editing} onClick={() => setEditing(!editing)}><FlowIcon name="more" /></button></div></div>
      {missing.length > 0 && <p className="tb-warning" role="alert">Could not fit: {missing.map(t => t.name).join(', ')}. Go back to adjust durations or your time window before starting.</p>}
      <p className="tb-schedule-message" role="status">{message}</p>
      <ScheduleBlocks blocks={blocks} tasks={tasks} config={config} spaces={spaces} editing={editing} onChange={onScheduleChange} onMessage={setMessage} />
    </section>
    <aside className="tb-schedule-sidebar">
      <section className="tb-profile"><h3>Energy Profile</h3><p>Change to see a different schedule.</p><ChronotypeSelector value={config.chronotype} onChange={onChronotype} variant="schedule" /></section>
      <section className="tb-schedule-summary"><h3>Schedule Summary</h3><p>A quick overview of your planned day.</p><dl>
        <div><dt><FlowIcon name="summary-file" />Tasks</dt><dd>{summary.count}</dd></div><div><dt><FlowIcon name="summary-duration" />Work time</dt><dd>{formatTaskDuration(summary.work)}</dd></div>
        <div><dt><FlowIcon name="summary-break" />Breaks</dt><dd>{formatTaskDuration(summary.breaks)}</dd></div><div><dt><FlowIcon name="summary-time" />Finish time</dt><dd>{summary.finish ? time(summary.finish) : '—'}</dd></div>
      </dl></section>
      <section className="tb-outputs"><h3>After scheduling</h3><p>Choose what you'd like to do with this schedule.</p>
        <label className={`tb-output${launch ? ' checked' : ''}`}><span className="tb-output-icon"><FlowIcon name="play" /></span><span><strong>Start Live Timer</strong><small>Open your schedule in focus mode with the Live Timer.</small></span><input type="checkbox" checked={launch} onChange={e => onLaunchChange(e.target.checked)} /><span className="tb-output-check" aria-hidden="true">{launch && <FlowIcon name="output-check" />}</span></label>
        <label className={`tb-output${exportCalendar ? ' checked' : ''}`}><span className="tb-output-icon"><FlowIcon name="calendar" /></span><span><strong>Export to Calendar</strong><small>Add today's schedule to your calendar (ICS file).</small></span><input type="checkbox" checked={exportCalendar} onChange={e => onExportChange(e.target.checked)} /><span className="tb-output-check" aria-hidden="true">{exportCalendar && <FlowIcon name="output-check" />}</span></label>
        <button type="button" className="tb-finish" disabled={busy || (!launch && !exportCalendar) || !blocks.length || missing.length > 0} onClick={onFinish} aria-describedby="tb-output-status">{busy ? 'Saving…' : launch && exportCalendar ? 'Start & Export' : launch ? 'Start Live Timer' : 'Export to Calendar'}<FlowIcon name="start" /></button>
        <p id="tb-output-status" className="tb-output-status" role="status">{!launch && !exportCalendar ? 'Choose at least one option to continue.' : missing.length ? 'Every selected task must fit before you continue.' : ''}</p>
      </section>
    </aside>
  </>;
}

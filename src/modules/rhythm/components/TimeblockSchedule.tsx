import { useState } from 'react';
import type { DayConfig, ScheduleBlock, Task } from '../types';
import { TimerBlock } from './LiveTimer';
import { timerBlockHeight } from '../live-timer';
import { buildManualSchedule } from '../utils/manualSchedule';
import { formatTaskDuration } from '../task-spaces';
import { scheduleSummary } from '../workload';
import { ChronotypeSelector } from './ChronotypeSelector';
import type { CatalogSpace } from './PlanTaskCatalog';
import { FlowIcon, TaskSpaceBadge } from './TimeblockWorkload';
import { useLayoutMotion } from './use-layout-motion';

const noop = () => {};
export function TimeblockSchedule({ blocks, tasks, spaces, config, onChronotype, onRegenerate, onScheduleChange, launch, exportCalendar, onLaunchChange, onExportChange, onFinish, busy }: {
  blocks: ScheduleBlock[]; tasks: Task[]; spaces: CatalogSpace[]; config: DayConfig;
  onChronotype(value: DayConfig['chronotype']): void; onRegenerate(): void; onScheduleChange(blocks: ScheduleBlock[]): void;
  launch: boolean; exportCalendar: boolean; onLaunchChange(value: boolean): void; onExportChange(value: boolean): void; onFinish(): void; busy: boolean;
}) {
  const summary = scheduleSummary(blocks);
  const [dragged, setDragged] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const list = useLayoutMotion(blocks.map(b => `${b.id}:${b.start}`).join(','));
  const missing = tasks.filter(task => !blocks.some(block => block.taskId === task.id));
  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= blocks.length || from === to) return;
    // Reuse the existing manual planner to retain fixed appointments and breaks.
    const reordered = blocks.map(b => b.taskId); const [id] = reordered.splice(from, 1); reordered.splice(to, 0, id);
    // A task may span several blocks around fixed appointments; schedule it only once.
    const ids = [...new Set(reordered)];
    const byId = new Map(tasks.map(t => [t.id, t]));
    const next = buildManualSchedule(ids.map(id => byId.get(id)!), config);
    const durations = new Map<string, number>();
    next.forEach(b => durations.set(b.taskId, (durations.get(b.taskId) ?? 0) + (Date.parse(b.end) - Date.parse(b.start)) / 60000));
    if (ids.some(id => durations.get(id) !== byId.get(id)!.durationMinutes)) { setMessage('This order cannot fit around your fixed times. Try another position.'); return; }
    onScheduleChange(next.map((b, i) => ({ ...b, id: `${b.taskId}-${next.slice(0,i).filter(other => other.taskId === b.taskId).length}` })));
    setMessage('Schedule order updated.');
  };
  const time = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  return <>
    <section className="tb-schedule-panel live-timer-card" aria-label="Schedule preview">
      <div className="tb-schedule-toolbar"><div><h3>Today</h3><span>{new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${config.date}T12:00:00`))}</span></div><div>
        <button type="button" className="tb-small" onClick={() => { onRegenerate(); setMessage('Schedule regenerated using your current energy profile.'); }}><FlowIcon name="refresh" />Regenerate schedule</button>
        <button type="button" className="tb-small tb-icon-only" aria-label="Edit schedule order" aria-pressed={editing} onClick={() => setEditing(!editing)}><FlowIcon name="more" /></button></div></div>
      {missing.length > 0 && <p className="tb-warning" role="alert">Could not fit: {missing.map(t => t.name).join(', ')}. Go back to adjust durations or your time window before starting.</p>}
      <p className="tb-sr-only" role="status">{message}</p>
      <div className="tb-schedule-blocks" ref={list}>
        {blocks.map((block, index) => <div className="tb-schedule-slot" key={block.id} data-motion-id={block.id} draggable={editing}
          onDragStart={e => { setDragged(block.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragged(null)} onDragOver={e => { if (editing) e.preventDefault(); }} onDrop={e => { e.preventDefault(); move(blocks.findIndex(b => b.id === dragged), index); setDragged(null); }}>
          <TimerBlock metadata={<TaskSpaceBadge id={block.taskId} spaces={spaces} />} block={block} state="preview" timezone={config.timezone} height={timerBlockHeight(block, 'preview')} onRetain={noop} onReflow={noop} />
          {editing && <div className="tb-reorder"><button type="button" disabled={index === 0} aria-label={`Move ${block.taskName} up`} onClick={() => move(index,index-1)}>↑</button><button type="button" disabled={index === blocks.length - 1} aria-label={`Move ${block.taskName} down`} onClick={() => move(index,index+1)}>↓</button></div>}
        </div>)}
        {!blocks.length && <p className="tb-empty">No tasks fit this time window. Go back to review your workload.</p>}
      </div>
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

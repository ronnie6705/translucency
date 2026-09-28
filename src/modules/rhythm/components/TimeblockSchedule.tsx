import { useMemo, useState } from 'react';
import type { DayConfig, ScheduleBlock, Task } from '../types';
import { TimerBlock } from './LiveTimer';
import { timerBlockHeight } from '../live-timer';
import { explainPlacement, moveScheduleBlock } from '../schedule';
import type { ScheduleIssue } from '../rhythmScheduler';
import { formatTaskDuration } from '../task-spaces';
import { scheduleSummary } from '../workload';
import { ChronotypeSelector } from './ChronotypeSelector';
import type { CatalogSpace } from './PlanTaskCatalog';
import { FlowIcon, TaskSpaceBadge } from './TimeblockWorkload';
import { useLayoutMotion } from './use-layout-motion';

const noop = () => {};
export function TimeblockSchedule({ blocks, tasks, spaces, config, issues, onUnpin, onChronotype, onRegenerate, onScheduleChange, launch, exportCalendar, onLaunchChange, onExportChange, onFinish, busy }: {
  blocks: ScheduleBlock[]; tasks: Task[]; spaces: CatalogSpace[]; config: DayConfig;
  issues: ScheduleIssue[]; onUnpin(taskId: string): void;
  onChronotype(value: DayConfig['chronotype']): void; onRegenerate(): void; onScheduleChange(blocks: ScheduleBlock[]): void;
  launch: boolean; exportCalendar: boolean; onLaunchChange(value: boolean): void; onExportChange(value: boolean): void; onFinish(): void; busy: boolean;
}) {
  const summary = scheduleSummary(blocks);
  const explanations = useMemo(() => blocks.map(block => explainPlacement(block, config)), [blocks, config]);
  const [dragged, setDragged] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const list = useLayoutMotion(blocks.map(b => `${b.id}:${b.start}`).join(','));
  const missing = tasks.filter(task => !blocks.some(block => block.taskId === task.id));
  const hasSplitTasks = new Set(blocks.map(b => b.taskId)).size !== blocks.length;
  const move = (from: number, to: number) => {
    if (from < 0 || to < 0 || to >= blocks.length || from === to) return;
    try {
      onScheduleChange(moveScheduleBlock(blocks, from, to));
      setMessage('Task moved and pinned. Regeneration will keep this time.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'This move could not be applied.'); }
  };
  const time = (value: string) => new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  return <>
    <section className="tb-schedule-panel live-timer-card" aria-label="Schedule preview">
      <div className="tb-schedule-toolbar"><div><h3>Today</h3><span>{new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${config.date}T12:00:00`))}</span></div><div>
        <button type="button" className="tb-small" disabled={busy} onClick={() => { onRegenerate(); setMessage('Unpinned work regenerated using your current energy profile.'); }}><FlowIcon name="refresh" />Regenerate schedule</button>
        <button type="button" className="tb-small tb-icon-only" aria-label="Edit schedule order" aria-pressed={editing} onClick={() => setEditing(!editing)}><FlowIcon name="more" /></button></div></div>
      {missing.length > 0 && <p className="tb-warning" role="alert">Could not fit: {missing.map(t => t.name).join(', ')}. Go back to adjust durations or your time window before starting.</p>}
      {issues.map(issue => <p className="tb-warning" key={issue.taskId} role="alert"><strong>{tasks.find(t => t.id === issue.taskId)?.name}: </strong>{issue.message}{issue.pinned && <button type="button" className="tb-small" onClick={() => onUnpin(issue.taskId)}>Unpin {tasks.find(t => t.id === issue.taskId)?.name}</button>}</p>)}
      <p className="tb-schedule-message" role="status">{message}</p>
      {editing && <p className="tb-schedule-message">Moving a task pins its new time. Only tasks crossed by the move are rearranged.</p>}
      {hasSplitTasks && <p className="tb-schedule-message">This older plan contains split tasks. Regenerate it before pinning or moving tasks.</p>}
      <div className="tb-schedule-blocks" ref={list}>
        {blocks.map((block, index) => <div className="tb-schedule-slot" key={block.id} data-motion-id={block.id} draggable={editing && !busy && !hasSplitTasks && !issues.length && !block.fixed && !block.pinned}
          onDragStart={e => { setDragged(block.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragged(null)} onDragOver={e => { if (editing) e.preventDefault(); }} onDrop={e => { e.preventDefault(); move(blocks.findIndex(b => b.id === dragged), index); setDragged(null); }}>
          <TimerBlock metadata={<TaskSpaceBadge id={block.taskId} spaces={spaces} />} block={block} state="preview" timezone={config.timezone} height={timerBlockHeight(block, 'preview')} onRetain={noop} onReflow={noop} />
          <div className="tb-placement"><p className={explanations[index].belowPreferred ? 'tb-energy-shortfall' : ''}>{explanations[index].text}</p>
            {!block.fixed && <button type="button" className="tb-small" disabled={busy || issues.length > 0 || hasSplitTasks} aria-label={`${block.pinned ? 'Unpin' : 'Pin'} ${block.taskName}`} aria-pressed={!!block.pinned} onClick={() => { if (block.pinned) { onUnpin(block.taskId); setMessage('Task unpinned and released for automatic placement.'); } else { onScheduleChange(blocks.map(b => b.taskId === block.taskId ? { ...b, pinned: true } : b)); setMessage('Task pinned. Profile changes and regeneration will keep this time.'); } }}>{block.pinned ? 'Unpin' : 'Pin time'}</button>}
          </div>
          {editing && <div className="tb-reorder"><button type="button" disabled={busy || hasSplitTasks || index === 0 || block.fixed || block.pinned || issues.length > 0} aria-label={`Move ${block.taskName} up`} onClick={() => move(index,index-1)}>↑</button><button type="button" disabled={busy || hasSplitTasks || index === blocks.length - 1 || block.fixed || block.pinned || issues.length > 0} aria-label={`Move ${block.taskName} down`} onClick={() => move(index,index+1)}>↓</button></div>}
        </div>)}
        {!blocks.length && <p className="tb-empty">No tasks fit this time window. Go back to review your workload.</p>}
      </div>
    </section>
    <aside className="tb-schedule-sidebar">
      <section className="tb-profile"><h3>Energy Profile</h3><p>Change to replan unpinned work. Fixed and pinned times stay put.</p><ChronotypeSelector value={config.chronotype} onChange={onChronotype} variant="schedule" /><p className="tb-profile-note">The curve illustrates your profile. Placement notes use its time-of-day energy bands.</p></section>
      <section className="tb-schedule-summary"><h3>Schedule Summary</h3><p>A quick overview of your planned day.</p><dl>
        <div><dt><FlowIcon name="summary-file" />Tasks</dt><dd>{summary.count}</dd></div><div><dt><FlowIcon name="summary-duration" />Work time</dt><dd>{formatTaskDuration(summary.work)}</dd></div>
        <div><dt><FlowIcon name="summary-break" />Breaks</dt><dd>{formatTaskDuration(summary.breaks)}</dd></div><div><dt><FlowIcon name="summary-time" />Finish time</dt><dd>{summary.finish ? time(summary.finish) : '—'}</dd></div>
      </dl></section>
      <section className="tb-outputs"><h3>After scheduling</h3><p>Choose what you'd like to do with this schedule.</p>
        <label className={`tb-output${launch ? ' checked' : ''}`}><span className="tb-output-icon"><FlowIcon name="play" /></span><span><strong>Start Live Timer</strong><small>Open your schedule in focus mode with the Live Timer.</small></span><input type="checkbox" checked={launch} onChange={e => onLaunchChange(e.target.checked)} /><span className="tb-output-check" aria-hidden="true">{launch && <FlowIcon name="output-check" />}</span></label>
        <label className={`tb-output${exportCalendar ? ' checked' : ''}`}><span className="tb-output-icon"><FlowIcon name="calendar" /></span><span><strong>Export to Calendar</strong><small>Add today's schedule to your calendar (ICS file).</small></span><input type="checkbox" checked={exportCalendar} onChange={e => onExportChange(e.target.checked)} /><span className="tb-output-check" aria-hidden="true">{exportCalendar && <FlowIcon name="output-check" />}</span></label>
        <button type="button" className="tb-finish" disabled={busy || (!launch && !exportCalendar) || !blocks.length || missing.length > 0 || issues.length > 0} onClick={onFinish} aria-describedby="tb-output-status">{busy ? 'Saving…' : launch && exportCalendar ? 'Start & Export' : launch ? 'Start Live Timer' : 'Export to Calendar'}<FlowIcon name="start" /></button>
        <p id="tb-output-status" className="tb-output-status" role="status">{!launch && !exportCalendar ? 'Choose at least one option to continue.' : missing.length ? 'Every selected task must fit before you continue.' : ''}</p>
      </section>
    </aside>
  </>;
}

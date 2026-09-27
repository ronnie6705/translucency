import { useState, type CSSProperties } from 'react';
import type { Task } from '../types';
import { handleAdjustKey } from '../adjust-key';
import { energyBand, workloadSummary } from '../workload';
import { formatTaskDuration } from '../task-spaces';
import { useLayoutMotion } from './use-layout-motion';
import type { CatalogSpace } from './PlanTaskCatalog';

export function FlowIcon({ name, className = '' }: { name: string; className?: string }) {
  return <img className={`tb-icon ${className}`} src={`/rhythm/flow/${name}.svg`} alt="" aria-hidden="true" />;
}
export function TaskSpaceBadge({ id, spaces }: { id: string; spaces: CatalogSpace[] }) {
  const space = spaces.find(s => s.tasks.some(t => t.id === id) || s.lists.some(l => l.tasks.some(t => t.id === id)));
  return space ? <span className="tb-space-badge" style={{ '--space-color': space.color } as CSSProperties}>{space.name}</span> : null;
}
export function TimeWindowCard({ start, end, available, onEdit, compact = false }: { start: string; end: string; available: number; onEdit(): void; compact?: boolean }) {
  return <div className={`tb-window${compact ? ' compact' : ''}`}><span className="tb-icon-tile"><FlowIcon name="time" /></span>
    <div><strong>{compact ? "Today's time window" : 'Available today'}</strong>{compact && <p>When are you available today?</p>}
    {!compact && <b>{start} → {end} ({formatTaskDuration(available)})</b>}</div>
    {compact && <span className="tb-count">{start} - {end}</span>}<button type="button" className="tb-small" onClick={onEdit}>Edit</button>
  </div>;
}
export function TimeblockWorkload({ tasks, spaces, start, end, onUpdate, onRemove, onReset, onEditTime, onViewTasks, onAddBreak }: {
  tasks: Task[]; spaces: CatalogSpace[]; start: string; end: string;
  onUpdate(id: string, updates: Partial<Task>): void; onRemove(id: string): void;
  onReset(): void; onEditTime(): void; onViewTasks(): void; onAddBreak(): void;
}) {
  const [selected, setSelected] = useState(0);
  const list = useLayoutMotion(tasks.map(t => `${t.id}:${t.durationMinutes}`).join(','));
  const summary = workloadSummary(tasks, start, end);
  const selectedIndex = Math.min(selected, Math.max(0, tasks.length - 1));
  const focusRow = (index: number) => {
    setSelected(index);
    list.current?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  const tip = summary.excess ? 'Review your estimates or leave a few tasks for another day.' : summary.distribution.High > 1
    ? `You have ${summary.distribution.High} high-energy tasks. Consider spacing them out when arranging your schedule.`
    : 'Leave a little breathing room for breaks and the unexpected.';
  return <>
    <section className="tb-workload-main"><div className="tb-list-toolbar"><span>{summary.count} tasks selected</span><button type="button" className="tb-small" onClick={onReset}><FlowIcon name="refresh" />Reset all estimates</button></div>
      <div className="tb-workload-list" ref={list} role="group" aria-label="Workload tasks" aria-describedby="tb-keyboard-hint" tabIndex={0}
        onKeyDown={e => handleAdjustKey(e, tasks, selectedIndex, focusRow, onUpdate)}>
        {tasks.map((task, index) => <div key={task.id} data-motion-id={task.id} data-row-index={index} data-energy={task.isBreak ? undefined : task.energyRequired} className={`tb-workload-row${index === selectedIndex ? ' selected' : ''}`}
          onFocusCapture={() => setSelected(index)} onClick={e => { setSelected(index); if (!(e.target as HTMLElement).closest('button,input,select')) list.current?.focus({ preventScroll: true }); }}>
          <FlowIcon name="row-grip" /><div className="tb-task-title">{task.isBreak ? <input aria-label="Break name" value={task.name} onChange={e => onUpdate(task.id, { name: e.target.value })} /> : <span>{task.name}</span>}<TaskSpaceBadge id={task.id} spaces={spaces} /></div>
          <div className="tb-row-controls">
            {!task.isBreak && <div className={`tb-energy ${energyBand(task.energyRequired).toLowerCase()}`} role="group" aria-label={`Energy for ${task.name}`}>
              <span className="tb-energy-icon" aria-hidden="true" />
              {[1,2,3,4,5].map(n => <button key={n} type="button" aria-label={`Set energy ${n} for ${task.name}`} aria-pressed={task.energyRequired === n} onClick={() => onUpdate(task.id, { energyRequired: n as Task['energyRequired'] })}><i className={n <= task.energyRequired ? 'filled' : ''} /></button>)}
            </div>}
            {task.isBreak && <input type="time" step={300} aria-label={`Fixed time for ${task.name}`} value={task.fixedStart ?? ''} onChange={e => onUpdate(task.id, { fixedStart: e.target.value || undefined })} />}
            <label className="tb-duration"><FlowIcon name="duration" /><select aria-label={`Duration for ${task.name}`} value={task.durationMinutes} onChange={e => onUpdate(task.id, { durationMinutes: Number(e.target.value) })}>
              {Array.from(new Set([...Array.from({ length: 48 }, (_, n) => (n + 1) * 15), task.durationMinutes])).sort((a,b) => a-b).map(n => <option key={n} value={n}>{formatTaskDuration(n)}</option>)}
            </select></label>
            <button type="button" className="tb-remove" aria-label={`Remove ${task.name}`} onClick={() => onRemove(task.id)}><FlowIcon name="remove" /></button>
          </div>
        </div>)}
      </div>
      <div className="tb-workload-footer"><p id="tb-keyboard-hint">↑ ↓ Select task · ← → Adjust energy</p><button type="button" className="tb-small" onClick={onAddBreak}>+ Add break</button></div>
    </section>
    <aside className="tb-workload-summary" aria-label="Today's Workload">
      <div className="tb-panel-heading"><div><h3>Today's Workload</h3><p>{summary.count} tasks</p></div><span className="tb-count">{summary.count} tasks</span><button type="button" className="tb-small" onClick={onViewTasks}>View tasks</button></div>
      <div className="tb-metrics" aria-live="polite"><div><p><FlowIcon name="duration" />Estimated time</p><strong data-testid="estimated-time">{formatTaskDuration(summary.estimated)}</strong></div><div><p><FlowIcon name="energy" />Average energy</p><b>{summary.count ? energyBand(summary.average) : '—'}</b><span className="tb-average-dots" aria-label={`Average energy ${summary.average.toFixed(1)} out of 5`}>{[1,2,3,4,5].map(n => <i key={n} className={n <= Math.round(summary.average) ? 'filled' : ''} />)}</span></div></div>
      <div className="tb-distribution"><h4>Energy distribution</h4>{(['Low','Moderate','High'] as const).map(band => <div key={band} className={band.toLowerCase()}><span>{band}</span><span className="tb-bar"><i style={{ width: `${summary.count ? summary.distribution[band] / summary.count * 100 : 0}%` }} /></span><span>{summary.distribution[band]} tasks</span></div>)}</div>
      <TimeWindowCard start={start} end={end} available={summary.available} onEdit={onEditTime} />
      <div className={`tb-fit${summary.excess ? ' over' : ''}`} role="status"><h4><FlowIcon name={summary.excess ? 'time' : 'check'} />{summary.excess ? "You're over capacity" : 'Looks good!'}</h4><p>{summary.excess ? `Your tasks exceed today's available time by ${formatTaskDuration(summary.excess)}.` : `Your estimated time (${formatTaskDuration(summary.estimated)}) fits within your available time (${formatTaskDuration(summary.available)}).`}</p></div>
      <div className="tb-tip"><h4><FlowIcon name="tip" />Tip</h4><p>{tip}</p></div>
    </aside>
  </>;
}

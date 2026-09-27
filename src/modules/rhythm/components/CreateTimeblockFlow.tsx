import { useEffect, useMemo, useRef, useState } from 'react';
import type { DayConfig, ScheduleBlock, Task } from '../types';
import { generateSchedule } from '../rhythmScheduler';
import { validateTimeblockPlan } from '../timeblock-plan';
import { workloadSummary } from '../workload';
import { PlanTaskCatalog, type CatalogSpace } from './PlanTaskCatalog';
import { PlanTimeRange } from './PlanTimeRange';
import { FlowIcon, TimeblockWorkload, TimeWindowCard } from './TimeblockWorkload';
import { TimeblockSchedule } from './TimeblockSchedule';
import { useLayoutMotion } from './use-layout-motion';

type Props = {
  tasks: Task[]; spaces: CatalogSpace[]; config: DayConfig; busy: boolean; error: string | null;
  onTasksChange(tasks: Task[]): void; onConfigChange(config: DayConfig): void;
  onCreateTask(task: Task, spaceId: string | null): Promise<boolean>;
  onFinish(blocks: ScheduleBlock[], launch: boolean, exportCalendar: boolean): Promise<void>;
  onClose(): void;
};
const titles = ["Gather Today's Tasks", "Assess Today's Workload", 'Your Timeblock Is Ready'];
const descriptions = ['Get everything out of your head. You can plan the details next.', 'Rate effort and energy for each task to build your ideal schedule.', "Based on your tasks, estimated effort and energy profile, here's a suggested plan."];
const icons = ['stack','energy','schedule'];

function TimeWindowEditor({ config, onChange, onClose }: { config: DayConfig; onChange(config: DayConfig): void; onClose(): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(config);
  const valid = validateTimeblockPlan([], draft.startTime, draft.endTime).validRange;
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => trigger?.focus(); }, []);
  return <dialog className="tb-range-dialog" ref={dialog} aria-label="Edit today's time window" onCancel={e => { e.preventDefault(); e.stopPropagation(); onClose(); }}>
    <PlanTimeRange startTime={draft.startTime} endTime={draft.endTime} timeZone={draft.timezone} validRange={valid}
      onRangeChange={(startTime,endTime) => setDraft(prev => ({ ...prev,startTime,endTime }))} onTimeZoneChange={timezone => setDraft(prev => ({ ...prev, timezone }))} />
    <div className="tb-range-actions"><button type="button" onClick={onClose}>Cancel</button><button type="button" disabled={!valid} onClick={() => { onChange(draft); onClose(); }}>Apply time window</button></div>
  </dialog>;
}

export function CreateTimeblockFlow({ tasks, spaces, config, busy, error, onTasksChange, onConfigChange, onCreateTask, onFinish, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState('forward');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [editingTime, setEditingTime] = useState(false);
  const [creating, setCreating] = useState(false);
  const [launch, setLaunch] = useState(true);
  const [exportCalendar, setExportCalendar] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [manual, setManual] = useState<{ input: string; blocks: ScheduleBlock[] } | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const assessments = useRef(new Map<string, Task>());
  const defaults = useRef(new Map<string, Task>());
  const catalog = useMemo(() => spaces.flatMap(s => [...s.tasks, ...s.lists.flatMap(l => l.tasks)]), [spaces]);
  const input = JSON.stringify({ tasks, config, generation });
  const validation = validateTimeblockPlan(tasks, config.startTime, config.endTime);
  const schedule = useMemo(() => step === 2 && validation.valid ? generateSchedule(tasks, config) : [], [tasks, config, generation, validation.valid, step]);
  const blocks = manual?.input === input ? manual.blocks : schedule;
  const summary = workloadSummary(tasks, config.startTime, config.endTime);
  const stack = useLayoutMotion(tasks.map(t => t.id).join(','));
  const [removing, setRemoving] = useState(new Set<string>());
  const removalTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const currentTasks = useRef(tasks); currentTasks.current = tasks;
  useEffect(() => () => { removalTimers.current.forEach(clearTimeout); }, []);
  useEffect(() => {
    const target = step === 1
      ? heading.current?.closest('.tb-flow')?.querySelector<HTMLElement>('.tb-workload-list')
      : heading.current;
    target?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => {
    tasks.forEach(task => {
      if (!defaults.current.has(task.id)) defaults.current.set(task.id, catalog.find(t => t.id === task.id) ?? task);
      assessments.current.set(task.id, task);
    });
  }, [tasks, catalog]);
  const go = (next: number) => { setDirection(next > step ? 'forward' : 'back'); setStep(next); };
  const add = (task: Task) => {
    if (currentTasks.current.some(t => t.id === task.id)) return;
    if (!defaults.current.has(task.id)) defaults.current.set(task.id, task);
    onTasksChange([...currentTasks.current, assessments.current.get(task.id) ?? task]);
  };
  const remove = (id: string) => {
    if (removalTimers.current.has(id)) return;
    setRemoving(prev => new Set([...prev,id]));
    const finish = () => { onTasksChange(currentTasks.current.filter(t => t.id !== id)); setRemoving(prev => { const next = new Set(prev); next.delete(id); return next; }); removalTimers.current.delete(id); };
    if (step !== 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else removalTimers.current.set(id,setTimeout(finish,180));
  };
  const update = (id: string, patch: Partial<Task>) => onTasksChange(tasks.map(t => t.id === id ? { ...t, ...patch } : t));
  const create = async () => {
    const name = query.trim(); if (!name || creating) return;
    const existing = catalog.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) { add(existing); setQuery(''); return; }
    setCreating(true);
    const task: Task = { id: crypto.randomUUID(), name, durationMinutes: 90, energyRequired: 3, priority: 2, completed: false };
    try { if (await onCreateTask(task, filter)) { add(task); setQuery(''); } } finally { setCreating(false); }
  };
  const clear = () => { removalTimers.current.forEach(clearTimeout); removalTimers.current.clear(); setRemoving(new Set()); onTasksChange([]); };
  const nextAllowed = step === 0 ? tasks.some(t => !t.isBreak) && validation.validRange && !creating && !removing.size : validation.valid;
  const dragId = useRef<string | null>(null);
  const reorder = (from: number, to: number) => { if (from < 0 || to < 0 || to >= tasks.length) return; const next = [...tasks]; const [task] = next.splice(from,1); next.splice(to,0,task); onTasksChange(next); };
  return <div className="tb-flow">
    <header className="tb-header"><div><p className="tb-eyebrow">Create a Timeblock</p><div className="tb-title-row"><span className="tb-icon-tile"><FlowIcon name={icons[step]} /></span><h2 tabIndex={-1} ref={heading}>{titles[step]}</h2>
      <nav className="tb-steps" aria-label="Timeblock stages">{['Tasks','Workload','Schedule'].map((name,index) => <span key={name} className={index === step ? 'active' : index < step ? 'completed' : ''} aria-current={index === step ? 'step' : undefined}><i />{name}</span>)}</nav></div><p className="tb-description">{descriptions[step]}</p></div>
      <div className="tb-header-actions">{step > 0 && <button type="button" className="tb-back" aria-label="Back" onClick={() => go(step-1)} disabled={busy}><FlowIcon name="back" /></button>}{step < 2 && <button type="button" className="tb-next" onClick={() => go(step+1)} disabled={!nextAllowed} aria-describedby="tb-validation">Next<span><FlowIcon name={icons[step+1]} /></span><FlowIcon name="next" /></button>}<button type="button" className="tb-close" aria-label="Close timeblock" onClick={onClose} disabled={busy}><FlowIcon name="close" /></button></div>
    </header>
    <p id="tb-validation" className="tb-validation" role="status">{!tasks.some(t => !t.isBreak) ? 'Select at least one task to continue.' : !validation.validRange ? 'Choose a valid time window to continue.' : step > 0 ? Object.values(validation.errors).join(' ') : ''}</p>
    {error && <p role="alert" className="tb-warning">{error}</p>}
    <div className={`tb-columns tb-step-${step} ${direction}`} key={step}>
      {step === 0 && <>
        <section className="tb-tasks-main"><form className="tb-search" onSubmit={e => { e.preventDefault(); void create(); }}><span><FlowIcon name="search" />+</span><input ref={search} aria-label="Search or Add a new task" placeholder="Search or Add a new task" value={query} onChange={e => setQuery(e.target.value)} /><button type="submit" aria-label="Add task to today's stack" disabled={!query.trim() || creating}><FlowIcon name="add" /></button></form>
          <div className="tb-catalog-toolbar"><div className="tb-space-filters" aria-label="Filter by Space"><button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}><i />All</button>{spaces.map(space => <button type="button" key={space.id} aria-pressed={filter === space.id} onClick={() => setFilter(space.id)}><i />{space.name}<small>{space.tasks.length + space.lists.reduce((sum,l) => sum+l.tasks.length,0)}</small></button>)}</div><div><button type="button" className="tb-small" onClick={() => setCollapsed(new Set(spaces.map(s => s.id)))}>Collapse All</button><button type="button" className="tb-small" onClick={() => setCollapsed(new Set())}>Expand All</button></div></div>
          <PlanTaskCatalog spaces={spaces} selected={tasks} onAdd={add} onRemove={remove} query={query} filter={filter} collapsed={collapsed} onToggle={id => setCollapsed(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; })} />
        </section>
        <aside className="tb-stack" aria-label="Today's Stack"><div className="tb-panel-heading"><span className="tb-icon-tile"><FlowIcon name="stack" /></span><div><h3>Today's Stack</h3><p>Tasks you've added for today.</p></div><span className="tb-count" aria-live="polite">{summary.count} tasks</span><button type="button" className="tb-small" onClick={clear} disabled={!tasks.length}>Clear all</button></div>
          <div className="tb-stack-list" ref={stack}>{tasks.map((task,index) => <div key={task.id} data-motion-id={task.id} className={`tb-stack-slot${removing.has(task.id) ? ' removing' : ''}`}><div className="tb-stack-row" draggable onDragStart={() => { dragId.current = task.id; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); reorder(tasks.findIndex(t => t.id === dragId.current),index); dragId.current=null; }}>
            <button type="button" className="tb-grip" aria-label={`Reorder ${task.name}; use arrow keys`} onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); reorder(index,index+(e.key === 'ArrowUp' ? -1 : 1)); } }}><FlowIcon name="grip" /></button><strong>{task.name}</strong><button type="button" className="tb-remove" aria-label={`Remove ${task.name} from stack`} onClick={() => remove(task.id)}><FlowIcon name="remove" /></button>
          </div></div>)}</div>
          <div className="tb-stack-bottom"><button type="button" className="tb-stack-add" onClick={() => search.current?.focus()}><strong>Drag or Click</strong> to add a new task<small>Select from any space or type a new one.</small></button><TimeWindowCard compact start={config.startTime} end={config.endTime} available={summary.available} onEdit={() => setEditingTime(true)} /></div>
        </aside>
      </>}
      {step === 1 && <TimeblockWorkload tasks={tasks} spaces={spaces} start={config.startTime} end={config.endTime} onUpdate={update} onRemove={remove} onReset={() => onTasksChange(tasks.map(t => { const d = defaults.current.get(t.id); return { ...t, durationMinutes: d?.durationMinutes ?? 90, energyRequired: d?.energyRequired ?? 3 }; }))} onViewTasks={() => go(0)} onEditTime={() => setEditingTime(true)} onAddBreak={() => add({id:crypto.randomUUID(),name:'Short break',durationMinutes:15,energyRequired:1,priority:2,isBreak:true})} />}
      {step === 2 && <TimeblockSchedule spaces={spaces} blocks={blocks} tasks={tasks} config={config} onChronotype={chronotype => onConfigChange({ ...config, chronotype })} onRegenerate={() => setGeneration(n=>n+1)} onScheduleChange={blocks => setManual({input,blocks})} launch={launch} exportCalendar={exportCalendar} onLaunchChange={setLaunch} onExportChange={setExportCalendar} onFinish={() => { void onFinish(blocks,launch,exportCalendar); }} busy={busy} />}
    </div>
    {editingTime && <TimeWindowEditor config={config} onChange={onConfigChange} onClose={() => setEditingTime(false)} />}
  </div>;
}

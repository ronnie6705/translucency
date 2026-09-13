import { useEffect, useId, useRef, useState } from 'react';
import type { Task } from '../types';

export function PlanTaskSettings({ task, onUpdate, onRemove }: { task: Task; onUpdate(id: string, patch: Partial<Task>): void; onRemove(id: string): void }) {
  const [open, setOpen] = useState(false);
  const [editingFixed, setEditingFixed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const fixedInput = useRef<HTMLInputElement>(null);
  const actionsId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);
  useEffect(() => { if (editingFixed) fixedInput.current?.focus(); }, [editingFixed]);
  return <div className="plan-task-settings-group">
    {(task.fixedStart || editingFixed) && <label className="plan-fixed-time plan-task-fixed"><img src="/rhythm/planner/ClockCheck.svg" alt="" /><input ref={fixedInput} type="time" aria-label={`Fixed time for ${task.name}`} value={task.fixedStart ?? ''} onChange={event => onUpdate(task.id, { fixedStart: event.target.value || undefined })} onBlur={() => { if (!task.fixedStart) setEditingFixed(false); }} /></label>}
    <div ref={root} className={`plan-task-settings${open ? ' open' : ''}`}
      onPointerEnter={event => { clearTimeout(closeTimer.current); if (event.pointerType === 'mouse') setOpen(true); }}
      onPointerMove={event => { if (event.pointerType === 'mouse' && !open) setOpen(true); }}
      onPointerLeave={() => { clearTimeout(closeTimer.current); closeTimer.current = setTimeout(() => { if (!root.current?.matches(':hover') && !root.current?.contains(document.activeElement)) setOpen(false); }, 220); }}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
      <button ref={trigger} type="button" className="plan-settings-trigger" aria-label={`Task Settings for ${task.name}`} aria-expanded={open} aria-controls={actionsId} onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>('.plan-settings-actions button')?.focus()); } }}><img src="/rhythm/planner/SlidersHoriz2.svg" alt="" /></button>
      <div id={actionsId} className="plan-settings-actions" inert={!open}>
        <button type="button" className={task.fixedStart || editingFixed ? 'active' : ''} aria-pressed={Boolean(task.fixedStart || editingFixed)} aria-label={`Fixed Time Slot for ${task.name}`} title="Fixed Time Slot" onPointerDown={event => event.preventDefault()} onClick={() => {
          if (task.fixedStart || editingFixed) {
            onUpdate(task.id, { fixedStart: undefined });
            setEditingFixed(false);
            setOpen(false);
            trigger.current?.focus();
          } else {
            setEditingFixed(true);
            setOpen(false);
          }
        }}><img src="/rhythm/planner/ClockCheck.svg" alt="" /></button>
        <button type="button" className="plan-delete" aria-label={`Delete ${task.name}`} title="Delete" onClick={() => onRemove(task.id)}><img src="/rhythm/planner/Trash2.svg" alt="" /></button>
      </div>
    </div>
  </div>;
}

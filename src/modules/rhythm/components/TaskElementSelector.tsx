import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { Task } from '../types';
import { formatTaskDuration } from '../task-spaces';
import { taskEnergyColors } from '../task-energy';
import { PRIORITIES } from '../task-priority';
import './task-element-selector.css';

type Element = 'energy' | 'duration' | 'priority';
export const DURATION_STEPS = Array.from({ length: 10 }, (_, index) => (index + 1) * 15);

/** Energy/priority preview on hover; duration previews only during a handle drag. */
export function TaskElementSelector({ task, priority = true, disabled = false, onChange, onExpandedChange, energyShortcutPulse = 0 }: {
  task: Task;
  priority?: boolean;
  energyShortcutPulse?: number;
  disabled?: boolean;
  onChange(updates: Partial<Task>): void | boolean | Promise<void | boolean>;
  onExpandedChange?(expanded: boolean): void;
}) {
  const [expanded, setExpanded] = useState<Element | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelAutoClose = () => {
    if (autoCloseTimer.current !== null) clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = null;
  };
  useEffect(() => {
    if (!energyShortcutPulse) return;
    setExpanded('energy');
    setPreview(null);
    onExpandedChange?.(true);
    autoCloseTimer.current = setTimeout(() => {
      autoCloseTimer.current = null;
      setExpanded(current => current === 'energy' ? null : current);
      setPreview(null);
      onExpandedChange?.(false);
    }, 3000);
    return cancelAutoClose;
  }, [energyShortcutPulse, onExpandedChange]);
  const drag = useRef<{ pointerId: number; startX: number; startValue: number; value: number; moved: boolean } | null>(null);
  const id = useId();
  const blocked = disabled || saving;
  const toggle = (element: Element) => {
    const next = expanded === element ? null : element;
    setExpanded(next);
    setPreview(null);
    onExpandedChange?.(next !== null);
  };
  const commit = async (element: Element, value: number) => {
    if (disabled || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    const patch: Partial<Task> = element === 'energy' ? { energyRequired: value as Task['energyRequired'] }
      : element === 'priority' ? { priority: value as Task['priority'] }
      : { durationMinutes: value, durationMode: 'custom' };
    try {
      if (await onChange(patch) === false) setError('Couldn’t save this change. Please try again.');
    } catch { setError('Couldn’t save this change. Please try again.'); }
    finally { pending.current = false; setSaving(false); setPreview(null); }
  };
  const icon = (element: Element) => <span className="tes-icon" aria-hidden="true">
    {element === 'energy' ? <img src="/rhythm/tasks/selector-energy.svg" width={12.5324} height={15.2488} alt="" />
      : element === 'priority' ? <img src="/rhythm/tasks/selector-priority.svg" width={16} height={16} alt="" />
      : <img src="/rhythm/tasks/row-imgStopwatch.svg" width={16} height={16} alt="" />}
  </span>;
  const elements: Element[] = [...(task.isBreak ? [] : ['energy' as const]), 'duration', ...(priority && !task.isBreak ? ['priority' as const] : [])];
  return <div className="task-element-selector" data-expanded={expanded ?? 'none'} aria-busy={saving}
    role="group" aria-label={`Task controls for ${task.name}`}
    onPointerDownCapture={cancelAutoClose} onFocusCapture={cancelAutoClose} onKeyDownCapture={cancelAutoClose}
    onDragStart={event => event.preventDefault()}
    onKeyDown={event => {
      // Workload's row-level arrow shortcuts must not change energy while using this control.
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) event.stopPropagation();
    }}>
    <div className="tes-shell">
      {elements.map(element => {
        const open = expanded === element;
        const value = element === 'energy' ? task.energyRequired : element === 'priority' ? task.priority : task.durationMinutes;
        const shown = open && preview !== null ? preview : value;
        const levels = element === 'energy' ? [1, 2, 3, 4, 5] : element === 'priority' ? [3, 2, 1] : DURATION_STEPS;
        const label = element === 'priority' ? PRIORITIES[task.priority].label : element === 'duration' ? formatTaskDuration(value) : String(value);
        const color = element === 'energy' ? taskEnergyColors(shown).solid : element === 'priority' ? PRIORITIES[shown as Task['priority']].color : undefined;
        return <div key={element} className={`tes-segment tes-${element}${open ? ' is-open' : ''}`}
          style={{ '--selector-color': color, ...(element === 'duration' ? { '--duration-fill': `${72 + (Math.max(15, Math.min(150, shown)) - 15) / 135 * 76}px` } : {}) } as CSSProperties}>
          <button type="button" className="tes-toggle" disabled={blocked} aria-expanded={open}
            aria-controls={`${id}-${element}`} aria-label={`Edit ${element} for ${task.name}`} title={`${element}: ${label}`}
            onClick={() => toggle(element)}>{icon(element)}</button>
          <div className="tes-options" id={`${id}-${element}`} inert={!open} aria-hidden={!open}
            role="group" aria-label={`${element} levels`} onPointerLeave={() => { if (element !== 'duration') setPreview(null); }} onBlur={event => {
              if (element !== 'duration' && !event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(null);
            }}>
            {element === 'duration' ? DURATION_STEPS.map(level => <span key={level} className="tes-duration-dot" aria-hidden="true" />) : levels.map((level, index) => {
              const filled = element === 'priority' ? shown <= level : shown >= level;
              const optionLabel = element === 'priority' ? `Set ${PRIORITIES[level as Task['priority']].label.toLowerCase()} priority for ${task.name}`
                : element === 'energy' ? `Set energy ${level} for ${task.name}` : `Set duration ${formatTaskDuration(level)} for ${task.name}`;
              return <button key={level} type="button" className="tes-dot" disabled={blocked} aria-label={optionLabel}
                aria-pressed={value === level} data-filled={filled} onPointerEnter={event => { if (event.pointerType === 'mouse') setPreview(level); }}
                onFocus={() => setPreview(level)} onClick={() => void commit(element, level)}
                onKeyDown={event => {
                  const offset = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
                  if (!offset && event.key !== 'Home' && event.key !== 'End') return;
                  event.preventDefault();
                  const target = event.key === 'Home' ? 0 : event.key === 'End' ? levels.length - 1 : Math.max(0, Math.min(levels.length - 1, index + offset));
                  event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[target]?.focus();
                }}><span /></button>;
            })}
          </div>
          {element === 'duration' && open && <div className="tes-duration-value">
            <span className="tes-frosted-track" aria-hidden="true"><span>{DURATION_STEPS.map(level => <i key={level} />)}</span></span>
            <span aria-hidden="true">{formatTaskDuration(shown)}</span>
            <span className="tes-duration-handle" role="slider" tabIndex={blocked ? -1 : 0} aria-disabled={blocked}
              aria-label={`Duration for ${task.name}`} aria-valuemin={15} aria-valuemax={150}
              aria-valuenow={Math.max(15, Math.min(150, shown))} aria-valuetext={formatTaskDuration(shown)}
              onPointerDown={event => {
                if (blocked || event.button !== 0) return;
                event.preventDefault(); event.stopPropagation();
                event.currentTarget.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                const startValue = Math.max(15, Math.min(150, task.durationMinutes));
                drag.current = { pointerId: event.pointerId, startX: event.clientX, startValue, value: startValue, moved: false };
              }}
              onPointerMove={event => {
                const active = drag.current;
                if (!active || active.pointerId !== event.pointerId) return;
                const delta = event.clientX - active.startX;
                if (Math.abs(delta) < 3 && !active.moved) return;
                active.moved = true;
                active.value = Math.max(15, Math.min(150, Math.round((active.startValue + delta / 76 * 135) / 15) * 15));
                setPreview(active.value);
              }}
              onPointerUp={event => {
                const active = drag.current;
                if (!active || active.pointerId !== event.pointerId) return;
                drag.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
                if (active.moved) void commit('duration', active.value);
                else setPreview(null);
              }}
              onPointerCancel={() => { drag.current = null; setPreview(null); }}
              onLostPointerCapture={() => { if (drag.current) { drag.current = null; setPreview(null); } }}
              onKeyDown={event => {
                if (event.key === 'Escape' && drag.current) { drag.current = null; setPreview(null); event.stopPropagation(); return; }
                if (blocked) return;
                const offset = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 15 : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -15 : 0;
                if (!offset && event.key !== 'Home' && event.key !== 'End') return;
                event.preventDefault(); event.stopPropagation();
                const next = event.key === 'Home' ? 15 : event.key === 'End' ? 150 : Math.max(15, Math.min(150, Math.round(task.durationMinutes / 15) * 15 + offset));
                void commit('duration', next);
              }}><i /></span>
          </div>}
        </div>;
      })}
    </div>
    {error && <span className="tes-error" role="alert">{error}</span>}
  </div>;
}

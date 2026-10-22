import type { CSSProperties } from 'react';
import type { Task } from '../types';
import { PRIORITIES } from '../task-priority';

export function PrioritySelector({ task, disabled, onChange }: {
  task: Task; disabled: boolean; onChange(updates: Partial<Task>): Promise<boolean>;
}) {
  const priority = PRIORITIES[task.priority];
  return <div className="task-priority" role="group" aria-label={`Priority for ${task.name}: ${priority.label}`}
    style={{ '--priority-color': priority.color } as CSSProperties}>
    <button type="button" className="task-priority-reset" disabled={disabled || task.priority === 4}
      aria-label={`Clear priority for ${task.name}`} title="Clear priority"
      onClick={() => void onChange({ priority: 4 })}><span className="task-priority-flag" aria-hidden="true" /></button>
    <div className="task-priority-circles">
      {([3, 2, 1] as const).map(value => <button key={value} type="button" className="task-priority-step" disabled={disabled}
        aria-label={`Set ${PRIORITIES[value].label.toLowerCase()} priority for ${task.name}`} aria-pressed={task.priority === value}
        data-filled={task.priority <= value} title={`${PRIORITIES[value].label} priority`}
        onClick={() => void onChange({ priority: value })}><span /></button>)}
    </div>
    <span className="sr-only" role="status">{priority.label}</span>
  </div>;
}

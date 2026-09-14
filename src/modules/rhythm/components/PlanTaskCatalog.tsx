import { TaskListBadge } from "./TaskListBadge";
import type { CSSProperties } from 'react';
import type { Space, SavedTaskList, Task } from '../types';
import { SpaceIcon, TaskAsset } from './space-icons';
import { formatTaskDuration } from '../task-spaces';

export type CatalogSpace = Space & { lists: SavedTaskList[] };
export function PlanTaskCatalog({ spaces, selected, onAdd, onRemove }: {
  spaces: CatalogSpace[];
  selected: Task[];
  onAdd(task: Task): void;
  onRemove(id: string): void;
}) {
  const selectedIds = new Set(selected.map(task => task.id));
  const visibleSpaces = spaces.filter(space => space.tasks.length || space.lists.some(list => list.tasks.length));
  const renderTask = (task: Task) => {
    const included = selectedIds.has(task.id);
    return <button type="button" className="plan-catalog-task" key={task.id} aria-pressed={included}
      aria-label={`${included ? 'Remove' : 'Add'} ${task.name} ${included ? 'from' : 'to'} timeblock`}
      onClick={() => included ? onRemove(task.id) : onAdd({ ...task })}>
      <span className="plan-catalog-check" aria-hidden="true">{included ? '✓' : '+'}</span>
      <strong>{task.name}<TaskListBadge taskId={task.id} /></strong>
      <span className="plan-catalog-meta">
        <span className="plan-catalog-chip" aria-label={`Energy ${task.energyRequired}`}><TaskAsset name="row-imgLightning" />{task.energyRequired}</span>
        <span className="plan-catalog-chip" aria-label={`Estimated time ${formatTaskDuration(task.durationMinutes)}`}><TaskAsset name="row-imgStopwatch" />{formatTaskDuration(task.durationMinutes)}</span>
      </span>
    </button>;
  };
  return <div className="plan-task-catalog" role="group" aria-label="Tasks from all spaces">
    <p className="adjust-hint">Select tasks from any space to include in this timeblock.</p>
    {visibleSpaces.length ? visibleSpaces.map(space => <section className="plan-catalog-space" key={space.id} aria-label={space.name} style={{ '--space-color': space.color } as CSSProperties}>
      <details className="plan-space-disclosure" open>
      <summary><span className="task-icon-tile"><SpaceIcon icon={space.icon} color={space.color} /></span><strong>{space.name}</strong><img className="plan-space-chevron" src="/rhythm/planner/ChevronDown.svg" alt="" /></summary>
      <div className="plan-space-content">
      {space.tasks.map(renderTask)}
      {space.lists.filter(list => list.tasks.length).map(list => <details className="plan-catalog-list" key={list.id} open>
        <summary><span className="task-icon-tile"><TaskAsset name="add-imgListUnordered4Rec" /></span><strong>{list.name}</strong><small>{list.tasks.length} tasks</small></summary>
        <div>{list.tasks.map(renderTask)}</div>
      </details>)}
      </div>
      </details>
    </section>) : <p className="adjust-hint">No tasks yet. Use Edit task list to add your first task.</p>}
  </div>;
}

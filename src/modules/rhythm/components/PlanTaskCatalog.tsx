import { useState, type CSSProperties } from 'react';
import type { Space, SavedTaskList, Task } from '../types';
import { SpaceIcon } from './space-icons';
import { formatTaskDuration } from '../task-spaces';
import { PrioritySelector } from './PrioritySelector';
import { TaskListBadge } from './TaskListBadge';

export type CatalogSpace = Space & { lists: SavedTaskList[] };
export function PlanTaskCatalog({ spaces, selected, onAdd, onRemove, query = '', filter = null, collapsed, onToggle, sortByPriority = false, onDelete, deleting, onPriorityChange, savingPriority }: {
  spaces: CatalogSpace[]; selected: Task[]; onAdd(task: Task): void; onRemove(id: string): void;
  sortByPriority?: boolean; onDelete?(task: Task): void; deleting?: string;
  onPriorityChange?(id: string, priority: Task['priority']): Promise<boolean>; savingPriority?: boolean;
  query?: string; filter?: string | null; collapsed?: Set<string>; onToggle?(id: string): void;
}) {
  const [localCollapsed, setLocalCollapsed] = useState(new Set<string>());
  const closed = collapsed ?? localCollapsed;
  const toggle = onToggle ?? ((id: string) => setLocalCollapsed(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }));
  const selectedIds = new Set(selected.map(task => task.id));
  const match = (task: Task) => !task.completed && !task.isBreak && task.name.toLowerCase().includes(query.toLowerCase().trim());
  const visible = spaces.filter(s => (!filter || s.id === filter) && (s.tasks.some(match) || s.lists.some(l => l.tasks.some(match))));
  const renderTask = (task: Task, space?: CatalogSpace) => <div className="plan-catalog-row" key={task.id} data-task-id={task.id}>
    <button type="button" className="plan-catalog-task" disabled={!!savingPriority || !!deleting} aria-pressed={selectedIds.has(task.id)}
      aria-label={`${selectedIds.has(task.id) ? 'Remove' : 'Add'} ${task.name} ${selectedIds.has(task.id) ? 'from' : 'to'} timeblock`}
      onClick={() => selectedIds.has(task.id) ? onRemove(task.id) : onAdd(task)}>
      <span className="plan-catalog-check" aria-hidden="true">{selectedIds.has(task.id) ? '✓' : ''}</span>
      <strong>{task.name}<TaskListBadge taskId={task.id} />{space && <small className="plan-catalog-category" style={{ '--space-color': space.color } as CSSProperties}>{space.name}</small>}</strong>
    </button>
    <div className="plan-catalog-controls">
      <span className="plan-catalog-meta"><span><img src="/rhythm/flow/energy.svg" alt="" />{task.energyRequired}</span><span><img src="/rhythm/flow/duration.svg" alt="" />{formatTaskDuration(task.durationMinutes)}</span></span>
      {onPriorityChange && <PrioritySelector task={task} disabled={!!deleting || !!savingPriority} onChange={patch => onPriorityChange(task.id, patch.priority!)} />}
      {onDelete && <button type="button" className="plan-catalog-delete" disabled={!!deleting || !!savingPriority} aria-label={`Delete ${task.name}`} title="Delete task" onClick={() => onDelete(task)}><img src="/rhythm/flow/catalog-delete.svg" alt="" width={16.23} height={16.23} /></button>}
    </div>
  </div>;
  const ranked = sortByPriority ? visible.flatMap(space => [...space.tasks, ...space.lists.flatMap(list => list.tasks)]
    .filter(match).map(task => ({task, space}))).sort((a, b) => a.task.priority - b.task.priority) : [];
  return <div className="plan-task-catalog" role="group" aria-label="Tasks from all spaces">
    {sortByPriority ? <div className="plan-catalog-ranked">{ranked.map(({task, space}) => renderTask(task, space))}</div> : visible.map(space => <section className="plan-catalog-space" key={space.id} aria-label={space.name} style={{ '--space-color': space.color } as CSSProperties}>
      <button type="button" className="plan-space-heading" aria-expanded={!closed.has(space.id)} onClick={() => toggle(space.id)}>
        <span className="task-icon-tile"><SpaceIcon icon={space.icon} color={space.color} /></span><strong>{space.name}</strong>
        <small>{space.tasks.filter(match).length + space.lists.reduce((sum, list) => sum + list.tasks.filter(match).length, 0)}</small><img className="plan-space-chevron" src="/rhythm/flow/chevron.svg" alt="" />
      </button>
      <div className={`plan-space-reveal${closed.has(space.id) ? ' collapsed' : ''}`} inert={closed.has(space.id)} aria-hidden={closed.has(space.id)}><div className="plan-space-content">
        {space.tasks.filter(match).map(task => renderTask(task))}
        {space.lists.filter(list => list.tasks.some(match)).map(list => <details className="plan-catalog-list" key={list.id} open>
          <summary>{list.name}<small>{list.tasks.filter(match).length} tasks</small></summary><div>{list.tasks.filter(match).map(task => renderTask(task))}</div>
        </details>)}
      </div></div>
    </section>)}
    {!visible.length && <p className="tb-empty">{query ? 'No matching tasks. Press Enter to add a new one.' : 'Your tasks will appear here. Add one above to get started.'}</p>}
  </div>;
}

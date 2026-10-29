import { CircleCheck, ListTodo } from "lucide-react";
import { InlineTaskComposer } from "./InlineTaskComposer";
import { TaskElementSelector } from './TaskElementSelector';
import { TaskListBadge } from "./TaskListBadge";
import { useBlockClear } from "./use-block-clear";
import { useRef, useState, type CSSProperties, type DragEvent } from "react";
import { useTaskWorkspace } from "../task-workspace";
import {
  changeTasks,
  tasksAt,
  reorderTask,
  reorderTaskList,
  groupTasks,
  moveTask,
  updateTask,
  type TaskLocation,
  type TaskReference,
} from "../task-spaces";
import type { Task } from "../types";
import {
  NameListModal,
  TaskSettingsModal,
} from "./task-dialogs";
import { SpaceIcon, TaskAsset } from "./space-icons";

export function TasksPanel({
  onTimeblock,
  onEditList,
  onDeleteList,
}: {
  onTimeblock(id: string): void;
  onEditList(id: string): void;
  onDeleteList(id: string): void;
}) {
  const { library, activeSpaceId, showCompleted, openSpace, selectSpace } =
    useTaskWorkspace();
  const [editScope, setEditScope] = useState<string | null>(null);
  const scopeKey = `${activeSpaceId ?? 'all'}:${showCompleted}`;
  const editingSpace = editScope === scopeKey;
  const [editingList, setEditingList] = useState<string | null>(null);
  const [dragList, setDragList] = useState<string | null>(null);
  const [dropAfter, setDropAfter] = useState(false);
  const isEditing = (listId?: string) => editingSpace || (!!listId && editingList === `${scopeKey}/${listId}`);
  const [search, setSearch] = useState("");
  const [clearing, setClearing] = useState<Set<string>>(() => new Set());
  const retainTask = (id: string, retain: boolean) => setClearing((current) => {
    const next = new Set(current);
    if (retain) next.add(id); else next.delete(id);
    return next;
  });
  const visible = (task: Task) => !!task.completed === showCompleted || (!showCompleted && clearing.has(task.id));
  const [editing, setEditing] = useState<{
    task: Task;
    ref: TaskReference;
  } | null>(null);
  const [listModal, setListModal] = useState<{
    spaceId: string;
    id?: string;
    name?: string;
    source?: TaskReference;
    target?: TaskReference;
  } | null>(null);
  const [drag, setDrag] = useState<TaskReference | null>(null);
  const [drop, setDrop] = useState<string | null>(null);
  const hover = useRef<{ key: string; since: number } | null>(null);
  const [notice, setNotice] = useState("");
  const spaces = (library.spaces ?? []).filter(
    (s) => !activeSpaceId || s.id === activeSpaceId,
  );
  const activeSpace = activeSpaceId ? spaces[0] : undefined;
  const query = search.trim().toLowerCase();
  const clearDrag = () => {
    setDrag(null);
    setDragList(null);
    setDrop(null);
    hover.current = null;
  };
  const over = (e: DragEvent, key: string, spaceId: string, center = false) => {
    if (!drag || drag.spaceId !== spaceId) return;
    if (center && !isEditing(drag.listId)) {
      const r = e.currentTarget.getBoundingClientRect(),
        y = (e.clientY - r.top) / r.height;
      if (y < 0.22 || y > 0.78) {
        setDrop(null);
        hover.current = null;
        return;
      }
    }
    const bounds = e.currentTarget.getBoundingClientRect();
    setDropAfter(e.clientY > bounds.top + bounds.height / 2);
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (hover.current?.key !== key) hover.current = { key, since: Date.now() };
    setDrop(key);
  };
  const dropOnTask = (e: DragEvent, target: TaskReference) => {
    if (dragList) return;
    e.preventDefault();
    e.stopPropagation();
    if (drag && drop === target.taskId && isEditing(drag.listId)) {
      const source = drag;
      void library.save(d => reorderTask(d, source, target, dropAfter)).then(ok => { if (ok) setNotice("Task order saved."); });
      clearDrag();
      return;
    }
    if (
      drag &&
      drop === target.taskId &&
      hover.current?.key === target.taskId &&
      Date.now() - hover.current.since >= 450
    ) {
      setListModal({ spaceId: target.spaceId, source: drag, target });
    }
    clearDrag();
  };
  const dropInto = async (
    e: DragEvent,
    location: TaskLocation,
    key: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (drag && drop === key) {
      if (await library.save((d) => moveTask(d, drag, location)))
        setNotice("Task moved.");
    }
    clearDrag();
  };
  const shiftTask = async (ref: TaskReference, direction: -1 | 1) => {
    const listMatches = library.taskLists.find(l => l.id === ref.listId)?.name.toLowerCase().includes(query);
    const candidates = tasksAt(library, ref).filter(visible).filter(t => listMatches || t.name.toLowerCase().includes(query));
    const target = candidates[candidates.findIndex(t => t.id === ref.taskId) + direction];
    if (target && await library.save(d => reorderTask(d, ref, {...ref, taskId: target.id}, direction === 1))) setNotice("Task order saved.");
  };
  const shiftList = async (id: string, spaceId: string, direction: -1 | 1) => {
    const lists = library.taskLists.filter(l => l.spaceId === spaceId && (!showCompleted || l.tasks.some(visible)) && (l.name.toLowerCase().includes(query) || l.tasks.some(t => visible(t) && t.name.toLowerCase().includes(query))));
    const target = lists[lists.findIndex(l => l.id === id) + direction];
    if (target && await library.save(d => reorderTaskList(d, id, target.id, direction === 1))) setNotice("List order saved.");
  };
  const renderTask = (task: Task, location: TaskLocation) => (
    <TaskRow
      key={task.id}
      task={task}
      editMode={isEditing(location.listId)}
      dropAfter={dropAfter}
      onMove={direction => void shiftTask({...location, taskId: task.id}, direction)}
      onDelete={() => library.save(d => changeTasks(d, location, tasks => tasks.filter(t => t.id !== task.id)))}
      onRetain={(retain) => retainTask(task.id, retain)}
      dragging={drag?.taskId === task.id}
      dropTarget={drop === task.id}
      onDragStart={(e) => {
        e.stopPropagation();
        setDragList(null);
        setDrag({ ...location, taskId: task.id });
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-rhythm-task", task.id);
      }}
      onDragEnd={clearDrag}
      onDragOver={(e) => {
        if (drag?.taskId !== task.id) over(e, task.id, location.spaceId, true);
      }}
      onDragLeave={() => {
        if (drop === task.id) {
          setDrop(null);
          hover.current = null;
        }
      }}
      onDrop={(e) => dropOnTask(e, { ...location, taskId: task.id })}
      onUpdate={(updates) =>
        library.save((d) =>
          updateTask(d, { ...location, taskId: task.id }, updates),
        )
      }
      onSettings={() =>
        setEditing({ task, ref: { ...location, taskId: task.id } })
      }
    />
  );
  return (
    <div className="tasks-panel" id="rhythm-tasks" tabIndex={-1} aria-label="Tasks">
      <header className="tasks-page-header">
        <div className={`tasks-header-identity ${activeSpace && drop === activeSpace.id ? "task-drop-target" : ""}`}
          onDragOver={activeSpace ? (e) => over(e, activeSpace.id, activeSpace.id) : undefined}
          onDrop={activeSpace ? (e) => void dropInto(e, { spaceId: activeSpace.id }, activeSpace.id) : undefined}>
          <span className="task-icon-tile">
            {activeSpace ? <SpaceIcon icon={activeSpace.icon} color={activeSpace.color} /> : showCompleted ? <CircleCheck size={24} aria-hidden="true" /> : <ListTodo size={24} aria-hidden="true" />}
          </span>
          <h1>{showCompleted ? "Completed" : activeSpace?.name ?? "All Tasks"}</h1>
          {activeSpace && <button type="button" className="tasks-header-settings"
            aria-label={`Edit ${activeSpace.name} Space`} onClick={() => openSpace(activeSpace)}>
            <span className="tasks-header-gear"><img src="/rhythm/tasks/header-settings.svg" width={15.1771} height={14.1238} alt="" /></span>
          </button>}
        </div>
        <div className="tasks-header-actions">
          <button type="button" className="tasks-edit-mode" aria-pressed={editingSpace} onClick={() => {
            setEditScope(editingSpace ? null : scopeKey); setEditingList(null); clearDrag();
          }}><img src="/rhythm/tasks/edit-mode.svg" width={24} height={24} alt="" />{editingSpace ? "Done" : "Edit Space"}</button>
        <label className="tasks-search">
          <img className="tasks-header-search-icon" src="/rhythm/tasks/header-search.svg" width={18.4} height={18.4} alt="" />
          <span className="sr-only">Search tasks and lists</span>
          <input type="search" placeholder="Search tasks" value={search}
            onChange={(e) => setSearch(e.target.value)} />
        </label>
        </div>
      </header>
      {(library.error || notice) && (
        <p role={library.error ? "alert" : "status"}>
          {library.error || notice}
        </p>
      )}
      {!spaces.length && (
        <div className="tasks-empty">
          <h2>A space for everything you do.</h2>
          <p>Create your first Space to start adding tasks.</p>
          <button onClick={() => openSpace()}>+ Add New Space</button>
        </div>
      )}
      {showCompleted && !spaces.some((space) => space.tasks.some((t) => t.completed) || library.taskLists.some((list) => list.spaceId === space.id && list.tasks.some((t) => t.completed))) && (
        <div className="tasks-empty"><h2>No completed tasks yet.</h2><p>Tasks you complete in any space will appear here.</p></div>
      )}
      {spaces.map((space) => {
        const lists = library.taskLists.filter((l) => l.spaceId === space.id)
          .map((list) => ({ ...list, tasks: list.tasks.filter(visible) }))
          .filter((list) => !showCompleted || list.tasks.length > 0);
        const direct = space.tasks.filter((t) =>
          visible(t) && t.name.toLowerCase().includes(query),
        );
        const matchingLists = lists.filter(l =>
          l.name.toLowerCase().includes(query) || l.tasks.some(t => t.name.toLowerCase().includes(query)));
        if (showCompleted && !direct.length && !lists.some((list) => list.name.toLowerCase().includes(query) || list.tasks.some((t) => t.name.toLowerCase().includes(query)))) return null;
        return (
          <section
            className="tasks-space"
            key={space.id}
            aria-label={space.name}
            style={{ "--space-color": space.color } as CSSProperties}
          >
            {!activeSpace && <div
              className={`tasks-space-heading ${drop === space.id ? "task-drop-target" : ""}`}
              onDragOver={(e) => over(e, space.id, space.id)}
              onDrop={(e) => void dropInto(e, { spaceId: space.id }, space.id)}
            >
              <button
                className="tasks-space-title"
                onClick={() => {
                  selectSpace(space.id);
                  location.hash = "rhythm-tasks";
                }}
              >
                <span className="task-icon-tile">
                  <SpaceIcon icon={space.icon} color={space.color} />
                </span>
                <h2>{space.name}</h2>
              </button>
              <div>
                <button
                  aria-label={`Edit ${space.name} Space`}
                  onClick={() => openSpace(space)}
                >
                  <span className="tasks-header-gear"><img src="/rhythm/tasks/header-settings.svg" width={15.1771} height={14.1238} alt="" /></span>
                </button>
              </div>
            </div>}
            {!showCompleted && <InlineTaskComposer spaceId={space.id} />}
            <div className="tasks-row-stack">
              {direct.map((t) => renderTask(t, { spaceId: space.id }))}
            </div>
            {matchingLists.map((list) => (
                <details
                  open
                  key={list.id}
                  data-list-id={list.id}
                  className={`tasks-list-group ${isEditing(list.id) ? "editing" : ""} ${dragList === list.id ? "dragging" : ""} ${drop === list.id ? "task-drop-target" : ""}`}
                  onDragOver={(e) => {
                    if (dragList && editingSpace && library.taskLists.find(l => l.id === dragList)?.spaceId === space.id) {
                      e.preventDefault(); e.stopPropagation(); setDrop(list.id);
                      const r = e.currentTarget.getBoundingClientRect(); setDropAfter(e.clientY > r.top + r.height / 2); return;
                    }
                    if (
                      e.target === e.currentTarget ||
                      !(e.target as HTMLElement).closest(".tasks-row")
                    )
                      over(e, list.id, space.id);
                  }}
                  onDrop={(e) => {
                    if (dragList) {
                      e.preventDefault(); e.stopPropagation();
                      if (drop === list.id) void library.save(d => reorderTaskList(d, dragList, list.id, dropAfter)).then(ok => { if (ok) setNotice("List order saved."); });
                      clearDrag(); return;
                    }
                    void dropInto(
                      e,
                      { spaceId: space.id, listId: list.id },
                      list.id,
                    );
                  }}
                >
                  <summary>
                    {editingSpace && <ReorderHandle name={list.name} list onMove={direction => void shiftList(list.id, space.id, direction)} onDragStart={e => {
                      e.stopPropagation(); setDrag(null); setDragList(list.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("application/x-rhythm-list", list.id);
                    }} onDragEnd={clearDrag} />}
                    <span className="task-icon-tile">
                      <TaskAsset name="list-title" style={{ width: 24, height: 24 }} />
                    </span>
                    <strong>{list.name}</strong>
                    <button className="tasks-list-rename" aria-label={`Rename ${list.name}`} onClick={e => {
                      e.preventDefault(); setListModal({ spaceId: space.id, id: list.id, name: list.name });
                    }}><TaskAsset name="list-rename" style={{ width: 19.6, height: 19.6 }} /></button>
                    <span className="tasks-list-count">{list.tasks.length} {list.tasks.length === 1 ? "Task" : "Tasks"}</span>
                    <span className="tasks-list-actions" onClick={e => e.stopPropagation()}>
                      <button className="tasks-edit-mode" aria-pressed={isEditing(list.id)} onClick={e => { e.preventDefault(); setEditingList(isEditing(list.id) ? null : `${scopeKey}/${list.id}`); if (editingSpace) setEditScope(null); clearDrag(); }}><img src="/rhythm/tasks/edit-mode.svg" width={24} height={24} alt="" /><span>{isEditing(list.id) ? "Done" : "Edit List"}</span></button>
                      <button disabled={showCompleted || !list.tasks.some(t => !t.isBreak)} onClick={e => { e.preventDefault(); onTimeblock(list.id); }}><TaskAsset name="list-timeblock" style={{ width: 24, height: 24 }} /><span>Timeblock</span></button>
                      {isEditing(list.id) && <button className="tasks-list-delete" aria-label={`Delete ${list.name} list`} title="Delete list" onClick={e => { e.preventDefault(); onDeleteList(list.id); }}><img src="/rhythm/tasks/edit-delete.svg" width={16.23} height={16.23} alt="" /></button>}
                      <button aria-label={`Settings for ${list.name} list`} title="Edit list" onClick={e => { e.preventDefault(); onEditList(list.id); }}><TaskAsset name="row-imgGear" /></button>
                    </span>
                    <span className="tasks-list-chevron"><TaskAsset name="list-chevron" style={{ width: 21, height: 21 }} /></span>
                  </summary>
                  {!showCompleted && <InlineTaskComposer spaceId={space.id} listId={list.id} listName={list.name} />}
                  <div className="tasks-row-stack">
                    {list.tasks
                      .filter(
                        (t) =>
                          list.name.toLowerCase().includes(query) ||
                          t.name.toLowerCase().includes(query),
                      )
                      .map((t) =>
                        renderTask(t, { spaceId: space.id, listId: list.id }),
                      )}
                    {!list.tasks.length && (
                      <p className="tasks-list-empty">
                        Add a task above or drag one into this list.
                      </p>
                    )}
                  </div>
                </details>
              ))}
            {!direct.length && !matchingLists.length && (
              <p className="tasks-list-empty">
                {query
                  ? "No matching tasks."
                  : "Add a task, then drag tasks together to create a list."}
              </p>
            )}
          </section>
        );
      })}
      {editing && (
        <TaskSettingsModal
          task={editing.task}
          error={library.error}
          onClose={() => setEditing(null)}
          onSave={(task) =>
            library.save((d) => updateTask(d, editing.ref, task))
          }
          onDelete={() =>
            library.save((d) =>
              changeTasks(d, editing.ref, (tasks) =>
                tasks.filter((t) => t.id !== editing.ref.taskId),
              ),
            )
          }
        />
      )}
      {listModal && (
        <NameListModal
          name={listModal.name}
          error={library.error}
          onClose={() => setListModal(null)}
          onSave={async (name) => {
            const options = listModal;
            return library.save((d) => {
              if (options.id)
                return {
                  ...d,
                  taskLists: d.taskLists.map((l) =>
                    l.id === options.id ? { ...l, name } : l,
                  ),
                };
              const list = {
                id: crypto.randomUUID(),
                name,
                spaceId: options.spaceId,
                createdAt: new Date().toISOString(),
                tasks: [],
              };
              return options.source && options.target
                ? groupTasks(d, options.source, options.target, list)
                : { ...d, taskLists: [...d.taskLists, list] };
            });
          }}
        />
      )}
    </div>
  );
}
export function TaskRow({
  task: savedTask,
  onUpdate,
  onSettings,
  onRetain = () => {},
  editMode = false,
  onMove,
  onDelete,
  dropAfter = false,
  dragging = false,
  dropTarget = false,
  ...dragEvents
}: {
  task: Task;
  onUpdate(updates: Partial<Task>): Promise<boolean>;
  onSettings(): void;
  onRetain?: (retain: boolean) => void;
  editMode?: boolean;
  onMove?: (direction: -1 | 1) => void;
  onDelete?: () => Promise<boolean>;
  dropAfter?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: DragEvent) => void;
}) {
  const [optimistic, setOptimistic] = useState<Partial<Task> | null>(null);
  const task = { ...savedTask, ...optimistic };
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const clear = useBlockClear(ref, onRetain);
  const change = async (updates: Partial<Task>) => {
    setBusy(true);
    setOptimistic(updates);
    try {
      return await onUpdate(updates);
    } finally {
      setOptimistic(null);
      setBusy(false);
    }
  };
  return (
    <div className="task-clear-slot" ref={clear.slot}>
    <div
      ref={ref}
      className={`tasks-row ${selectorOpen ? "quick-editor-open" : ""} ${task.completed ? "completed" : ""} ${dragging ? "dragging" : ""} ${dropTarget ? "task-drop-target" : ""}`}
      data-task-id={task.id}
      data-edit-mode={editMode}
      data-drop-edge={editMode && dropTarget ? (dropAfter ? "after" : "before") : undefined}
      draggable={!editMode && !selectorOpen && !clear.active}
      {...dragEvents}
    >
      {editMode && <ReorderHandle name={task.name} onMove={onMove} onDragStart={dragEvents.onDragStart} onDragEnd={dragEvents.onDragEnd} />}
      <label className="task-completion">
        <input
          type="checkbox"
          checked={clear.active || !!task.completed}
          aria-disabled={busy || clear.active}
          aria-label={`Complete ${task.name}`}
          onPointerDown={(e) => { if (e.button === 0 && !task.completed && !busy) clear.press(); }}
          onPointerCancel={clear.release}
          onPointerLeave={clear.release}
          onBlur={clear.release}
          onKeyDown={(e) => { if (e.key === " " && !task.completed && !busy) clear.press(); }}
          onKeyUp={(e) => { if (e.key === "Escape") clear.release(); }}
          onChange={(e) => {
            if (busy || clear.locked.current) return;
            if (e.target.checked) { void clear.complete(() => onUpdate({ completed: true })); }
            else void change({ completed: false });
          }}
        />
        <span aria-hidden="true">
          {(task.completed || clear.active) && <TaskAsset name="row-imgCheckRec" />}
        </span>
      </label>
      <span className="tasks-row-name">{task.name}<TaskListBadge taskId={task.id} /></span>
      <div className="tasks-row-controls">
        <TaskElementSelector task={task} disabled={busy || clear.active} onChange={change} onExpandedChange={setSelectorOpen} />
        <button
          className="task-settings-button"
          disabled={clear.active}
          aria-label={`Settings for ${task.name}`}
          onClick={onSettings}
        >
          <TaskAsset name="row-imgGear" />
        </button>
        {editMode && onDelete && <button className="task-edit-delete" aria-label={`Delete ${task.name}`} disabled={busy || clear.active} onClick={async () => {
          setBusy(true); try { await onDelete(); } finally { setBusy(false); }
        }}><img src="/rhythm/tasks/edit-delete.svg" width={16.23} height={16.23} alt="" /></button>}
      </div>
      {dropTarget && !editMode && (
        <span className="task-group-hint">
          Hold here, then drop to create a Task List
        </span>
      )}
    </div>
    </div>
  );
}

function ReorderHandle({name, list = false, onMove, onDragStart, onDragEnd}: {
  name: string; list?: boolean; onMove?: (direction: -1 | 1) => void;
  onDragStart?: (e: DragEvent) => void; onDragEnd?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return <span className="task-reorder-anchor">
    <button type="button" className="task-reorder-handle" draggable aria-label={`Rearrange ${name}`} title="Drag to rearrange, or use Up and Down arrows" aria-expanded={menu}
      onDragStart={e => { setMenu(false); onDragStart?.(e); }} onDragEnd={onDragEnd}
      onClick={e => {e.preventDefault(); e.stopPropagation(); setMenu(!menu);}}
      onKeyDown={e => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") { e.preventDefault(); e.stopPropagation(); onMove?.(e.key === "ArrowUp" ? -1 : 1); }
        if (e.key === "Escape") setMenu(false);
      }}>
      <img draggable={false} src={`/rhythm/tasks/${list ? "list" : "task"}-drag.svg`} width={list ? 12.7859 : 10} height={list ? 24.2932 : 19} alt="" />
    </button>
    {menu && <span className="task-reorder-menu">
      <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onMove?.(-1); }}>Move up</button>
      <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); onMove?.(1); }}>Move down</button>
    </span>}
  </span>;
}

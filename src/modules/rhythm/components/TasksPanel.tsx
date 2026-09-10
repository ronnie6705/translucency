import { useEffect, useRef, useState, type DragEvent } from "react";
import { useTaskWorkspace } from "../task-workspace";
import {
  changeTasks,
  formatTaskDuration,
  groupTasks,
  moveTask,
  updateTask,
  type TaskLocation,
  type TaskReference,
} from "../task-spaces";
import type { Task } from "../types";
import {
  NameListModal,
  QuickTaskValue,
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
  const { library, activeSpaceId, openTask, openSpace, selectSpace } =
    useTaskWorkspace();
  const [search, setSearch] = useState("");
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
  const query = search.trim().toLowerCase();
  const clearDrag = () => {
    setDrag(null);
    setDrop(null);
    hover.current = null;
  };
  const over = (e: DragEvent, key: string, spaceId: string, center = false) => {
    if (!drag || drag.spaceId !== spaceId) return;
    if (center) {
      const r = e.currentTarget.getBoundingClientRect(),
        y = (e.clientY - r.top) / r.height;
      if (y < 0.22 || y > 0.78) {
        setDrop(null);
        hover.current = null;
        return;
      }
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (hover.current?.key !== key) hover.current = { key, since: Date.now() };
    setDrop(key);
  };
  const dropOnTask = (e: DragEvent, target: TaskReference) => {
    e.preventDefault();
    e.stopPropagation();
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
  const renderTask = (task: Task, location: TaskLocation) => (
    <TaskRow
      key={task.id}
      task={task}
      dragging={drag?.taskId === task.id}
      dropTarget={drop === task.id}
      onDragStart={(e) => {
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
    <div className="tasks-panel" id="rhythm-tasks">
      <div className="tasks-page-header">
        <div>
          <p className="section-kicker">Tasks</p>
          <h1>
            {activeSpaceId
              ? spaces[0]?.name
              : "Your tasks, in their own space."}
          </h1>
        </div>
        <label>
          <span className="sr-only">Search tasks and lists</span>
          <input
            type="search"
            placeholder="Search tasks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <button
        className="tasks-add-button"
        aria-label="Add Task"
        onClick={openTask}
      >
        <TaskAsset name="add-imgPlusRec1" />
        Add Task<kbd>⌘ / Ctrl + Space</kbd>
      </button>
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
      {spaces.map((space) => {
        const lists = library.taskLists.filter((l) => l.spaceId === space.id);
        const direct = space.tasks.filter((t) =>
          t.name.toLowerCase().includes(query),
        );
        return (
          <section
            className="tasks-space"
            key={space.id}
            aria-label={space.name}
          >
            <div
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
                  <TaskAsset name="row-imgGear" />
                </button>
                <button onClick={() => setListModal({ spaceId: space.id })}>
                  + Add New Task List
                </button>
              </div>
            </div>
            <div className="tasks-row-stack">
              {direct.map((t) => renderTask(t, { spaceId: space.id }))}
            </div>
            {lists
              .filter(
                (l) =>
                  l.name.toLowerCase().includes(query) ||
                  l.tasks.some((t) => t.name.toLowerCase().includes(query)),
              )
              .map((list) => (
                <details
                  open
                  key={list.id}
                  className={`tasks-list-group ${drop === list.id ? "task-drop-target" : ""}`}
                  onDragOver={(e) => {
                    if (
                      e.target === e.currentTarget ||
                      !(e.target as HTMLElement).closest(".tasks-row")
                    )
                      over(e, list.id, space.id);
                  }}
                  onDrop={(e) =>
                    void dropInto(
                      e,
                      { spaceId: space.id, listId: list.id },
                      list.id,
                    )
                  }
                >
                  <summary>
                    <span className="task-icon-tile">
                      <TaskAsset name="add-imgListUnordered4Rec" />
                    </span>
                    <strong>{list.name}</strong>
                    <span>{list.tasks.length} tasks</span>
                  </summary>
                  <div className="tasks-list-actions">
                    <button
                      onClick={() =>
                        setListModal({
                          spaceId: space.id,
                          id: list.id,
                          name: list.name,
                        })
                      }
                    >
                      Rename
                    </button>
                    <button onClick={() => onEditList(list.id)}>
                      Edit list
                    </button>
                    <button onClick={() => onTimeblock(list.id)}>
                      Timeblock
                    </button>
                    <button onClick={() => onDeleteList(list.id)}>
                      Delete list
                    </button>
                  </div>
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
                        Drag a task here or choose this list when adding a task.
                      </p>
                    )}
                  </div>
                </details>
              ))}
            {!direct.length && !lists.length && (
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
function TaskRow({
  task: savedTask,
  onUpdate,
  onSettings,
  dragging,
  dropTarget,
  ...dragEvents
}: {
  task: Task;
  onUpdate(updates: Partial<Task>): Promise<boolean>;
  onSettings(): void;
  dragging: boolean;
  dropTarget: boolean;
  onDragStart(e: DragEvent): void;
  onDragEnd(): void;
  onDragOver(e: DragEvent): void;
  onDragLeave(): void;
  onDrop(e: DragEvent): void;
}) {
  const [optimistic, setOptimistic] = useState<Partial<Task> | null>(null);
  const task = { ...savedTask, ...optimistic };
  const [quick, setQuick] = useState<"energy" | "time" | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!quick) return;
    const outside = (e: MouseEvent | FocusEvent) => {
      if (!ref.current?.contains(e.target as Node)) setQuick(null);
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [quick]);
  const change = async (updates: Partial<Task>) => {
    setBusy(true);
    setOptimistic(updates);
    await onUpdate(updates);
    setOptimistic(null);
    setBusy(false);
  };
  return (
    <div
      ref={ref}
      className={`tasks-row ${task.completed ? "completed" : ""} ${dragging ? "dragging" : ""} ${dropTarget ? "task-drop-target" : ""}`}
      data-task-id={task.id}
      draggable={!quick}
      {...dragEvents}
    >
      <label className="task-completion">
        <input
          type="checkbox"
          checked={!!task.completed}
          disabled={busy}
          aria-label={`Complete ${task.name}`}
          onChange={(e) => void change({ completed: e.target.checked })}
        />
        <span aria-hidden="true">
          {task.completed && <TaskAsset name="row-imgCheckRec" />}
        </span>
      </label>
      <span className="tasks-row-name">{task.name}</span>
      <div className="tasks-row-controls">
        <div className="task-quick-anchor">
          <button
            disabled={busy}
            aria-label={`Edit energy for ${task.name}`}
            aria-expanded={quick === "energy"}
            onClick={() => setQuick(quick === "energy" ? null : "energy")}
          >
            <TaskAsset name="row-imgLightning" />
            {task.energyRequired}
          </button>
          {quick === "energy" && (
            <QuickTaskValue
              task={task}
              mode="energy"
              onChange={(u) => void change(u)}
              onClose={() => setQuick(null)}
            />
          )}
        </div>
        <div className="task-quick-anchor">
          <button
            disabled={busy}
            aria-label={`Edit duration for ${task.name}`}
            aria-expanded={quick === "time"}
            onClick={() => setQuick(quick === "time" ? null : "time")}
          >
            <TaskAsset name="row-imgStopwatch" />
            {formatTaskDuration(task.durationMinutes)}
          </button>
          {quick === "time" && (
            <QuickTaskValue
              task={task}
              mode="time"
              onChange={(u) => void change(u)}
              onClose={() => setQuick(null)}
            />
          )}
        </div>
        <button
          className="task-settings-button"
          aria-label={`Settings for ${task.name}`}
          onClick={onSettings}
        >
          <TaskAsset name="row-imgGear" />
        </button>
      </div>
      {dropTarget && (
        <span className="task-group-hint">
          Hold here, then drop to create a Task List
        </span>
      )}
    </div>
  );
}

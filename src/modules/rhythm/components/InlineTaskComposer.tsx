import { useRef, useState, type PointerEvent } from "react";
import { useTaskWorkspace } from "../task-workspace";
import { changeTasks, formatTaskDuration, type TaskLocation } from "../task-spaces";
import type { Task } from "../types";
import { QuickTaskValue } from "./task-dialogs";
import { TaskAsset } from "./space-icons";
import { taskEnergyStyle } from "../task-energy";

type Mode = "task" | "list";

/** Keeps hover previews separate from focused or unsaved entry. */
export function InlineTaskComposer({ spaceId, listId, listName }: TaskLocation & { listName?: string }) {
  const { library } = useTaskWorkspace();
  const [mode, setMode] = useState<Mode | null>(null);
  const [taskName, setTaskName] = useState("");
  const [listTitle, setListTitle] = useState("");
  const [values, setValues] = useState({ durationMinutes: 90, energyRequired: 3 as Task["energyRequired"] });
  const [quick, setQuick] = useState<"energy" | "time" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const taskInput = useRef<HTMLInputElement>(null);
  const listInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const pinned = !!taskName || !!listTitle || !!quick || busy;
  const preview = (next: Mode, event: PointerEvent) => {
    if (!listId && event.pointerType === "mouse" && !pinned && !root.current?.contains(document.activeElement)) setMode(next);
  };
  const leave = () => {
    if (!pinned && !root.current?.contains(document.activeElement)) setMode(null);
  };
  const activate = (next: Mode) => {
    setMode(next);
    requestAnimationFrame(() => (next === "task" ? taskInput : listInput).current?.focus());
  };
  const save = async (kind: Mode) => {
    const name = (kind === "task" ? taskName : listTitle).trim();
    if (!name || saving.current || !library.ready) return;
    saving.current = true;
    setBusy(true); setError("");
    const id = crypto.randomUUID();
    try {
      const ok = await library.save(d => kind === "task"
        ? changeTasks(d, { spaceId, listId }, tasks => [...tasks, { id, name, ...values, priority: 2, completed: false }])
        : { ...d, taskLists: [...d.taskLists, { id, name, spaceId, createdAt: new Date().toISOString(), tasks: [] }] });
      if (ok) {
        if (kind === "task") setTaskName(""); else setListTitle("");
        setNotice(`${kind === "task" ? "Task" : "Task list"} added.`);
        requestAnimationFrame(() => (kind === "task" ? taskInput : listInput).current?.focus());
      } else setError("Couldn’t save. Your entry is still here—please try again.");
    } catch { setError("Couldn’t save. Your entry is still here—please try again."); }
    finally { saving.current = false; setBusy(false); }
  };
  const picker = (kind: "energy" | "time") => (
    <div className="task-quick-anchor">
      <button type="button" disabled={busy} className={kind === "energy" ? "task-energy-value" : undefined}
        style={kind === "energy" ? taskEnergyStyle(values.energyRequired) : undefined}
        aria-label={kind === "energy" ? "Task energy" : "Task duration"} aria-expanded={quick === kind}
        onClick={() => { setMode("task"); setQuick(quick === kind ? null : kind); }}>
        <TaskAsset name={kind === "energy" ? "composer-energy" : "composer-duration"} />
        {taskName && <span>{kind === "energy" ? values.energyRequired : formatTaskDuration(values.durationMinutes)}</span>}
      </button>
      {quick === kind && <QuickTaskValue task={values} mode={kind}
        onChange={updates => { setValues(v => ({ ...v, ...updates })); return true; }}
        onClose={() => { setQuick(null); taskInput.current?.focus(); }} />}
    </div>
  );
  return <div ref={root} className={`inline-create ${listId ? "inline-create-in-list" : ""}`} data-mode={mode ?? "idle"}
    onPointerLeave={leave}
    onBlur={e => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setQuick(null);
        if (!taskName && !listTitle && !busy) setMode(null);
      }
    }}
    onKeyDown={e => {
      if (e.key === "Escape" && !busy) {
        e.preventDefault(); e.stopPropagation();
        if (quick) { setQuick(null); taskInput.current?.focus(); return; }
        setMode(null);
        (document.activeElement as HTMLElement)?.blur();
        requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(`.inline-create-trigger[data-kind="${mode ?? "task"}"]`)?.focus());
      }
    }}>
    <div className="inline-create-lanes">
      {(["task", ...(!listId ? ["list"] : [])] as Mode[]).map(kind => {
        const active = mode === kind;
        return <div key={kind} className={`inline-create-lane lane-${kind}`} aria-hidden={mode !== null && !active ? true : undefined} inert={mode !== null && !active ? true : undefined}
          onPointerEnter={e => preview(kind, e)}>
          <form aria-hidden={!active && !listId ? true : undefined} className="inline-create-form" aria-label={kind === "task" ? `Add task to ${listName ?? "Space"}` : "Add task list"}
            onSubmit={e => { e.preventDefault(); if (!quick) void save(kind); }}>
            <span className="inline-create-icon" aria-hidden="true"><TaskAsset name={listId ? "composer-list-plus" : kind === "task" ? "composer-add-task" : "composer-add-list"} /></span>
            <input ref={kind === "task" ? taskInput : listInput} className="inline-create-name" disabled={busy}
              tabIndex={active ? 0 : -1} aria-label={kind === "task" ? "Task name" : "Task list name"}
              placeholder={kind === "task" ? listId ? `Add Task to ${listName}` : "Enter your Task" : "Enter your Task List Name"}
              maxLength={kind === "task" ? 500 : 100} value={kind === "task" ? taskName : listTitle}
              onFocus={() => setMode(kind)} onChange={e => { (kind === "task" ? setTaskName : setListTitle)(e.target.value); setError(""); setNotice(""); }} />
            <div className="inline-create-controls" inert={!active && !listId ? true : undefined}>
              {kind === "task" && <>{picker("energy")}{picker("time")}</>}
              {(!listId || active) && <button type="submit" disabled={busy || !library.ready || !(kind === "task" ? taskName : listTitle).trim()}>{busy ? "Saving…" : "Save"}</button>}
            </div>
          </form>
          {!active && <button type="button" className="inline-create-trigger" data-kind={kind}
            onClick={() => activate(kind)} aria-label={kind === "task" ? listId ? `Add Task to ${listName}` : "Add Task" : "Add Task List"}>
            <span className="inline-create-icon" aria-hidden="true"><TaskAsset name={listId ? "composer-list-plus" : kind === "task" ? "composer-add-task" : "composer-add-list"} /></span>
            {kind === "task" ? listId ? `Add Task to ${listName}` : "Add Task" : "Add Task List"}
          </button>}
        </div>;
      })}
    </div>
    {error && <p role="alert" className="inline-create-error">{error}</p>}
    <span role="status" className="sr-only">{notice}</span>
  </div>;
}

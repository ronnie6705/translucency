import { useRef, useState } from "react";
import type { Space, Task } from "../types";
import type { useRhythmLibrary } from "../use-library";
import {
  changeTasks,
  fixedTimeDuration,
  type TaskLocation,
} from "../task-spaces";
import { TaskModal } from "./TaskModal";
import { SpaceIcon, TaskAsset, spaceColors, spaceIcons } from "./space-icons";
import { TaskDetailFields } from "./TaskDetailFields";

type Library = ReturnType<typeof useRhythmLibrary>;
export function SpaceEditor({
  initial,
  onSave,
  onClose,
  error,
}: {
  initial?: Space;
  onSave(space: Space): Promise<boolean>;
  onClose(): void;
  error?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "general");
  const [color, setColor] = useState(initial?.color ?? "#ffffff");
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <TaskModal
      label={initial ? "Edit Space" : "Add New Space"}
      onClose={onClose}
    >
      <form
        className="task-small-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim() || busy) return;
          setBusy(true);
          if (
            await onSave({
              ...initial,
              id: initial?.id ?? crypto.randomUUID(),
              name: name.trim(),
              icon,
              color,
              createdAt: initial?.createdAt ?? new Date().toISOString(),
              tasks: initial?.tasks ?? [],
            })
          )
            onClose();
          setBusy(false);
        }}
      >
        <div className="task-modal-heading">
          <h2>{initial ? "Edit Space" : "Add New Space"}</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="space-name-input">
          <button
            className="space-preview"
            type="button"
            aria-label="Choose Space icon and colour"
            aria-expanded={picker}
            onClick={() => setPicker(!picker)}
          >
            <SpaceIcon icon={icon} color={color} />
          </button>
          <label>
            Space name
            <input
              autoFocus
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home"
            />
          </label>
        </div>
        {picker && (
          <div className="space-picker">
            <div
              className="space-icon-grid"
              role="group"
              aria-label="Space icon"
            >
              {spaceIcons.map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  aria-label={label}
                  title={label}
                  aria-pressed={icon === id}
                  onClick={() => setIcon(id)}
                >
                  <SpaceIcon icon={id} color={color} />
                </button>
              ))}
            </div>
            <div className="space-colors" role="group" aria-label="Icon colour">
              {spaceColors.map((c, i) => (
                <button
                  type="button"
                  key={c}
                  aria-label={
                    [
                      "White",
                      "Purple",
                      "Blue",
                      "Teal",
                      "Green",
                      "Yellow",
                      "Orange",
                      "Pink",
                    ][i]
                  }
                  aria-pressed={color === c}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                >
                  {color === c ? "✓" : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="task-form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button disabled={!name.trim() || busy} type="submit">
            {busy ? "Saving…" : initial ? "Save Space" : "Create Space"}
          </button>
        </div>
      </form>
    </TaskModal>
  );
}
export function NameListModal({
  name = "",
  onSave,
  onClose,
  error,
}: {
  name?: string;
  onSave(name: string): Promise<boolean>;
  onClose(): void;
  error?: string;
}) {
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  return (
    <TaskModal
      label={name ? "Rename Task List" : "Add New Task List"}
      onClose={onClose}
    >
      <form
        className="task-small-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!value.trim() || busy) return;
          setBusy(true);
          if (await onSave(value.trim())) onClose();
          setBusy(false);
        }}
      >
        <div className="task-modal-heading">
          <h2>{name ? "Rename Task List" : "Add New Task List"}</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <label>
          Task List name
          <input
            autoFocus
            required
            maxLength={100}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <div className="task-form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button disabled={!value.trim() || busy}>Save Task List</button>
        </div>
      </form>
    </TaskModal>
  );
}
export function QuickTaskValue({
  task,
  mode,
  onChange,
  onClose,
}: {
  task: Pick<Task, "durationMinutes" | "energyRequired">;
  mode: "energy" | "time";
  onChange(updates: Partial<Task>): void | boolean | Promise<boolean>;
  onClose(): void;
}) {
  const [hours, setHours] = useState(
    String(Math.floor(task.durationMinutes / 60)),
  );
  const [minutes, setMinutes] = useState(String(task.durationMinutes % 60));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (updates: Partial<Task>) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      if (await onChange(updates) === false) {
        setError("Your change wasn’t saved. Please try again.");
      } else {
        onClose();
      }
    } catch {
      setError("Your change wasn’t saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="task-quick-editor"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {mode === "energy" ? (
        <>
          <p>Estimated Energy</p>
          <div className="task-energy-options">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                autoFocus={n === task.energyRequired}
                type="button"
                key={n}
                disabled={saving}
                aria-pressed={n === task.energyRequired}
                onClick={() => {
                  void save({ energyRequired: n as Task["energyRequired"] });
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p>Estimated Time</p>
          <div className="task-duration-inputs">
            <label>
              Hours
              <input
                autoFocus
                type="number"
                min={0}
                max={168}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </label>
            <label>
              Minutes
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={
              saving ||
              Number(hours) * 60 + Number(minutes) <= 0 ||
              Number(hours) < 0 ||
              Number(hours) > 168 ||
              Number(minutes) < 0 ||
              Number(minutes) > 59
            }
            onClick={() => {
              void save({
                durationMinutes: Number(hours) * 60 + Number(minutes),
              });
            }}
          >
            Apply
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function AddTaskOverlay({
  library,
  spaceId,
  onClose,
}: {
  library: Library;
  spaceId: string | null;
  onClose(): void;
}) {
  const [name, setName] = useState("");
  const [task, setTask] = useState({
    durationMinutes: 90,
    energyRequired: 3 as Task["energyRequired"],
  });
  const [destination, setDestination] = useState<TaskLocation | null>(
    spaceId ? { spaceId } : null,
  );
  const [expanded, setExpanded] = useState<string | null>(spaceId);
  const [quick, setQuick] = useState<"energy" | "time" | null>(null);
  const [newSpace, setNewSpace] = useState(false);
  const [newList, setNewList] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const hasName = !!name.trim();
  const spaces = (library.spaces ?? []).filter(
    (s) => !spaceId || s.id === spaceId,
  );
  const buildTask = (): Task => ({
    id: crypto.randomUUID(),
    name: name.trim(),
    ...task,
    priority: 2,
    completed: false,
  });
  const save = async () => {
    if (!hasName || busy) return;
    if (!destination) {
      setError("Choose a Space or Task List for this task.");
      return;
    }
    setBusy(true);
    if (
      await library.save((d) =>
        changeTasks(d, destination, (tasks) => [...tasks, buildTask()]),
      )
    )
      onClose();
    setBusy(false);
  };
  return (
    <>
      <TaskModal label="Add Task" wide onClose={onClose}>
        <div className="task-composer">
          <form
            className="task-composer-input"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <input
              ref={nameRef}
              autoFocus
              aria-label="Task name"
              placeholder="What is your task?"
              value={name}
              maxLength={500}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
            />
            <div className="task-composer-controls">
              <div className="task-quick-anchor">
                <button
                  type="button"
                  aria-label="Estimated energy"
                  aria-expanded={quick === "energy"}
                  onClick={() => setQuick(quick === "energy" ? null : "energy")}
                >
                  <TaskAsset name="add-imgLightning" />
                </button>
                {quick === "energy" && (
                  <QuickTaskValue
                    task={task}
                    mode="energy"
                    onChange={(u) => setTask((t) => ({ ...t, ...u }))}
                    onClose={() => {
                      setQuick(null);
                      nameRef.current?.focus();
                    }}
                  />
                )}
              </div>
              <div className="task-quick-anchor">
                <button
                  type="button"
                  aria-label="Estimated duration"
                  aria-expanded={quick === "time"}
                  onClick={() => setQuick(quick === "time" ? null : "time")}
                >
                  <TaskAsset name="add-imgStopwatch" />
                </button>
                {quick === "time" && (
                  <QuickTaskValue
                    task={task}
                    mode="time"
                    onChange={(u) => setTask((t) => ({ ...t, ...u }))}
                    onClose={() => {
                      setQuick(null);
                      nameRef.current?.focus();
                    }}
                  />
                )}
              </div>
              <button
                className="task-save"
                type="submit"
                disabled={!hasName || busy || !library.ready}
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
          <div
            className={`task-step-details-wrapper task-destination-drawer ${hasName ? "visible expanded" : "hidden collapsed"}`}
            aria-hidden={!hasName}
            inert={!hasName}
          >
            <div
              className={`task-step-details task-destinations ${hasName ? "open" : "collapsed"}`}
            >
              <p className="task-destination-label">
                {spaceId ? "ADD TO THIS SPACE" : "ADD TO A SPACE"}
              </p>
              {spaces.map((space) => (
                <div
                  className={`task-destination-space ${expanded === space.id ? "expanded" : ""}`}
                  key={space.id}
                >
                  <div
                    className={`task-destination-header ${destination?.spaceId === space.id && !destination.listId ? "chosen" : ""}`}
                  >
                    <button
                      type="button"
                      aria-pressed={
                        destination?.spaceId === space.id && !destination.listId
                      }
                      onClick={() => {
                        setDestination({ spaceId: space.id });
                        setExpanded(space.id);
                        setError("");
                      }}
                    >
                      <span className="task-icon-tile">
                        <SpaceIcon icon={space.icon} color={space.color} />
                      </span>
                      {space.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`${expanded === space.id ? "Collapse" : "Expand"} ${space.name}`}
                      aria-expanded={expanded === space.id}
                      onClick={() =>
                        setExpanded(expanded === space.id ? null : space.id)
                      }
                    >
                      <TaskAsset
                        name="add-imgFrame266"
                        style={{
                          transform:
                            expanded === space.id
                              ? "rotate(180deg)"
                              : undefined,
                        }}
                      />
                    </button>
                  </div>
                  {expanded === space.id && (
                    <div
                      className={`task-destination-lists${spaceId ? " scoped" : ""}`}
                    >
                      {library.taskLists
                        .filter((l) => l.spaceId === space.id)
                        .map((list) => (
                          <button
                            type="button"
                            key={list.id}
                            className={`task-destination-list ${destination?.listId === list.id ? "chosen" : ""}`}
                            aria-pressed={destination?.listId === list.id}
                            onClick={() => {
                              setDestination({
                                spaceId: space.id,
                                listId: list.id,
                              });
                              setError("");
                            }}
                          >
                            <span className="task-icon-tile">
                              <TaskAsset name="add-imgListUnordered4Rec" />
                            </span>
                            {list.name}
                          </button>
                        ))}
                      <button
                        type="button"
                        className="task-destination-list task-create-destination"
                        onClick={() => setNewList(space.id)}
                      >
                        <span className="task-icon-tile">
                          <TaskAsset name="add-imgPlusRec" />
                        </span>
                        + Add New Task List
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!spaceId && (
                <button
                  type="button"
                  className="task-destination-header task-create-destination"
                  onClick={() => setNewSpace(true)}
                >
                  <span className="task-icon-tile">
                    <TaskAsset name="add-imgPlusRec1" />
                  </span>
                  + Add New Space
                </button>
              )}
              {(error || library.error) && (
                <p role="alert">{error || library.error}</p>
              )}
            </div>
          </div>
        </div>
      </TaskModal>
      {newSpace && (
        <SpaceEditor
          onClose={() => setNewSpace(false)}
          error={library.error}
          onSave={async (space) => {
            const ok = await library.save((d) => ({
              ...d,
              spaces: [...(d.spaces ?? []), { ...space, tasks: [buildTask()] }],
            }));
            if (ok) onClose();
            return ok;
          }}
        />
      )}
      {newList && (
        <NameListModal
          onClose={() => setNewList(null)}
          error={library.error}
          onSave={async (listName) => {
            const id = crypto.randomUUID();
            const ok = await library.save((d) => ({
              ...d,
              taskLists: [
                ...d.taskLists,
                {
                  id,
                  name: listName,
                  spaceId: newList,
                  createdAt: new Date().toISOString(),
                  tasks: [],
                },
              ],
            }));
            if (ok) {
              setDestination({ spaceId: newList, listId: id });
              setExpanded(newList);
            }
            return ok;
          }}
        />
      )}
    </>
  );
}
export function TaskSettingsModal({
  task,
  onSave,
  onDelete,
  onClose,
  error,
}: {
  task: Task;
  onSave(task: Task): Promise<boolean>;
  onDelete(): Promise<boolean>;
  onClose(): void;
  error?: string;
}) {
  const [draft, setDraft] = useState(task);
  const [fixedEnd, setFixedEnd] = useState("");
  const [fixedTimeError, setFixedTimeError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (updates: Partial<Task>) =>
    setDraft((d) => ({ ...d, ...updates }));
  const handleFixedTimeChange = (field: "start" | "end", value: string) => {
    const start = field === "start" ? value : (draft.fixedStart ?? ""),
      end = field === "end" ? value : fixedEnd;
    if (field === "start") set({ fixedStart: value || undefined });
    else setFixedEnd(value);
    const duration = fixedTimeDuration(start, end);
    setFixedTimeError(
      duration !== null && duration <= 0
        ? "End time must be after start time"
        : "",
    );
    if (duration !== null && duration > 0) set({ durationMinutes: duration });
  };
  return (
    <TaskModal label="Task Details" onClose={onClose}>
      <form
        className="task-small-form task-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          if (await onSave({ ...draft, name: draft.name.trim() })) onClose();
          setBusy(false);
        }}
      >
        <div className="task-modal-heading">
          <h2>Task Details</h2>
          <button type="button" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <label>
          Task name
          <input
            autoFocus
            required
            maxLength={500}
            value={draft.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <TaskDetailFields
          open
          hasName={!!draft.name.trim()}
          energy={draft.energyRequired}
          hours={Math.floor(draft.durationMinutes / 60)}
          minutes={draft.durationMinutes % 60}
          isBreak={!!draft.isBreak}
          fixedStart={draft.fixedStart ?? ""}
          fixedEnd={fixedEnd}
          fixedTimeError={fixedTimeError}
          setEnergy={(energyRequired) =>
            set({ energyRequired: energyRequired as Task["energyRequired"] })
          }
          setHours={(hours) =>
            set({ durationMinutes: hours * 60 + (draft.durationMinutes % 60) })
          }
          setMinutes={(minutes) =>
            set({
              durationMinutes:
                Math.floor(draft.durationMinutes / 60) * 60 + minutes,
            })
          }
          setIsBreak={(isBreak) => set({ isBreak })}
          handleFixedTimeChange={handleFixedTimeChange}
        />
        {error && <p role="alert">{error}</p>}
        <div className="task-form-actions">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              if (await onDelete()) onClose();
              setBusy(false);
            }}
          >
            Delete task
          </button>
          <button
            type="submit"
            disabled={
              busy ||
              !draft.name.trim() ||
              draft.durationMinutes <= 0 ||
              !!fixedTimeError
            }
          >
            Save changes
          </button>
        </div>
      </form>
    </TaskModal>
  );
}

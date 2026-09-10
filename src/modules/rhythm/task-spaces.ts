import type { RhythmLibrary } from "./library";
import type { Task, SavedTaskList } from "./types";

export interface TaskLocation {
  spaceId: string;
  listId?: string;
}
export interface TaskReference extends TaskLocation {
  taskId: string;
}
export function tasksAt(data: RhythmLibrary, location: TaskLocation): Task[] {
  if (location.listId) {
    const list = data.taskLists.find(
      (l) => l.id === location.listId && l.spaceId === location.spaceId,
    );
    if (!list)
      throw new Error(
        "This task list no longer exists. Choose another destination.",
      );
    return list.tasks;
  }
  const space = data.spaces?.find((s) => s.id === location.spaceId);
  if (!space)
    throw new Error("This Space no longer exists. Choose another destination.");
  return space.tasks;
}
export function changeTasks(
  data: RhythmLibrary,
  location: TaskLocation,
  change: (tasks: Task[]) => Task[],
): RhythmLibrary {
  const tasks = change(tasksAt(data, location));
  return location.listId
    ? {
        ...data,
        taskLists: data.taskLists.map((l) =>
          l.id === location.listId ? { ...l, tasks } : l,
        ),
      }
    : {
        ...data,
        spaces: data.spaces?.map((s) =>
          s.id === location.spaceId ? { ...s, tasks } : s,
        ),
      };
}
export function updateTask(
  data: RhythmLibrary,
  ref: TaskReference,
  updates: Partial<Task>,
): RhythmLibrary {
  if (!tasksAt(data, ref).some((t) => t.id === ref.taskId))
    throw new Error("This task no longer exists.");
  return changeTasks(data, ref, (tasks) =>
    tasks.map((t) =>
      t.id === ref.taskId ? { ...t, ...updates, id: t.id } : t,
    ),
  );
}
export function moveTask(
  data: RhythmLibrary,
  ref: TaskReference,
  destination: TaskLocation,
): RhythmLibrary {
  const task = tasksAt(data, ref).find((t) => t.id === ref.taskId);
  if (!task) throw new Error("This task no longer exists.");
  if (ref.spaceId === destination.spaceId && ref.listId === destination.listId)
    return data;
  tasksAt(data, destination);
  const next = changeTasks(data, ref, (tasks) =>
    tasks.filter((t) => t.id !== task.id),
  );
  return changeTasks(next, destination, (tasks) => [...tasks, task]);
}
export function groupTasks(
  data: RhythmLibrary,
  source: TaskReference,
  target: TaskReference,
  list: SavedTaskList,
): RhythmLibrary {
  if (
    source.spaceId !== target.spaceId ||
    source.taskId === target.taskId ||
    list.spaceId !== target.spaceId
  )
    throw new Error("Choose two different tasks in the same Space.");
  const first = tasksAt(data, source).find((t) => t.id === source.taskId);
  const second = tasksAt(data, target).find((t) => t.id === target.taskId);
  if (!first || !second)
    throw new Error("A task was moved or deleted. Please try again.");
  if (data.taskLists.some((l) => l.id === list.id))
    throw new Error("This task list already exists.");
  let next = changeTasks(data, source, (tasks) =>
    tasks.filter((t) => t.id !== first.id),
  );
  next = changeTasks(next, target, (tasks) =>
    tasks.filter((t) => t.id !== second.id),
  );
  return {
    ...next,
    taskLists: [{ ...list, tasks: [second, first] }, ...next.taskLists],
  };
}
export function fixedTimeDuration(start: string, end: string) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number),
    [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}
export function formatTaskDuration(total: number) {
  const h = Math.floor(total / 60),
    m = total % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

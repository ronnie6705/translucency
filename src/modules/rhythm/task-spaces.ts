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
  const withUpdatedLocation = changeTasks(data, ref, (tasks) =>
    tasks.map((t) =>
      t.id === ref.taskId ? { ...t, ...updates, id: t.id } : t,
    ),
  );
  const timeblocks = withUpdatedLocation.timeblocks.map((b) => ({
    ...b,
    tasks: b.tasks.map((t) =>
      t.id === ref.taskId ? { ...t, ...updates, id: t.id } : t,
    ),
  }));
  let liveTimer = withUpdatedLocation.liveTimer;
  if (liveTimer && liveTimer.blocks.some((b) => b.taskId === ref.taskId)) {
    liveTimer = {
      ...liveTimer,
      blocks: liveTimer.blocks.map((b) =>
        b.taskId === ref.taskId
          ? {
              ...b,
              taskName: updates.name !== undefined ? updates.name : b.taskName,
              energyRequired:
                updates.energyRequired !== undefined
                  ? updates.energyRequired
                  : b.energyRequired,
            }
          : b,
      ),
    };
  }
  if (liveTimer !== withUpdatedLocation.liveTimer) {
    return {
      ...withUpdatedLocation,
      timeblocks,
      liveTimer,
    };
  }
  return {
    ...withUpdatedLocation,
    timeblocks,
  };
}

export function findTaskReference(
  data: RhythmLibrary,
  taskId: string,
): TaskReference | null {
  if (data.spaces) {
    for (const space of data.spaces) {
      if (space.tasks.some((t) => t.id === taskId)) {
        return { spaceId: space.id, taskId };
      }
    }
  }
  for (const list of data.taskLists) {
    if (list.tasks.some((t) => t.id === taskId)) {
      return { spaceId: list.spaceId ?? "", listId: list.id, taskId };
    }
  }
  return null;
}

export function updateTimeblockTask(
  data: RhythmLibrary,
  timeblockId: string,
  taskId: string,
  updates: Partial<Task>,
): RhythmLibrary {
  const tb = data.timeblocks.find((t) => t.id === timeblockId);
  if (!tb) throw new Error("This timeblock no longer exists.");
  if (!tb.tasks.some((t) => t.id === taskId))
    throw new Error("This task is not part of the timeblock.");

  const updatedTimeblocks = data.timeblocks.map((b) =>
    b.id === timeblockId
      ? {
          ...b,
          tasks: b.tasks.map((t) =>
            t.id === taskId ? { ...t, ...updates, id: t.id } : t,
          ),
        }
      : b,
  );

  const updatedSpaces = data.spaces?.map((space) => ({
    ...space,
    tasks: space.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, id: t.id } : t,
    ),
  }));

  const updatedTaskLists = data.taskLists.map((list) => ({
    ...list,
    tasks: list.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates, id: t.id } : t,
    ),
  }));

  let updatedLiveTimer = data.liveTimer;
  if (
    updatedLiveTimer &&
    (updatedLiveTimer.id === timeblockId || updatedLiveTimer.name === tb.name)
  ) {
    updatedLiveTimer = {
      ...updatedLiveTimer,
      blocks: updatedLiveTimer.blocks.map((b) =>
        b.taskId === taskId
          ? {
              ...b,
              taskName: updates.name !== undefined ? updates.name : b.taskName,
              energyRequired:
                updates.energyRequired !== undefined
                  ? updates.energyRequired
                  : b.energyRequired,
            }
          : b,
      ),
    };
  }

  const result: RhythmLibrary = {
    ...data,
    timeblocks: updatedTimeblocks,
    spaces: updatedSpaces,
    taskLists: updatedTaskLists,
  };
  if (updatedLiveTimer !== undefined) {
    result.liveTimer = updatedLiveTimer;
  }
  return result;
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

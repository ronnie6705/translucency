import type { CSSProperties } from "react";
import { useTaskWorkspace } from "../task-workspace";

/** Resolve current membership so renames and moves update every task surface. */
export function TaskListBadge({ taskId }: { taskId: string }) {
  const { library } = useTaskWorkspace();
  const list = library.taskLists.find((list) => list.tasks.some((task) => task.id === taskId));
  if (!list) return null;
  const space = library.spaces?.find((space) => space.id === list.spaceId);
  return <span style={{ "--task-list-color": space?.color ?? "#ffffff" } as CSSProperties} className="task-list-badge" title={list.name} aria-label={`Task list: ${list.name}`}>{list.name}</span>;
}

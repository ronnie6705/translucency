import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyLibrary,
  mergeLibraries,
  validateLibrary,
} from "../src/modules/rhythm/library";
import {
  changeTasks,
  groupTasks,
  moveTask,
  updateTask,
} from "../src/modules/rhythm/task-spaces";
import type { Space, Task } from "../src/modules/rhythm/types";
const task = (id: string): Task => ({
  id,
  name: id,
  durationMinutes: 30,
  energyRequired: 3,
  priority: 2,
});
const space = (id: string, tasks: Task[] = []): Space => ({
  id,
  name: id,
  icon: "home",
  color: "#81b8ff",
  createdAt: "2026-09-10T00:00:00Z",
  tasks,
});
test("legacy lists migrate once without losing fields, IDs or task order", () => {
  const old = {
    version: 1,
    taskLists: [
      {
        id: "l",
        name: "Old",
        createdAt: "2026-09-10T00:00:00Z",
        tasks: [
          { ...task("a"), fixedStart: "09:00", completed: true },
          task("b"),
        ],
      },
    ],
    timeblocks: [],
  };
  const before = structuredClone(old),
    migrated = validateLibrary(old);
  assert.deepEqual(old, before);
  assert.equal(migrated.taskLists[0].spaceId, "legacy-space");
  assert.deepEqual(migrated.taskLists[0].tasks, old.taskLists[0].tasks);
  assert.deepEqual(validateLibrary(migrated), migrated);
});
test("space metadata, completion and edits survive backup serialization", () => {
  const data = validateLibrary({
    ...emptyLibrary(),
    spaces: [space("home", [task("a")])],
  });
  const updated = updateTask(
    data,
    { spaceId: "home", taskId: "a" },
    { completed: true, durationMinutes: 390, energyRequired: 5 },
  );
  const restored = validateLibrary(JSON.parse(JSON.stringify(updated)));
  assert.deepEqual(restored, updated);
  assert.equal(restored.spaces![0].tasks[0].completed, true);
  assert.equal(data.spaces![0].tasks[0].completed, undefined);
});
test("grouping is atomic, retains task metadata, and supports moving additional tasks", () => {
  const data = validateLibrary({
    ...emptyLibrary(),
    spaces: [space("home", [task("a"), task("b"), task("c")])],
  });
  const grouped = groupTasks(
    data,
    { spaceId: "home", taskId: "a" },
    { spaceId: "home", taskId: "b" },
    {
      id: "list",
      name: "Chores",
      spaceId: "home",
      createdAt: "2026-09-10T00:00:00Z",
      tasks: [],
    },
  );
  assert.deepEqual(
    grouped.spaces![0].tasks.map((t) => t.id),
    ["c"],
  );
  assert.deepEqual(
    grouped.taskLists[0].tasks.map((t) => t.id),
    ["b", "a"],
  );
  const moved = moveTask(
    grouped,
    { spaceId: "home", taskId: "c" },
    { spaceId: "home", listId: "list" },
  );
  assert.equal(moved.spaces![0].tasks.length, 0);
  assert.equal(moved.taskLists[0].tasks.length, 3);
  assert.equal(data.spaces![0].tasks.length, 3);
  assert.deepEqual(validateLibrary(moved), moved);
});
test("invalid drops and stale destinations cannot lose or duplicate tasks", () => {
  const data = validateLibrary({
    ...emptyLibrary(),
    spaces: [space("home", [task("a")]), space("work", [task("b")])],
  });
  const before = structuredClone(data);
  assert.throws(() =>
    groupTasks(
      data,
      { spaceId: "home", taskId: "a" },
      { spaceId: "work", taskId: "b" },
      {
        id: "l",
        name: "Invalid",
        spaceId: "home",
        createdAt: "2026-09-10T00:00:00Z",
        tasks: [],
      },
    ),
  );
  assert.throws(() =>
    moveTask(data, { spaceId: "home", taskId: "a" }, { spaceId: "missing" }),
  );
  assert.throws(() =>
    changeTasks(data, { spaceId: "home", listId: "missing" }, (tasks) => tasks),
  );
  assert.deepEqual(data, before);
});
test("repeated imports preserve space edits and do not duplicate direct tasks", () => {
  const local = validateLibrary({
    ...emptyLibrary(),
    spaces: [space("s", [{ ...task("a"), completed: true }])],
  });
  const incoming = validateLibrary({
    ...emptyLibrary(),
    spaces: [{ ...space("s", [task("a"), task("b")]), name: "Older name" }],
  });
  const merged = mergeLibraries(local, incoming);
  assert.equal(merged.spaces![0].name, "s");
  assert.equal(merged.spaces![0].tasks[0].completed, true);
  assert.equal(merged.spaces![0].tasks.length, 2);
  assert.deepEqual(mergeLibraries(merged, incoming), merged);
});
test("malformed Spaces, orphan lists and invalid completion states are rejected", () => {
  assert.throws(() =>
    validateLibrary({
      ...emptyLibrary(),
      spaces: [{ ...space("s"), color: "red" }],
    }),
  );
  assert.throws(() =>
    validateLibrary({ ...emptyLibrary(), spaces: [space("s"), space("s")] }),
  );
  assert.throws(() =>
    validateLibrary({
      ...emptyLibrary(),
      spaces: [space("s")],
      taskLists: [
        {
          id: "l",
          name: "bad",
          createdAt: "2026-09-10T00:00:00Z",
          tasks: [],
          spaceId: "gone",
        },
      ],
    }),
  );
  assert.throws(() =>
    validateLibrary({
      ...emptyLibrary(),
      spaces: [
        space("s", [{ ...task("a"), completed: "yes" } as unknown as Task]),
      ],
    }),
  );
});

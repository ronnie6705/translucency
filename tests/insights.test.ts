import test from "node:test";
import assert from "node:assert/strict";
import { dailyEntries, insights } from "../src/lib/insights";
import { defaultRoles } from "../src/lib/catalog";
import { emptyData, seedData } from "../src/lib/seed";
import { type CheckIn, type State, dayKey } from "../src/lib/types";
import { categoryId } from "../src/lib/influences";
const entry = (day: number, state: State, hour = 12): CheckIn => ({
  id: `${day}-${hour}`,
  timestamp: new Date(2026, 7, day, hour).toISOString(),
  state,
  water: [{ label: "Poor sleep" }],
  drying: [{ label: "Walk" }],
  signals: [],
  note: "",
});
test("latest check-in represents a local day, regardless of input ordering", () => {
  const days = dailyEntries([entry(2, 1), entry(1, 0, 18), entry(1, 3, 8)]);
  assert.equal(days.length, 2);
  assert.equal(days[0].state, 0);
  assert.equal(dayKey(days[0].timestamp), "2026-08-01");
});
test("high periods are counted once and only recorded returns to opaque close them", () => {
  const result = insights(
    [entry(1, 3), entry(2, 3), entry(3, 2), entry(4, 0), entry(5, 3)],
    [],
    defaultRoles,
  );
  assert.match(result.find((i) => i.kind === "history")!.body, /1 period/);
  assert.match(result.find((i) => i.kind === "history")!.body, /3 days/);
});
test("missing days do not become next-day drying associations", () => {
  const result = insights(
    [entry(1, 3), entry(5, 0), entry(8, 3), entry(12, 0)],
    [],
    defaultRoles,
  );
  assert.equal(
    result.some((i) => i.kind === "drying"),
    false,
  );
});
test("consecutive-day drying observations are cautious and deterministic", () => {
  const result = insights(
    [entry(1, 3), entry(2, 2), entry(3, 1)],
    [],
    defaultRoles,
    [1, 2].map((d) => ({
      id: `dry-${d}`,
      userId: "local",
      type: "drying" as const,
      categoryId: categoryId("drying", "Walk"),
      categoryLabel: "Walk",
      impact: -3,
      timestamp: new Date(2026, 7, d, 18).toISOString(),
    })),
  );
  assert.match(
    result.find((i) => i.title.includes("appears before"))!.body,
    /2 occasions/,
  );
  assert.ok(result.every((i) => !i.body.includes("causes")));
});
test("no invented insight for empty or sparse data", () => {
  assert.deepEqual(insights([], [], defaultRoles), []);
  assert.deepEqual(insights([entry(1, 1)], [], defaultRoles), []);
});
test("seed reset preserves personal data and does not duplicate demo records", () => {
  const data = emptyData();
  data.checkIns = [entry(1, 2)];
  const seeded = seedData(seedData(data));
  assert.equal(seeded.checkIns.filter((c) => c.demo).length, 28);
  assert.equal(seeded.checkIns.filter((c) => !c.demo).length, 1);
  assert.equal(seeded.profile.onboarded, false);
});

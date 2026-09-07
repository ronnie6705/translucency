import test from "node:test";
import assert from "node:assert/strict";
import { migrateData } from "../src/lib/migration";
import { emptyData, seedData } from "../src/lib/seed";
import {
  categoryId,
  getAverageImpactByCategory,
  getDailyWaterTotal,
  getDailyDryingTotal,
  getDailyNetInfluence,
  getMostFrequentInfluences,
  getStrongestWaterSources,
  getStrongestDryingSources,
  validImpact,
  responseMagnitude,
} from "../src/lib/influences";
import { insights } from "../src/lib/insights";
import { defaultRoles } from "../src/lib/catalog";
import type {
  InfluenceInstance,
  LegacyAppData,
  CheckIn,
} from "../src/lib/types";
const day = new Date(2026, 8, 7, 10).toISOString();
const event = (
  id: string,
  type: "water" | "drying",
  label: string,
  impact: number | null,
  timestamp = day,
): InfluenceInstance => ({
  id,
  userId: "local",
  type,
  categoryId: categoryId(type, label),
  categoryLabel: label,
  impact,
  timestamp,
});
test("migration preserves all legacy moments, duplicate categories, original intensities and check-in data without invented ratings", () => {
  const { version, influences, ...rest } = emptyData();
  const checkIn: CheckIn = {
    id: "old",
    timestamp: day,
    state: 2,
    water: [
      { label: "Poor sleep", intensity: "heavy" },
      { label: "Poor sleep", intensity: "light" },
    ],
    drying: [{ label: "Walk" }],
    signals: ["Body feels loud"],
    note: "Original reflection",
  };
  const old: LegacyAppData = { ...rest, version: 1, checkIns: [checkIn] };
  const updated = migrateData(old);
  assert.equal(updated.version, 2);
  assert.equal(updated.influences.length, 3);
  assert.equal(new Set(updated.influences.map((e) => e.id)).size, 3);
  assert.ok(
    updated.influences.every((e) => e.impact === null && e.checkInId === "old"),
  );
  assert.equal(updated.influences[0].legacyIntensity, "heavy");
  assert.equal(updated.checkIns[0].note, "Original reflection");
  assert.deepEqual(updated.checkIns[0].signals, checkIn.signals);
  assert.equal(old.checkIns[0].water.length, 2);
  assert.strictEqual(migrateData(updated), updated);
  assert.deepEqual(migrateData(old), updated);
});
test("impact bounds require a signed integer; decorative magnitude stays restrained", () => {
  for (const v of [1, 6, 10]) assert.ok(validImpact("water", v));
  for (const v of [-1, -5, -10]) assert.ok(validImpact("drying", v));
  for (const v of [0, 11, -1, null, 2.5, NaN])
    assert.equal(validImpact("water", v), false);
  for (const v of [0, -11, 1, null, -2.5])
    assert.equal(validImpact("drying", v), false);
  assert.ok(responseMagnitude(9) > responseMagnitude(2));
  assert.equal(responseMagnitude(10), responseMagnitude(99));
  assert.ok(responseMagnitude(10) < 0.7);
});
test("daily totals count repeated events separately and never count unknown legacy ratings as measurements", () => {
  const events = [
    event("a", "water", "Poor sleep", 6),
    event("b", "water", "Poor sleep", 4),
    event("c", "drying", "Gym", -5),
    event("d", "water", "Old", null),
    event("e", "water", "Tomorrow", 9, new Date(2026, 8, 8, 0).toISOString()),
  ];
  assert.equal(getDailyWaterTotal(events, "2026-09-07"), 10);
  assert.equal(getDailyDryingTotal(events, "2026-09-07"), -5);
  assert.equal(getDailyNetInfluence(events, "2026-09-07"), 5);
  const edited = events.map((e) => (e.id === "a" ? { ...e, impact: 7 } : e));
  assert.equal(getDailyNetInfluence(edited, "2026-09-07"), 6);
  assert.equal(
    getDailyNetInfluence(
      edited.filter((e) => e.id !== "c"),
      "2026-09-07",
    ),
    11,
  );
});
test("frequency and average impact use instances and rated denominators", () => {
  const events = [
    event("a", "water", "Work stress", 2),
    event("b", "water", "Work stress", 4),
    event("c", "water", "Work stress", null),
    event("d", "water", "Health uncertainty", 8),
    event("e", "drying", "Walk", -2),
    event("f", "drying", "Gym", -6),
    event("g", "drying", "Gym", -4),
  ];
  assert.equal(getMostFrequentInfluences(events)[0].label, "Work stress");
  const work = getAverageImpactByCategory(
    events,
    categoryId("water", "Work stress"),
  )[0];
  assert.equal(work.count, 3);
  assert.equal(work.ratedCount, 2);
  assert.equal(work.average, 3);
  assert.equal(getStrongestWaterSources(events)[0].label, "Health uncertainty");
  assert.equal(getStrongestDryingSources(events)[0].average, -5);
  const cards = insights([], [], defaultRoles, events);
  assert.ok(cards.some((c) => c.body.includes("-5.0")));
  assert.ok(cards.every((c) => !c.body.includes("causes")));
});
test("demo reset replaces examples without deleting personal influences or changing self-reported states", () => {
  const data = emptyData();
  data.influences = [event("mine", "water", "Poor sleep", 6)];
  const seeded = seedData(seedData(data));
  assert.equal(seeded.influences.filter((e) => !e.demo).length, 1);
  assert.equal(
    new Set(seeded.influences.map((e) => e.id)).size,
    seeded.influences.length,
  );
  assert.ok(
    seeded.influences
      .filter((e) => e.demo)
      .every((e) => validImpact(e.type, e.impact)),
  );
  assert.ok(
    seeded.checkIns.every((c) => c.water.length === 0 && c.drying.length === 0),
  );
});

test("unknown future schemas are rejected without mutation", () => {
  const future = { ...emptyData(), version: 99 };
  const snapshot = JSON.stringify(future);
  assert.throws(() => migrateData(future as unknown as LegacyAppData));
  assert.equal(JSON.stringify(future), snapshot);
});
test("drying timing does not bridge gaps from a much older self-report", () => {
  const check = (id: string, date: number, state: 0 | 3): CheckIn => ({
    id,
    timestamp: new Date(2026, 8, date, 12).toISOString(),
    state,
    water: [],
    drying: [],
    signals: [],
    note: "",
  });
  const data = [
    check("a", 1, 3),
    check("b", 10, 0),
    check("c", 12, 3),
    check("d", 20, 0),
  ];
  const events = [
    event("e", "drying", "Walk", -3, new Date(2026, 8, 10, 9).toISOString()),
    event("f", "drying", "Walk", -4, new Date(2026, 8, 20, 9).toISOString()),
  ];
  assert.equal(
    insights(data, [], defaultRoles, events).some((i) =>
      i.title.includes("appears before"),
    ),
    false,
  );
});

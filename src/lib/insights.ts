import {
  dayKey,
  type CheckIn,
  type Role,
  type RoleSession,
  type InfluenceInstance,
} from "./types";
import {
  getMostFrequentInfluences,
  getStrongestWaterSources,
  getStrongestDryingSources,
} from "./influences";
export interface Insight {
  title: string;
  body: string;
  kind: "water" | "drying" | "role" | "history";
}
export function dailyEntries(entries: CheckIn[]) {
  const days = new Map<string, CheckIn>();
  for (const c of [...entries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  ))
    days.set(dayKey(c.timestamp), c);
  return [...days.values()];
}
export function insights(
  entries: CheckIn[],
  sessions: RoleSession[],
  roles: Role[],
  events: InfluenceInstance[] = [],
): Insight[] {
  const days = dailyEntries(entries);
  const result: Insight[] = [];
  const highKeys = new Set(
    days.filter((c) => c.state >= 2).map((c) => dayKey(c.timestamp)),
  );
  const frequent = getMostFrequentInfluences(events);
  const water = frequent.filter((e) => e.type === "water");
  const drying = frequent.filter((e) => e.type === "drying");
  const format = (n: number | null) =>
    n === null ? "unrated" : (n > 0 ? "+" : "") + n.toFixed(1);
  const topWater = water[0];
  if (topWater) {
    const highCount = events.filter(
      (e) =>
        e.categoryId === topWater.categoryId &&
        highKeys.has(dayKey(e.timestamp)),
    ).length;
    result.push({
      kind: "water",
      title:
        highCount >= 2
          ? topWater.label + " appears on more translucent days."
          : topWater.label + ", in context.",
      body: `You logged this ${topWater.count} time${topWater.count === 1 ? "" : "s"}${highCount >= 2 ? `, including ${highCount} moments on more translucent days` : ""}. ${topWater.ratedCount ? `Average logged impact: ${format(topWater.average)} across ${topWater.ratedCount} rated moments.` : "Older moments have no numeric rating."} This reflects your impressions, not a measured effect.`,
    });
  }
  const strongWater = getStrongestWaterSources(events).find(
    (e) =>
      e.ratedCount >= 2 &&
      topWater &&
      e.count < topWater.count &&
      topWater.average !== null &&
      e.average! > topWater.average,
  );
  if (strongWater && topWater)
    result.push({
      kind: "water",
      title: "Frequency and impact can differ.",
      body: `${strongWater.label} appears less often than ${topWater.label.toLowerCase()} in your logs (${strongWater.count} compared with ${topWater.count} moments), but its average logged impact is higher (${format(strongWater.average)} compared with ${format(topWater.average)}). That difference may be worth noticing.`,
    });
  if (drying[0])
    result.push({
      kind: "drying",
      title:
        drying[0].count >= 2
          ? drying[0].label + " is a familiar drying source."
          : drying[0].label + ", a drying moment.",
      body: `${drying[0].label} is your most frequently logged drying category: ${drying[0].count} moment${drying[0].count === 1 ? "" : "s"}. ${drying[0].ratedCount ? `Average logged impact: ${format(drying[0].average)} across ${drying[0].ratedCount} rated moments.` : "No numeric impact was recorded in these older entries."} There is no frequency or balance to aim for.`,
    });
  const strongest = getStrongestDryingSources(events).find(
    (e) => e.ratedCount >= 2,
  );
  if (strongest && strongest.categoryId !== drying[0]?.categoryId)
    result.push({
      kind: "drying",
      title: strongest.label + " tends to feel restorative.",
      body: `Your ${strongest.ratedCount} rated ${strongest.label.toLowerCase()} moments have an average drying impact of ${format(strongest.average)}, one of the strongest average drying ratings in your logs. This is perceived impact, not proof of a cause.`,
    });
  const ordered = [...entries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const beforeLower = new Map<string, Set<string>>();
  for (const event of events.filter((e) => e.type === "drying")) {
    const before = [...ordered]
      .reverse()
      .find((c) => c.timestamp <= event.timestamp && !!c.demo === !!event.demo);
    const after = ordered.find(
      (c) => c.timestamp > event.timestamp && !!c.demo === !!event.demo,
    );
    if (!before || !after) continue;
    const nextDay = new Date(event.timestamp);
    nextDay.setDate(nextDay.getDate() + 1);
    const previousDay = new Date(event.timestamp);
    previousDay.setDate(previousDay.getDate() - 1);
    if (
      after.state < before.state &&
      [dayKey(previousDay), dayKey(event.timestamp)].includes(
        dayKey(before.timestamp),
      ) &&
      [dayKey(event.timestamp), dayKey(nextDay)].includes(
        dayKey(after.timestamp),
      )
    ) {
      const set = beforeLower.get(event.categoryLabel) || new Set<string>();
      set.add(after.id);
      beforeLower.set(event.categoryLabel, set);
    }
  }
  const timing = [...beforeLower].sort((a, b) => b[1].size - a[1].size)[0];
  if (timing && timing[1].size >= 2)
    result.push({
      kind: "drying",
      title: timing[0] + " appears before lower-translucency check-ins.",
      body: `It was logged between an earlier state and a lower-translucency check-in on ${timing[1].size} occasions, on the same or following day. Other influences may have played a part; this is not a causal conclusion.`,
    });
  let episodes = 0,
    start: CheckIn | undefined,
    lastDays = 0;
  for (const c of days) {
    if (!start && c.state === 3) start = c;
    if (start && c.state === 0) {
      episodes++;
      lastDays = Math.round(
        (new Date(c.timestamp).getTime() -
          new Date(start.timestamp).getTime()) /
          86400000,
      );
      start = undefined;
    }
  }
  if (episodes)
    result.push({
      kind: "history",
      title: "You have been here before.",
      body: `These logs include ${episodes} ${episodes === 1 ? "period" : "periods"} that moved from highly translucent back to opaque. The most recent took ${lastDays} ${lastDays === 1 ? "day" : "days"} between recorded states. Your own pace can vary.`,
    });
  const rated = roles
    .map((r) => ({
      r,
      all: sessions.filter((s) => s.roleId === r.id && s.helpfulness),
      help: sessions.filter(
        (s) => s.roleId === r.id && s.helpfulness === "a_lot",
      ),
    }))
    .sort((a, b) => b.help.length - a.help.length)[0];
  if (rated?.help.length)
    result.push({
      kind: "role",
      title: `${rated.r.name}, a useful perspective.`,
      body: `You rated this perspective “a lot” in ${rated.help.length} of ${rated.all.length} rated sessions. Borrow it when it fits the moment.`,
    });
  return result;
}

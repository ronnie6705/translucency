import { dayKey, type InfluenceInstance, type InfluenceType } from "./types";
export function categoryId(type: InfluenceType, label: string) {
  return `${type}:${label.trim().toLocaleLowerCase("en-AU")}`;
}
export function signedImpact(value: number | null) {
  return value === null ? "—" : value > 0 ? `+${value}` : String(value);
}
export function validImpact(type: InfluenceType, impact: number | null) {
  return (
    typeof impact === "number" &&
    Number.isInteger(impact) &&
    (type === "water"
      ? impact >= 1 && impact <= 10
      : impact <= -1 && impact >= -10)
  );
}
export function validateInfluence(event: InfluenceInstance) {
  if (
    !event.categoryLabel.trim() ||
    !validImpact(event.type, event.impact) ||
    !Number.isFinite(new Date(event.timestamp).getTime())
  )
    throw new Error("Choose a category and an impact from 1 to 10.");
}
export function getDailyInfluences(
  events: InfluenceInstance[],
  date: string | Date,
) {
  const key =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : dayKey(date);
  return events
    .filter((e) => dayKey(e.timestamp) === key)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
export function getDailyWaterTotal(
  events: InfluenceInstance[],
  date: string | Date,
) {
  return getDailyInfluences(events, date)
    .filter((e) => e.type === "water")
    .reduce((n, e) => n + (e.impact ?? 0), 0);
}
export function getDailyDryingTotal(
  events: InfluenceInstance[],
  date: string | Date,
) {
  return getDailyInfluences(events, date)
    .filter((e) => e.type === "drying")
    .reduce((n, e) => n + (e.impact ?? 0), 0);
}
export function getDailyNetInfluence(
  events: InfluenceInstance[],
  date: string | Date,
) {
  return getDailyWaterTotal(events, date) + getDailyDryingTotal(events, date);
}
export interface CategoryImpact {
  categoryId: string;
  label: string;
  type: InfluenceType;
  count: number;
  ratedCount: number;
  average: number | null;
}
export function getAverageImpactByCategory(
  events: InfluenceInstance[],
  category?: string,
): CategoryImpact[] {
  const groups = new Map<string, InfluenceInstance[]>();
  for (const event of events) {
    if (category && event.categoryId !== category) continue;
    groups.set(event.categoryId, [
      ...(groups.get(event.categoryId) || []),
      event,
    ]);
  }
  return [...groups].map(([id, group]) => {
    const rated = group.filter((e) => e.impact !== null);
    return {
      categoryId: id,
      label: group[0].categoryLabel,
      type: group[0].type,
      count: group.length,
      ratedCount: rated.length,
      average: rated.length
        ? rated.reduce((sum, e) => sum + e.impact!, 0) / rated.length
        : null,
    };
  });
}
export function getMostFrequentInfluences(events: InfluenceInstance[]) {
  return getAverageImpactByCategory(events).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label),
  );
}
export function getStrongestWaterSources(events: InfluenceInstance[]) {
  return getAverageImpactByCategory(events)
    .filter((e) => e.type === "water" && e.average !== null)
    .sort((a, b) => b.average! - a.average!);
}
export function getStrongestDryingSources(events: InfluenceInstance[]) {
  return getAverageImpactByCategory(events)
    .filter((e) => e.type === "drying" && e.average !== null)
    .sort((a, b) => a.average! - b.average!);
}
/** Decorative response amplitude, never a stored state or running score. */
export function responseMagnitude(impact: number) {
  return 0.28 + Math.min(10, Math.max(1, Math.abs(impact))) * 0.035;
}

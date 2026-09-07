import { categoryId } from "./influences";
import type { AppData, LegacyAppData, InfluenceInstance } from "./types";
export function migrateData(data: AppData | LegacyAppData): AppData {
  if (data.version === 2) return data;
  if (data.version !== 1)
    throw new Error("This data version needs a newer app.");
  const influences: InfluenceInstance[] = data.checkIns.flatMap((c) =>
    (["water", "drying"] as const).flatMap((type) =>
      (c[type] || []).map((factor, index) => ({
        id: `migrated:${c.id}:${type}:${index}`,
        userId: "local",
        type,
        categoryId: categoryId(type, factor.label),
        categoryLabel: factor.label,
        impact: null,
        timestamp: c.timestamp,
        checkInId: c.id,
        demo: c.demo,
        legacyIntensity: factor.intensity,
      })),
    ),
  );
  return {
    ...data,
    version: 2,
    influences,
    checkIns: data.checkIns.map((c) => ({ ...c, water: [], drying: [] })),
  };
}

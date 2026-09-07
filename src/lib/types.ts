export type State = 0 | 1 | 2 | 3;
export type Kind = "water" | "drying" | "signals";
export type Helpfulness = "not_really" | "a_little" | "a_lot";
export interface Factor {
  label: string;
  intensity?: "light" | "moderate" | "heavy" | "strong";
}
export interface CheckIn {
  id: string;
  timestamp: string;
  state: State;
  /** Legacy import fields. Empty in schema 2; use independently stored influences. */
  water: Factor[];
  drying: Factor[];
  signals: string[];
  note: string;
  roleId?: string;
  helpfulness?: Helpfulness;
  demo?: boolean;
}
export interface Role {
  id: string;
  name: string;
  icon: string;
  description: string;
  borrowedQuality: string;
  bestFor: string[];
  corePhrase: string;
  reappraisal: string;
  note?: string;
  custom?: boolean;
  tone: string;
}
export interface RoleSession {
  id: string;
  timestamp: string;
  roleId: string;
  context: string;
  anxiousAppraisal: string;
  reappraisal: string;
  carry: string;
  observe: boolean;
  helpfulness?: Helpfulness;
  reflection?: string;
  demo?: boolean;
}
export interface Profile {
  name: string;
  onboarded: boolean;
  selectedRoleIds: string[];
  favourites: Record<Kind, string[]>;
  customSources: Record<Kind, string[]>;
  reminders: "off" | "morning" | "evening" | "both";
}
export interface AppData {
  version: 2;
  profile: Profile;
  checkIns: CheckIn[];
  roles: Role[];
  sessions: RoleSession[];
  influences: InfluenceInstance[];
}
export type InfluenceType = "water" | "drying";
export interface InfluenceInstance {
  id: string;
  userId: string;
  type: InfluenceType;
  categoryId: string;
  categoryLabel: string;
  note?: string;
  /** null is reserved for migrated records: never invent a perceived rating. */
  impact: number | null;
  timestamp: string;
  checkInId?: string;
  demo?: boolean;
  legacyIntensity?: Factor["intensity"];
}
export type LegacyAppData = Omit<AppData, "version" | "influences"> & {
  version: 1;
};
export const stateLabels = [
  "Opaque",
  "Slightly translucent",
  "Moderately translucent",
  "Highly translucent",
] as const;
export function dayKey(date: string | Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type BreakPreset = 'balanced' | 'deep-focus' | 'frequent' | 'none';
/** Offset is completed work within the underlying task, independent of clock time. */
export interface RecoveryAnchor { taskId: string; offsetMinutes: number; atTaskEnd?: boolean }
export interface RecoveryOverride { anchor: RecoveryAnchor; durationMinutes?: number; removed?: boolean }
export interface BreakPreferences { preset: BreakPreset; overrides: RecoveryOverride[] }
export interface RecoveryMetadata { anchor: RecoveryAnchor; source: 'automatic' | 'manual-override' }
export const anchorKey = (anchor: RecoveryAnchor) => `${encodeURIComponent(anchor.taskId)}:${anchor.atTaskEnd ? 'end' : anchor.offsetMinutes}`;
export const defaultBreakPreferences = (): BreakPreferences => ({ preset: 'balanced', overrides: [] });
export function validBreakPreferences(value: unknown): value is BreakPreferences {
  if (!value || typeof value !== 'object') return false;
  const p = value as BreakPreferences;
  const keys = new Set<string>();
  return ['balanced','deep-focus','frequent','none'].includes(p.preset) && Array.isArray(p.overrides) && p.overrides.every(o => {
    if (!validAnchor(o?.anchor) || !(o.removed === true && o.durationMinutes === undefined || o.removed === undefined && Number.isInteger(o.durationMinutes) && o.durationMinutes! > 0 && o.durationMinutes! <= 120)) return false;
    const key = anchorKey(o.anchor); if (keys.has(key)) return false; keys.add(key); return true;
  });
}
export function validAnchor(value: unknown): value is RecoveryAnchor {
  const a = value as RecoveryAnchor | undefined;
  return !!a && typeof a.taskId === 'string' && a.taskId.length > 0 && Number.isFinite(a.offsetMinutes) && a.offsetMinutes > 0 && (a.atTaskEnd === undefined || typeof a.atTaskEnd === 'boolean');
}
export function setRecoveryOverride(preferences: BreakPreferences, anchor: RecoveryAnchor, override?: Omit<RecoveryOverride,'anchor'>): BreakPreferences {
  const overrides = preferences.overrides.filter(o => anchorKey(o.anchor) !== anchorKey(anchor));
  return { ...preferences, overrides: override ? [...overrides, { anchor, ...override }] : overrides };
}

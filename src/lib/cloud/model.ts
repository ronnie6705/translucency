export const modules = ['translucency', 'rhythm'] as const;
export type Module = typeof modules[number];
export interface CachedDocument { payload: unknown; revision: number; dirty: boolean }
export interface RemoteDocument { payload: unknown; revision: number }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => JSON.stringify(k)+':'+canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function reconcile(local: CachedDocument, remote: RemoteDocument | null): 'push' | 'pull' | 'same' | 'conflict' {
  if (!local.dirty) return remote && remote.revision !== local.revision ? 'pull' : 'same';
  // A response can be lost after a successful write. Retrying must be idempotent.
  if (remote && canonical(remote.payload) === canonical(local.payload)) return 'pull';
  return (remote?.revision ?? 0) === local.revision ? 'push' : 'conflict';
}

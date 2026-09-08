import { cloudClient } from './client';
import { modules, reconcile, type Module, type CachedDocument, type RemoteDocument } from './model';

let owner: string | null = null;
export function activeAccount() { return owner; }
export function setActiveAccount(id: string | null) { owner = id; }
export function cloudChanged() { window.dispatchEvent(new Event('cloud-data')); }
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('rhythm-account-cache-v1', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('documents');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function cache(id: string, module: Module, value?: CachedDocument): Promise<CachedDocument | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('documents', value ? 'readwrite' : 'readonly');
    const store = tx.objectStore('documents');
    const key = `${id}:${module}`;
    const r = value ? store.put(value, key) : store.get(key);
    tx.oncomplete = () => { database.close(); resolve(value ?? r.result); };
    tx.onabort = tx.onerror = () => { database.close(); reject(tx.error); };
  });
}
async function locked<T>(id: string, module: Module, action: () => Promise<T>): Promise<T> {
  if (!navigator.locks) return Promise.reject(new Error('Account sync requires a browser with Web Locks support.'));
  return await navigator.locks.request(`account:${id}:${module}`, action);
}
async function remote(id: string, module: Module): Promise<RemoteDocument | null> {
  const client = cloudClient();
  if (!client) throw new Error('Cloud connection is not configured.');
  const { data, error } = await client.from('workspace_documents').select('payload,revision').eq('user_id', id).eq('module', module).maybeSingle();
  if (error) throw new Error('Could not reach your account. Check your connection and sign-in.');
  return data;
}
export async function readAccount<T>(id: string, module: Module, fresh: () => T): Promise<T> {
  return locked(id, module, async () => {
    let current = await cache(id, module);
    if (!current) {
      const saved = await remote(id, module);
      current = { payload: saved?.payload ?? fresh(), revision: saved?.revision ?? 0, dirty: false };
      await cache(id, module, current);
    }
    return current.payload as T;
  });
}
export async function writeAccount<T>(id: string, module: Module, change: (data: T) => T): Promise<T> {
  const result = await locked(id, module, async () => {
    if (owner !== id) throw new Error('Your account changed. Please retry.');
    const current = await cache(id, module);
    if (!current) throw new Error('Open your account while online before editing.');
    const payload = change(structuredClone(current.payload) as T);
    await cache(id, module, { ...current, payload, dirty: true });
    return payload;
  });
  cloudChanged();
  return result;
}
export async function syncAccount(id: string): Promise<Module[]> {
  const conflicts: Module[] = [];
  for (const module of modules) await locked(id, module, async () => {
    if (owner !== id) return;
    const current = await cache(id, module);
    if (!current) return;
    const saved = await remote(id, module);
    const action = reconcile(current, saved);
    if (action === 'conflict') { conflicts.push(module); return; }
    if (action === 'pull' && saved) await cache(id, module, { ...saved, dirty: false });
    if (action === 'push') {
      if (owner !== id) return;
      const { data, error } = await cloudClient()!.rpc('save_workspace_document', {
        bound_user_id: id, document_module: module, document_payload: current.payload, expected_revision: current.revision,
      });
      if (error?.code === '40001') { conflicts.push(module); return; }
      if (error) throw new Error('Changes are saved on this device. Cloud sync failed; retry when connected.');
      await cache(id, module, { ...current, revision: Number(data), dirty: false });
    }
  });
  window.dispatchEvent(new Event('cloud-refreshed'));
  return conflicts;
}
export async function accountBackup(id: string) {
  return { version: 1, exportedAt: new Date().toISOString(), translucency: await cache(id, 'translucency'), rhythm: await cache(id, 'rhythm') };
}
export async function useCloudVersion(id: string, module: Module) {
  await locked(id, module, async () => {
    const saved = await remote(id, module);
    if (!saved) throw new Error('The cloud version is not available. Your device copy has been kept.');
    await cache(id, module, { ...saved, dirty: false });
  });
  cloudChanged();
  window.dispatchEvent(new Event('cloud-refreshed'));
}
export async function hasPendingChanges(id: string) {
  return (await Promise.all(modules.map(m => cache(id, m)))).some(d => d?.dirty);
}

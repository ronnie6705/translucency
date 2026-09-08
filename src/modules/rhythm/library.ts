import type { SavedTaskList, SavedTimeblock, Task } from './types';
import { activeAccount, readAccount, writeAccount } from '../../lib/cloud/storage';
export interface RhythmLibrary { version: 1; taskLists: SavedTaskList[]; timeblocks: SavedTimeblock[] }
export const emptyLibrary = (): RhythmLibrary => ({ version: 1, taskLists: [], timeblocks: [] });
const DB = 'rhythm-library-v1';
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function tasks(v: unknown): v is Task[] {
  return Array.isArray(v) && v.every(t => object(t) && typeof t.id === 'string' && typeof t.name === 'string' &&
    Number.isFinite(t.durationMinutes) && Number(t.durationMinutes) > 0 && [1,2,3,4,5].includes(Number(t.energyRequired)) &&
    [1,2,3].includes(Number(t.priority)) && (t.fixedStart === undefined || /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t.fixedStart))) &&
    (t.isBreak === undefined || typeof t.isBreak === 'boolean'));
}
function entry(v: unknown): v is SavedTaskList { return object(v) && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.createdAt === 'string' && Number.isFinite(Date.parse(v.createdAt)) && tasks(v.tasks); }
export function validateLibrary(value: unknown): RhythmLibrary {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.taskLists) || !Array.isArray(value.timeblocks) || !value.taskLists.every(entry)) throw new Error('This is not a valid Rhythm backup.');
  for (const block of value.timeblocks) {
    if (!entry(block) || !object(block) || !object(block.dayConfig)) throw new Error('Invalid timeblock in backup.');
    const config = block.dayConfig;
    if (!['Lion','Bear','Wolf','Dolphin'].includes(String(config.chronotype)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(config.date)) || ![config.startTime,config.endTime].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t)))) throw new Error('Invalid day settings in backup.');
    try { new Intl.DateTimeFormat('en',{timeZone: String(config.timezone)}).format(); } catch { throw new Error('Invalid time zone in backup.'); }
  }
  return value as unknown as RhythmLibrary;
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve,reject) => {
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = () => r.result.createObjectStore('library');
    r.onsuccess = () => { r.result.onversionchange = () => r.result.close(); resolve(r.result); };
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('Close other Rhythm tabs and retry.'));
  });
}
function legacy(): RhythmLibrary {
  // Read only at initialization. Old keys remain available as a recovery copy.
  const taskLists = JSON.parse(localStorage.getItem('rhythm:saved-task-lists') || '[]');
  const timeblocks = JSON.parse(localStorage.getItem('rhythm:saved-timeblocks') || '[]');
  return validateLibrary({version:1,taskLists,timeblocks});
}
export async function updateLibrary(change: (data: RhythmLibrary) => RhythmLibrary): Promise<RhythmLibrary> {
  const account = activeAccount();
  if (account) {
    const next = await writeAccount<RhythmLibrary>(account, 'rhythm', data => validateLibrary(change(data)));
    window.dispatchEvent(new Event('rhythm-library-updated'));
    return next;
  }
  return updateGuestLibrary(change);
}
async function updateGuestLibrary(change: (data: RhythmLibrary) => RhythmLibrary): Promise<RhythmLibrary> {
  const db = await open();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('library','readwrite');
    const store = tx.objectStore('library');
    const request = store.get('data');
    let next: RhythmLibrary;
    let failure: unknown;
    request.onsuccess = () => {
      try { next = validateLibrary(change(request.result ? validateLibrary(request.result) : legacy())); store.put(next,'data'); }
      catch (error) { failure = error; tx.abort(); }
    };
    tx.oncomplete = () => { db.close(); window.dispatchEvent(new Event('rhythm-library-updated')); if ('BroadcastChannel' in window) { const c = new BroadcastChannel('rhythm-library'); c.postMessage('updated'); c.close(); } resolve(next); };
    tx.onabort = tx.onerror = () => { db.close(); reject(failure || tx.error || new Error('Could not save Rhythm data.')); };
  });
}
export async function loadLibrary(): Promise<RhythmLibrary> {
  const account = activeAccount();
  if (account) return validateLibrary(await readAccount(account, 'rhythm', emptyLibrary));
  return loadGuestLibrary();
}
export async function loadGuestLibrary(): Promise<RhythmLibrary> {
  const db = await open();
  const value = await new Promise<unknown>((resolve,reject) => {
    const tx = db.transaction('library','readonly');
    const r = tx.objectStore('library').get('data');
    tx.oncomplete = () => { db.close(); resolve(r.result); };
    tx.onabort = tx.onerror = () => { db.close(); reject(tx.error); };
  });
  return value ? validateLibrary(value) : updateGuestLibrary(d => d);
}
export function mergeLibraries(existing: RhythmLibrary, incoming: RhythmLibrary): RhythmLibrary {
  // Import never overwrites an existing record; duplicate IDs keep the local version.
  const merge = <T extends { id: string }>(a: T[], b: T[]) => [...a,...b.filter(item => !a.some(old => old.id === item.id))];
  return {version:1,taskLists:merge(existing.taskLists,incoming.taskLists),timeblocks:merge(existing.timeblocks,incoming.timeblocks)};
}

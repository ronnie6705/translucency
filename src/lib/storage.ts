import { emptyData, seedData } from "./seed";
import type { AppData } from "./types";
import { migrateData } from "./migration";
const DB = "translucency-v1";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains("app"))
        r.result.createObjectStore("app");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () =>
      reject(new Error("Close other Translucency tabs and try again."));
  });
}
async function read(): Promise<AppData | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("app", "readonly");
    const r = tx.objectStore("app").get("data");
    tx.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
async function initialize(data: AppData) {
  const db = await open();
  return new Promise<AppData>((resolve, reject) => {
    const tx = db.transaction("app", "readwrite");
    const store = tx.objectStore("app");
    const request = store.get("data");
    let saved = data;
    request.onsuccess = () => {
      try {
        if (request.result) saved = migrateData(request.result);
        store.put(saved, "data");
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(saved);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Local storage could not save."));
    };
  });
}
export async function loadData() {
  const existing = await read();
  if (existing) {
    if (existing.version === 2) return existing;
    return updateData((d) => d);
  }
  const fresh = seedData();
  return initialize(fresh);
}
export async function updateData(
  change: (data: AppData) => AppData,
): Promise<AppData> {
  const update = async () => {
    const db = await open();
    return new Promise<AppData>((resolve, reject) => {
      const tx = db.transaction("app", "readwrite");
      const store = tx.objectStore("app");
      const r = store.get("data");
      let next: AppData;
      r.onsuccess = () => {
        try {
          next = change(migrateData(r.result || emptyData()));
          if (next.version !== 2) throw new Error("Unsupported schema.");
          store.put(next, "data");
        } catch {
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(next);
      };
      tx.onabort = tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Could not save local data."));
      };
    });
  };
  return navigator.locks
    ? navigator.locks.request("translucency-write", update)
    : update();
}

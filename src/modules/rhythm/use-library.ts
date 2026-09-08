import { useCallback, useEffect, useState } from 'react';
import { emptyLibrary, loadLibrary, updateLibrary, type RhythmLibrary } from './library';
import type { SavedTaskList, SavedTimeblock } from './types';
export function useRhythmLibrary() {
  const [data,setData] = useState(emptyLibrary);
  const [ready,setReady] = useState(false);
  const [error,setError] = useState('');
  const reload = useCallback(async () => {
    try { setData(await loadLibrary()); setReady(true); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Rhythm storage is unavailable.'); }
  },[]);
  useEffect(() => {
    void reload();
    window.addEventListener('rhythm-library-updated',reload);
    window.addEventListener('focus',reload);
    window.addEventListener('cloud-refreshed',reload);
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel('rhythm-library') : null;
    if (channel) channel.onmessage = reload;
    return () => { window.removeEventListener('rhythm-library-updated',reload); window.removeEventListener('focus',reload); window.removeEventListener('cloud-refreshed',reload); channel?.close(); };
  },[reload]);
  const save = async (change: (data: RhythmLibrary) => RhythmLibrary) => {
    try { setData(await updateLibrary(change)); setError(''); return true; }
    catch (e) { setError(`Your change was not saved. ${e instanceof Error ? e.message : 'Try again.'}`); return false; }
  };
  return { ...data,ready,error,reload,save,
    setSavedTaskLists: (fn: (v: SavedTaskList[]) => SavedTaskList[]) => save(d => ({...d,taskLists:fn(d.taskLists)})),
    setSavedTimeblocks: (fn: (v: SavedTimeblock[]) => SavedTimeblock[]) => save(d => ({...d,timeblocks:fn(d.timeblocks)})),
  };
}

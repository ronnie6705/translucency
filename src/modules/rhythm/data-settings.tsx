"use client";
import { useState } from 'react';
import { useRhythmLibrary } from './use-library';
import { emptyLibrary, mergeLibraries, validateLibrary } from './library';
import { activeAccount } from '@/lib/cloud/storage';
export function RhythmDataSettings() {
  const library = useRhythmLibrary();
  const [message,setMessage] = useState('');
  const [confirm,setConfirm] = useState('');
  const [busy,setBusy] = useState(false);
  return <section className="form-section rhythm-data-settings">
    <p className="eyebrow">RHYTHM</p><h2>Your planning data</h2>
    <p>{library.spaces?.length ?? 0} spaces · {library.taskLists.length} task lists · {library.timeblocks.length} timeblocks. {activeAccount() ? 'Saved in your account workspace, with an offline device copy.' : 'Stored only on this device.'} Your planning records remain separate from your reflections.</p>
    <p>For another browser or address, import a Rhythm JSON backup. Imports keep existing records with the same ID. When signed in, imported records are uploaded to your account.</p>
    {(library.error || message) && <p role={library.error ? 'alert' : 'status'}>{library.error || message}</p>}
    <div className="settings-actions"><button className="button secondary" disabled={!library.ready || busy} onClick={() => {
      const blob = new Blob([JSON.stringify({version:1,spaces:library.spaces,taskLists:library.taskLists,timeblocks:library.timeblocks},null,2)],{type:'application/json'});
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='rhythm-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
    }}>Export Rhythm data</button></div>
    <label>Import Rhythm backup<input type="file" accept=".json,application/json" disabled={!library.ready || busy} onChange={async e => {
      const file = e.target.files?.[0]; if (!file) return; setBusy(true); setMessage('');
      try { if (file.size > 10_000_000) throw new Error('Choose a backup smaller than 10 MB.'); const imported = validateLibrary(JSON.parse(await file.text())); if (await library.save(d => mergeLibraries(d,imported))) setMessage('Rhythm backup imported. Your existing records were preserved.'); }
      catch (error) { setMessage(error instanceof Error ? error.message : 'Could not import this backup.'); }
      finally { setBusy(false); e.target.value=''; }
    }} /></label>
    <details className="delete-controls"><summary>Delete Rhythm planning data</summary><p>This removes saved Rhythm lists and timeblocks from the active workspace. When signed in, this deletion syncs to your account and other devices. Export a backup first to keep a copy. Your Translucency reflections remain available.</p>
      <label>Type RHYTHM to confirm<input value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      <button className="button secondary" disabled={confirm !== 'RHYTHM' || busy || !library.ready} onClick={async () => { setBusy(true); if (await library.save(emptyLibrary)) { try { if (!activeAccount()) { localStorage.removeItem('rhythm:saved-task-lists'); localStorage.removeItem('rhythm:saved-timeblocks'); } } catch { /* IndexedDB deletion succeeded */ } setConfirm(''); setMessage('Rhythm planning data deleted from this workspace. Check account sync status if signed in.'); } setBusy(false); }}>Delete Rhythm data</button>
    </details>
  </section>;
}

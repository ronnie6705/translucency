import { useState } from 'react';
import type { Space } from '../types';
import { TaskModal } from './TaskModal';

export function DeleteSpaceDialog({space, destinations, taskCount, listCount, error, onClose, onDelete}: {
  space:Space; destinations:Space[]; taskCount:number; listCount:number; error:string;
  onClose():void; onDelete(mode:'move'|'delete', destinationId:string):Promise<boolean>;
}) {
  const [mode,setMode] = useState<'move'|'delete'>('move');
  const [destination,setDestination] = useState(destinations[0]?.id ?? '');
  const [busy,setBusy] = useState(false);
  const hasContents = taskCount > 0 || listCount > 0;
  const close = () => { if (!busy) onClose(); };
  return <TaskModal label="Delete Space" onClose={close}>
    <form className="task-small-form" onSubmit={async e=>{
      e.preventDefault(); if(busy) return; setBusy(true);
      try { if(await onDelete(mode,destination)) onClose(); } finally { setBusy(false); }
    }}>
      <div className="task-modal-heading"><h2>Delete “{space.name}”?</h2><button type="button" aria-label="Close" disabled={busy} onClick={close}>×</button></div>
      <p>This space contains {taskCount} {taskCount===1?'task':'tasks'} and {listCount} {listCount===1?'list':'lists'}, including completed tasks.</p>
      {hasContents && <fieldset className="space-delete-options" disabled={busy}>
        <legend>What should happen to its contents?</legend>
        <label><input type="radio" name="space-delete-mode" checked={mode==='move'} onChange={()=>setMode('move')} />Keep tasks and lists</label>
        {mode==='move' && (destinations.length ? <label>Move to space<select value={destination} onChange={e=>setDestination(e.target.value)} required>{destinations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <p>Your tasks and lists will move to a new General space.</p>)}
        <label><input type="radio" name="space-delete-mode" checked={mode==='delete'} onChange={()=>setMode('delete')} />Delete tasks and lists too</label>
        {mode==='delete' && <p className="space-delete-warning">These tasks and lists will be permanently removed from your library. This cannot be undone.</p>}
      </fieldset>}
      <p>Saved timeblocks, running timers and execution history will stay unchanged.</p>
      {error && <p role="alert">{error}</p>}
      <div className="task-form-actions"><button type="button" autoFocus disabled={busy} onClick={close}>Cancel</button><button className="space-delete-button" type="submit" disabled={busy || (hasContents && mode==='move' && destinations.length>0 && !destinations.some(space=>space.id===destination))}>{busy?'Deleting…':hasContents && mode==='move'?'Move contents & delete space':'Delete space'}</button></div>
    </form>
  </TaskModal>;
}

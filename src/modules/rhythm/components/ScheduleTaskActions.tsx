import { workingEstimate } from '../time-adjustments';
import { useState } from 'react';
import type { Task } from '../types';
import { formatTaskDuration } from '../task-spaces';

/** Same estimate choices as Workload; edits belong only to this working timeblock. */
export function ScheduleTaskActions({task,onUpdate,onRemove}: {task:Task;onUpdate(patch:Partial<Task>):void;onRemove():void}) {
  return <details className="tb-task-actions"><summary aria-label={`Settings for ${task.name}`}>Task settings</summary>
    <label>Estimated duration (whole task)<select aria-label={`Duration for ${task.name}`} value={workingEstimate(task)} onChange={e=>onUpdate({durationMinutes:Number(e.target.value),durationMode:'custom',workingEstimateMinutes:Number(e.target.value)})}>
      {[...new Set([...Array.from({length:48},(_,n)=>(n+1)*15),5,10,task.durationMinutes,workingEstimate(task)])].sort((a,b)=>a-b).map(n=><option key={n} value={n}>{formatTaskDuration(n)}</option>)}
    </select></label>
    {workingEstimate(task)>task.durationMinutes && <p>Estimated Time: {formatTaskDuration(workingEstimate(task))} · Scheduled Allocation: {formatTaskDuration(task.durationMinutes)} · Rhythm Adjustment: −{formatTaskDuration(workingEstimate(task)-task.durationMinutes)}</p>}
    <label><input type="checkbox" checked={!task.isBreak && !task.fixedStart && task.allowTimeAdjustments!==false} disabled={!!task.isBreak || !!task.fixedStart} onChange={e=>onUpdate({allowTimeAdjustments:e.target.checked})} />Allow Time Adjustments</label>
    {!task.plannedBreakAfterTaskId && <label>Fixed start (optional)<input type="time" aria-label={`Fixed start for ${task.name}`} value={task.fixedStart ?? ''} onChange={e=>onUpdate({fixedStart:e.target.value || undefined})} /></label>}
    <button type="button" className="tb-small" onClick={onRemove}>Remove from This Timeblock</button>
  </details>;
}

export function AddBoundaryBreak({name,disabled,onAdd}: {name:string;disabled:boolean;onAdd(minutes:number):void}) {
  const [open,setOpen]=useState(false);
  const [custom,setCustom]=useState('10');
  const add=(minutes:number)=>{onAdd(minutes);setOpen(false);};
  return <div className="tb-add-boundary">
    <button type="button" className="tb-small" disabled={disabled} aria-label={`Add break after ${name}`} aria-expanded={open} onClick={()=>setOpen(!open)}>+ Add Break</button>
    {open && !disabled && <div className="tb-break-options" role="group" aria-label={`Break after ${name}`}>
      {[5,10,15].map(n=><button key={n} type="button" className="tb-small" onClick={()=>add(n)}>{n}-minute break</button>)}
      <label>Custom duration<input type="number" min="1" max="720" step="1" value={custom} onChange={e=>setCustom(e.target.value)} aria-label={`Custom break duration after ${name}`} /></label>
      <button type="button" className="tb-small" disabled={!Number.isInteger(Number(custom)) || Number(custom)<1 || Number(custom)>720} onClick={()=>add(Number(custom))}>Add custom break</button>
      <button type="button" className="tb-small" onClick={()=>setOpen(false)}>Cancel</button>
    </div>}
  </div>;
}

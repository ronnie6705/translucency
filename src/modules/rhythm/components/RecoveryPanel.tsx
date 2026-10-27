import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import type { SchedulingResult } from '../recovery/recovery-planner';
import { anchorKey, setRecoveryOverride, type BreakPreferences as Preferences } from '../recovery/recovery-types';
import { effectiveFlexibility, type TimeAdjustments } from '../time-adjustments';
import { BreakPreferences } from './BreakPreferences';

function FlexibilitySlider({value,disabled,onCommit}:{value:number;disabled:boolean;onCommit(value:number):void}) {
  const [draft,setDraft]=useState(value);
  const current=useRef(value),timer=useRef<ReturnType<typeof setTimeout>|null>(null),dragging=useRef(false);
  const cancel=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;};
  useEffect(()=>{cancel();current.current=value;setDraft(value);},[value]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const commit=()=>{cancel();if(!disabled && current.current!==value)onCommit(current.current);};
  return <div className="tb-recovery-flexibility">
    <label htmlFor="recovery-flexibility">Adjustment flexibility</label>
    <p id="recovery-flexibility-description">{disabled?'Choose a recovery preset to enable time adjustments.':'Reduce task duration by up to this amount to make room for breaks.'}</p>
    <div className="tb-recovery-slider" data-disabled={disabled}>
      <div className="tb-recovery-slider-fill" style={{width:`${draft / 20 * 100}%`}} aria-hidden="true">
        <img src="/rhythm/recovery/slider-handle.svg" alt="" />
      </div>
      <output htmlFor="recovery-flexibility" aria-hidden="true">{draft}%</output>
    <input id="recovery-flexibility" aria-describedby="recovery-flexibility-description" aria-valuetext={`${draft}%`} type="range" min="0" max="20" step="1" value={draft} disabled={disabled}
      onPointerDown={e=>{dragging.current=true;e.currentTarget.setPointerCapture(e.pointerId);cancel();}}
      onPointerUp={()=>{dragging.current=false;commit();}}
      onPointerCancel={()=>{dragging.current=false;cancel();setDraft(value);current.current=value;}}
      onChange={e=>{const next=Number(e.target.value);current.current=next;setDraft(next);if(!dragging.current){cancel();timer.current=setTimeout(commit,250);}}}
      onBlur={commit} />
    </div>
  </div>;
}
export function RecoveryPanel({tasks,preferences,onPreferencesChange,result,adjustments,onFlexibilityChange,onUndo,canUndo,busy,undoError}:{
  tasks:Task[];preferences:Preferences;onPreferencesChange(value:Preferences):void;result:SchedulingResult;
  adjustments:TimeAdjustments;onFlexibilityChange(value:number):void;onUndo():void;canUndo:boolean;busy:boolean;undoError:string;
}) {
  const pending=result.status==='invalid';
  return <section className="tb-recovery-panel" aria-label="Recovery">
    <header className="tb-recovery-heading">
      <div><h3>Recovery Breaks</h3><p>Choose your balance between focus and breaks</p></div>
      <button type="button" className="tb-recovery-undo" aria-label="Undo last change" disabled={!canUndo || busy || pending} onClick={onUndo}><img src="/rhythm/recovery/undo.svg" alt="" />Undo</button>
    </header>
    <BreakPreferences value={preferences} onChange={onPreferencesChange}/>
    {pending ? <p className="tb-recovery-shortfall" role="status">Requested settings are pending. The timeline shows the last accepted schedule.</p> : preferences.preset!=='none' && result.recoveryShortfallMinutes>0 && <p className="tb-recovery-shortfall" role="status">{result.recoveryShortfallMinutes} minutes of recommended recovery couldn’t fit.</p>}
    <details className="tb-recovery-advanced"><summary><img src="/rhythm/recovery/advanced.svg" alt="" /><span>Advanced Options</span><img className="tb-recovery-chevron" src="/rhythm/recovery/chevron.svg" alt="" /></summary>
      <FlexibilitySlider key={preferences.preset} value={effectiveFlexibility(adjustments)} disabled={busy || preferences.preset==='none'} onCommit={onFlexibilityChange}/>
      {preferences.overrides.length>0 && <details className="tb-recovery-overrides"><summary>Recovery adjustments ({preferences.overrides.length})</summary>{preferences.overrides.map(override=><div key={anchorKey(override.anchor)}><span>{tasks.find(t=>t.id===override.anchor.taskId)?.name ?? 'Removed task'} · {override.anchor.atTaskEnd?'after task':`after ${override.anchor.offsetMinutes}m`} · {override.removed?'removed':`${override.durationMinutes}m`}</span><button type="button" className="tb-small" onClick={()=>onPreferencesChange(setRecoveryOverride(preferences,override.anchor))}>Restore automatic</button></div>)}{result.inactiveOverrideKeys.length>0 && <p>{result.inactiveOverrideKeys.length} adjustment(s) are inactive until their boundary is available.</p>}</details>}
    </details>
    {undoError && <p role="status">{undoError}</p>}
  </section>;
}

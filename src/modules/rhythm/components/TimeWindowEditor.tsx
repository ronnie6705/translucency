import { useEffect, useRef, useState } from 'react';
import type { DayConfig } from '../types';
import { validateTimeblockPlan } from '../timeblock-plan';
import { PlanTimeRange } from './PlanTimeRange';
export function TimeWindowEditor({ config, onChange, onClose, lockStart = false, validate }: {
  config: DayConfig; onChange(config: DayConfig): void | boolean | Promise<void | boolean>; onClose(): void;
  lockStart?: boolean; validate?(config: DayConfig): string | undefined;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(config);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const valid = validateTimeblockPlan([], draft.startTime, draft.endTime).validRange;
  const validation = validate?.(draft);
  useEffect(() => { const trigger = document.activeElement as HTMLElement | null; dialog.current?.showModal(); return () => trigger?.focus(); }, []);
  return <dialog className="tb-range-dialog" ref={dialog} aria-label="Edit today's time window" onCancel={e => { e.preventDefault(); e.stopPropagation(); if (!busy) onClose(); }}>
    <PlanTimeRange lockStart={lockStart} startTime={draft.startTime} endTime={draft.endTime} timeZone={draft.timezone} validRange={valid}
      onRangeChange={(startTime,endTime) => { setSaveError(''); setDraft(prev => ({ ...prev,startTime:lockStart ? config.startTime : startTime,endTime })); }} onTimeZoneChange={timezone => setDraft(prev => ({ ...prev, timezone }))} />
    {lockStart && <p className="tb-live-window-note">The session start stays fixed. Only remaining work is resized.</p>}
    {(validation || saveError) && <p role="alert" className="plan-error">{validation || saveError}</p>}
    <div className="tb-range-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" disabled={busy || !valid || !!validation} onClick={async () => {
      setBusy(true);
      try { const ok = await onChange(draft); if (ok !== false) onClose(); else setSaveError('The time window could not be saved. Please try again.'); }
      catch (error) { setSaveError(error instanceof Error ? error.message : 'The time window could not be saved.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Saving…' : 'Apply time window'}</button></div>
  </dialog>;
}

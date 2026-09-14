import { TaskListBadge } from "./TaskListBadge";
import { useEffect, useRef, useState } from 'react';
import { completeTimerTask, timerBlockHeight, timerPosition, type LiveTimer as Timer, type TimerTaskOutcome } from '../live-timer';
import type { ScheduleBlock } from '../types';
import { useBlockClear } from './use-block-clear';

export function TimerIcon({ name }: { name: string }) {
  return <img className="timer-icon" src={`/rhythm/timer/${name}.svg`} width={24} height={24} alt="" aria-hidden="true" />;
}

function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(id); window.removeEventListener('focus', tick); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return now;
}

function timeLabel(value: number | string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function durationLabel(ms: number) {
  const mins = Math.round(ms / 60000);
  return mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins} mins`;
}

type CompleteTask = (taskId: string, now: number, outcome: TimerTaskOutcome) => Promise<boolean>;
type PendingTask = { at: number; snapshot: Timer; reflow: boolean; outcome: TimerTaskOutcome };
type BlockFrame = { top: number; height: number };
type TimelineAnchor = { at: number; line: number; activeId?: string; elapsed: number; frames: Record<string, BlockFrame>; schedule: string };
const scheduleKey = (timer: Timer) => JSON.stringify(timer.blocks.map(b => [b.id, b.start, b.end]));

function TimerBlock({ block, state, timezone, height, pending, onRetain, onReflow, onComplete, before = 0, exitTop }: {
  block: ScheduleBlock; state: string; timezone: string; height: number; pending?: TimerTaskOutcome;
  before?: number; exitTop?: number;
  onRetain(value: boolean, outcome: TimerTaskOutcome): void; onReflow(): void; onComplete?: (outcome: TimerTaskOutcome) => Promise<boolean>;
}) {
  const card = useRef<HTMLDivElement>(null);
  const outcome = useRef<TimerTaskOutcome>('completed');
  const clear = useBlockClear(card, value => onRetain(value, outcome.current), {
    impact: '.live-timer-task-icon', content: '.live-timer-task-icon, .live-timer-copy',
    panel: '.live-timer-card', item: '.live-timer-block:has(.live-timer-complete)', control: '.live-timer-complete', onReflow,
    quiet: () => outcome.current === 'skipped',
  });
  const run = (value: TimerTaskOutcome) => {
    if (!onComplete || clear.locked.current) return;
    outcome.current = value;
    void clear.complete(() => onComplete(value));
  };
  useEffect(() => {
    // Other segments of this same task share the one in-flight save.
    if (pending && !clear.locked.current) run(pending);
    // The pending flag is the event, not the changing clock/render callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);
  return <div className="task-clear-slot live-timer-slot" ref={clear.slot} style={exitTop === undefined ? { marginTop: before } : { position: 'absolute', top: exitTop, width: '100%' }}>
    <div ref={card} data-block-id={block.id} data-task-id={block.taskId} data-outcome={clear.active ? outcome.current : undefined} className={`live-timer-block ${state}${block.isBreak ? ' is-break' : ''}`} style={{ minHeight: height }} aria-current={state === 'active' ? 'step' : undefined}>
      <div className="live-timer-task-icon">{clear.active ? <TimerIcon name={outcome.current === 'completed' ? 'check' : 'cross'} /> : <TimerIcon name={block.isBreak ? 'break' : 'task'} />}</div>
      <div className="live-timer-copy"><time dateTime={block.start}>{timeLabel(block.start, timezone)}</time>
        <div className="live-timer-task-heading"><h3>{block.taskName}<TaskListBadge taskId={block.taskId} /></h3>
          {onComplete && !block.isBreak && <div className="live-timer-task-actions">
            {(['completed', 'skipped'] as const).map(value => <button key={value} type="button" className={`live-timer-action ${value === 'completed' ? 'live-timer-complete' : 'live-timer-skip'}`}
              aria-label={`${value === 'completed' ? 'Complete' : 'Could not complete'} ${block.taskName}`} title={value === 'completed' ? 'Done' : 'Could not do this task'}
              aria-pressed={clear.active && outcome.current === value} aria-disabled={!!pending || clear.active}
              onPointerDown={e => { if (e.button === 0 && !pending && !clear.locked.current) { outcome.current = value; clear.press(); } }}
              onPointerLeave={clear.release} onPointerCancel={clear.release} onBlur={clear.release}
              onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !pending && !clear.locked.current) { outcome.current = value; clear.press(); } }}
              onClick={() => { if (!pending) run(value); }}><TimerIcon name={value === 'completed' ? 'check' : 'cross'} /></button>)}
          </div>}
        </div>
      <div className="live-timer-badges"><span><TimerIcon name="clock" />{durationLabel(Date.parse(block.end) - Date.parse(block.start))}</span>{!block.isBreak && <span><TimerIcon name="energy" />{block.energyRequired}</span>}</div>
      </div>
    </div>
  </div>;
}

function TimerCard({ timer: savedTimer, now, onClose, onComplete, error }: { timer: Timer; now: number; onClose?: () => void; onComplete?: CompleteTask; error?: string }) {
  const pendingRef = useRef(new Map<string, PendingTask>());
  const requests = useRef(new Map<string, Promise<boolean>>());
  const [pending, setPending] = useState(new Map<string, PendingTask>());
  const [anchor, setAnchor] = useState<TimelineAnchor | null>(null);
  const retain = (taskId: string, value: boolean, outcome: TimerTaskOutcome) => {
    if (value) {
      if (pendingRef.current.has(taskId)) return;
      const at = Date.now();
      if (!pendingRef.current.size) {
        originalExtent.current = Math.max(originalExtent.current, list.current?.offsetHeight ?? 0);
        const frames = Object.fromEntries(Array.from(list.current?.querySelectorAll<HTMLElement>('.live-timer-block') ?? []).map(row => [row.dataset.blockId!, { top: row.parentElement?.offsetTop ?? 0, height: row.offsetHeight }]));
        const active = timer.blocks[timerPosition(timer.blocks, at).activeIndex];
        const marker = list.current?.querySelector<HTMLElement>('.live-timer-now');
        const currentLine = marker ? parseFloat(getComputedStyle(marker).top) : line;
        const activeFrame = active && frames[active.id];
        setAnchor({ at, line: currentLine, activeId: active?.id, elapsed: activeFrame ? Math.max(0, Math.min(activeFrame.height, currentLine - activeFrame.top)) : 0, frames, schedule: scheduleKey(timer) });
      }
      pendingRef.current.set(taskId, { at, snapshot: timer, reflow: false, outcome });
    } else {
      pendingRef.current.delete(taskId);
      requests.current.delete(taskId);
    }
    setPending(new Map(pendingRef.current));
  };
  const reflow = (taskId: string) => {
    const entry = pendingRef.current.get(taskId);
    if (!entry || entry.reflow) return;
    pendingRef.current.set(taskId, { ...entry, reflow: true });
    setPending(new Map(pendingRef.current));
  };
  const complete = (taskId: string, outcome: TimerTaskOutcome) => {
    let request = requests.current.get(taskId);
    if (!request) {
      request = onComplete!(taskId, pendingRef.current.get(taskId)?.at ?? Date.now(), outcome);
      requests.current.set(taskId, request);
    }
    return request;
  };
  const optimisticTimer = [...pending].reduce((value, [id, entry]) => completeTimerTask(value, id, entry.at, entry.outcome), savedTimer);
  const held = [...pending.values()].find(entry => !entry.reflow);
  const timer = held?.snapshot ?? optimisticTimer;
  const visibleBlocks = [...timer.blocks];
  for (const [taskId, entry] of pending) {
    entry.snapshot.blocks.forEach((block, index) => {
      if (block.taskId === taskId && !visibleBlocks.some(b => b.id === block.id)) visibleBlocks.splice(Math.min(index, visibleBlocks.length), 0, block);
    });
  }
  const originalExtent = useRef(savedTimer.blocks.reduce((sum, block) => sum + timerBlockHeight(block), 0) + Math.max(0, savedTimer.blocks.length - 1) * 12);
  const workDuration = timer.blocks.filter(b => !b.isBreak).reduce((sum, b) => sum + Date.parse(b.end) - Date.parse(b.start), 0);
  const workExtent = originalExtent.current - timer.blocks.filter(b => b.isBreak).reduce((sum, b) => sum + timerBlockHeight(b), 0) - Math.max(0, timer.blocks.length - 1) * 12;
  const blockHeight = (block: ScheduleBlock) => !block.isBreak && !pending.has(block.taskId) && (timer.completedTaskIds?.length || timer.skippedTaskIds?.length) && workDuration
    ? Math.max(timerBlockHeight(block), workExtent * (Date.parse(block.end) - Date.parse(block.start)) / workDuration)
    : timerBlockHeight(block);
  const elapsedHeight = (block: ScheduleBlock) => anchor?.activeId === block.id ? anchor.elapsed : 0;
  const future = anchor ? timer.blocks.filter(b => Date.parse(b.end) > anchor.at) : [];
  const futureWork = future.filter(b => !b.isBreak).reduce((sum, b) => sum + Date.parse(b.end) - Math.max(anchor!.at, Date.parse(b.start)), 0);
  const futureBreaks = future.filter(b => b.isBreak).reduce((sum, b) => sum + (anchor?.frames[b.id]?.height ?? timerBlockHeight(b)) - elapsedHeight(b), 0);
  const futureExtent = anchor ? Math.max(0, originalExtent.current - anchor.line - futureBreaks - Math.max(0, future.length - 1) * 12) : 0;
  const unchanged = anchor?.schedule === scheduleKey(timer);
  const displayHeight = (block: ScheduleBlock) => {
    if (!anchor) return blockHeight(block);
    const oldHeight = anchor.frames[block.id]?.height ?? timerBlockHeight(block);
    if (unchanged || Date.parse(block.end) <= anchor.at || block.isBreak || pending.has(block.taskId)) return oldHeight;
    const weight = Date.parse(block.end) - Math.max(anchor.at, Date.parse(block.start));
    return Math.max(timerBlockHeight(block), elapsedHeight(block) + (futureWork ? futureExtent * weight / futureWork : 0));
  };
  // Keep the elapsed region in the document even if its task is cleared.
  // Only the unelapsed part of the running card and future cards share space.
  const layout: Record<string, BlockFrame & { before: number }> = {};
  let cursor = 0;
  let reachedFuture = false;
  for (const block of timer.blocks) {
    let before = 0;
    if (anchor) {
      if (Date.parse(block.end) <= anchor.at) before = Math.max(0, (anchor.frames[block.id]?.top ?? cursor) - cursor);
      else if (!reachedFuture) {
        before = Math.max(0, anchor.line - elapsedHeight(block) - cursor);
        reachedFuture = true;
      }
    }
    layout[block.id] = { top: cursor + before, height: displayHeight(block), before };
    cursor += before + displayHeight(block) + 12;
  }
  const list = useRef<HTMLDivElement>(null);
  const [listTop, setListTop] = useState(0);
  const [measurements, setMeasurements] = useState<Record<string, BlockFrame>>({});
  useEffect(() => {
    const elements = Array.from(list.current?.querySelectorAll<HTMLElement>('.live-timer-block') ?? []);
    const measure = () => {
      setListTop(list.current?.offsetTop ?? 0);
      setMeasurements(Object.fromEntries(elements.map(element => [element.dataset.blockId!, { top: element.parentElement?.offsetTop ?? 0, height: element.offsetHeight }])));
      // Child effects run before showModal(): a hidden dialog measures zero.
      if (!pendingRef.current.size && !savedTimer.completedTaskIds?.length && !savedTimer.skippedTaskIds?.length) originalExtent.current = Math.max(originalExtent.current, list.current?.offsetHeight ?? 0);
    };
    let settle: ReturnType<typeof setTimeout>;
    const observer = new ResizeObserver(() => { clearTimeout(settle); settle = setTimeout(measure, 280); });
    elements.forEach(element => observer.observe(element));
    if (list.current?.parentElement) observer.observe(list.current.parentElement);
    measure();
    return () => { observer.disconnect(); clearTimeout(settle); };
  }, [savedTimer.blocks, pending]);
  const { activeIndex, nextIndex, phase, progress } = timerPosition(timer.blocks, now);
  const heights = timer.blocks.map(block => anchor ? displayHeight(block) : measurements[block.id]?.height ?? blockHeight(block));
  const offset = (index: number) => anchor ? layout[timer.blocks[index]?.id]?.top ?? 0 : measurements[timer.blocks[index]?.id]?.top ?? heights.slice(0, index).reduce((sum, height) => sum + height + 12, 0);
  let line = activeIndex >= 0 ? offset(activeIndex) + heights[activeIndex] * progress : 0;
  const activeBlock = timer.blocks[activeIndex];
  if (anchor && activeBlock && Date.parse(activeBlock.start) <= anchor.at) {
    const remainingProgress = Math.max(0, Math.min(1, (now - anchor.at) / (Date.parse(activeBlock.end) - anchor.at)));
    line = anchor.line + (heights[activeIndex] - elapsedHeight(activeBlock)) * remainingProgress;
  }
  if (phase === 'gap') {
    const previousEnd = Date.parse(timer.blocks[nextIndex - 1].end);
    const gap = Date.parse(timer.blocks[nextIndex].start) - previousEnd;
    line = offset(nextIndex) - 12 + 12 * (now - previousEnd) / gap;
  }
  const allDone = !timer.blocks.some(b => !b.isBreak) && !!(timer.completedTaskIds?.length || timer.skippedTaskIds?.length);
  const date = new Intl.DateTimeFormat('en-US', { timeZone: timer.timezone, month: 'short', day: 'numeric' }).format(new Date(timer.startedAt ?? timer.blocks[0].start));
  const status = allDone ? timer.skippedTaskIds?.length ? `Timeblock finished. ${timer.completedTaskIds?.length ?? 0} completed · ${timer.skippedTaskIds.length} not done.` : 'All tasks complete. Nicely done.' : phase === 'complete' ? 'Timeblock complete' : phase === 'scheduled' ? `Starts ${timeLabel(timer.blocks[0].start, timer.timezone)}` : phase === 'gap' ? `Next: ${timer.blocks[nextIndex].taskName}` : `Now: ${timer.blocks[activeIndex].taskName}`;
  return <div className={`live-timer-card phase-${phase}`} tabIndex={onComplete ? -1 : undefined} aria-label="Live timer tasks">
    <header className="live-timer-header">
      <div><p className="live-timer-kicker">Timeblock</p><div className="live-timer-title"><h2>{timer.name}</h2><span>{date}</span></div></div>
      {onClose && <button type="button" className="live-timer-close" aria-label="Close live timer" onClick={onClose}><TimerIcon name="close" /></button>}
    </header>
    <p className={phase === 'running' && !allDone ? 'sr-only' : 'live-timer-status'} role="status">{status}</p>
    {error && onComplete && <p role="alert" className="live-timer-error">{error}</p>}
    <div className="live-timer-blocks" ref={list} style={{ minHeight: anchor && !allDone ? originalExtent.current : undefined }}>
      {visibleBlocks.map((block) => {
        const state = now >= Date.parse(block.end) ? 'past' : timer.blocks[activeIndex]?.id === block.id ? 'active' : 'upcoming';
        const exiting = !layout[block.id] && pending.get(block.taskId)?.reflow;
        return <TimerBlock key={block.id} block={block} state={state} timezone={timer.timezone} height={displayHeight(block)} pending={pending.get(block.taskId)?.outcome}
          before={layout[block.id]?.before} exitTop={exiting ? anchor?.frames[block.id]?.top ?? 0 : undefined}
          onRetain={(value, outcome) => retain(block.taskId, value, outcome)} onReflow={() => reflow(block.taskId)} onComplete={onComplete && !block.isBreak ? outcome => complete(block.taskId, outcome) : undefined} />;
      })}
      {(phase === 'running' || phase === 'gap') && <div className="live-timer-now" style={{ top: line }} aria-hidden="true"><span>{timeLabel(now, timer.timezone)}</span></div>}
    </div>
    {(phase === 'running' || phase === 'gap') && <div className="live-timer-effects" aria-hidden="true"><div className="live-timer-now" style={{ top: listTop + line }}><div className="live-timer-glow-window"><img className="live-timer-glow" src="/rhythm/timer/glow.svg" alt="" /></div></div></div>}
  </div>;
}

export function LiveTimerPreview({ timer, onOpen }: { timer: Timer; onOpen: () => void }) {
  const now = useClock();
  return <section className="live-timer-section" aria-labelledby="live-timer-section-title">
    <h2 id="live-timer-section-title" className="section-kicker">Live Timer</h2>
    <button type="button" className="live-timer-preview" aria-label={`Open live timer: ${timer.name}`} onClick={onOpen}>
      <div className="live-timer-preview-content" aria-hidden="true"><TimerCard timer={timer} now={now} /></div>
      <span className="live-timer-open-hint"><TimerIcon name="timer" />Open fullscreen</span>
    </button>
  </section>;
}

export function LiveTimerModal({ timer, onClose, onComplete, error }: { timer: Timer; onClose: () => void; onComplete: CompleteTask; error?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const now = useClock();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      const target = previous?.isConnected ? previous : document.querySelector<HTMLElement>('.live-timer-preview, #main');
      target?.focus();
    };
  }, []);
  return <dialog ref={dialog} className="live-timer-modal" aria-label="Live timer" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="live-timer-stage"><TimerCard key={timer.id} timer={timer} now={now} onClose={onClose} onComplete={onComplete} error={error} /></div>
  </dialog>;
}

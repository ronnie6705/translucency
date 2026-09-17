import { TaskListBadge } from "./TaskListBadge";
import { useCallback, useEffect, useRef, useState } from 'react';
import { completeTimerTask, formatDurationHM, timerBlockHeight, timerPosition, type LiveTimer as Timer, type TimerTaskOutcome } from '../live-timer';
import { insertItemIntoTimer, reorderTimerBlocks, type InsertItemParams } from '../insert-live-task';
import type { ScheduleBlock } from '../types';
import { useBlockClear } from './use-block-clear';
import { QuickTaskValue } from './task-dialogs';

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

function TimerBlock({ block, state, timezone, height, pending, onRetain, onReflow, onComplete, before = 0, exitTop, isNewlyAdded, isDraggable, isDragging, dragOverPosition, onDragStart }: {
  block: ScheduleBlock; state: string; timezone: string; height: number; pending?: TimerTaskOutcome;
  before?: number; exitTop?: number; isNewlyAdded?: boolean;
  isDraggable?: boolean; isDragging?: boolean; dragOverPosition?: 'above' | 'below' | null;
  onDragStart?: (e: React.PointerEvent) => void;
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input, a')) return;
    if (e.button !== 0) return;
    onDragStart?.(e);
  };

  const dragClass = isDragging
    ? ' is-dragging'
    : dragOverPosition === 'above'
    ? ' drag-over-above'
    : dragOverPosition === 'below'
    ? ' drag-over-below'
    : '';

  return <div className="task-clear-slot live-timer-slot" ref={clear.slot} style={exitTop === undefined ? { marginTop: before } : { position: 'absolute', top: exitTop, width: '100%' }}>
    <div ref={card} data-block-id={block.id} data-task-id={block.taskId} data-outcome={clear.active ? outcome.current : undefined}
      className={`live-timer-block ${state}${block.isBreak ? ' is-break' : ''}${isNewlyAdded ? ' is-newly-added' : ''}${isDraggable ? ' is-draggable' : ''}${dragClass}`}
      style={{ minHeight: height }} aria-current={state === 'active' ? 'step' : undefined}
      onPointerDown={isDraggable ? handlePointerDown : undefined}>
      <div className="live-timer-task-icon">{clear.active ? <TimerIcon name={outcome.current === 'completed' ? 'check' : 'cross'} /> : <TimerIcon name={block.isBreak ? 'break' : 'task'} />}</div>
      <div className="live-timer-copy"><time dateTime={block.start}>{timeLabel(block.start, timezone)}</time>
        <div className="live-timer-task-heading"><h3>{block.taskName}<TaskListBadge taskId={block.taskId} /></h3>
          {onComplete && !block.isBreak && state !== 'past' && <div className="live-timer-task-actions">
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

function LiveTimerPanel({
  timer,
  now,
  onInsertItem,
}: {
  timer: Timer;
  now: number;
  onInsertItem: (params: InsertItemParams) => void;
}) {
  const { activeIndex, nextIndex, phase } = timerPosition(timer.blocks, now);
  const activeBlock = activeIndex >= 0 ? timer.blocks[activeIndex] : null;

  // 1. Current / Upcoming status
  const currentTaskName = phase === 'complete'
    ? 'Timeblock complete'
    : activeBlock
    ? activeBlock.taskName
    : phase === 'scheduled'
    ? `Starts ${timeLabel(timer.blocks[0]?.start ?? now, timer.timezone)}`
    : phase === 'gap'
    ? 'Break between tasks'
    : 'None';

  const upcomingBlock = activeIndex >= 0
    ? timer.blocks[activeIndex + 1] ?? null
    : phase === 'scheduled'
    ? timer.blocks[0] ?? null
    : phase === 'gap'
    ? timer.blocks[nextIndex] ?? null
    : null;

  const upcomingTaskName = upcomingBlock ? upcomingBlock.taskName : '—';

  // 2. Elapsed & Remaining Time
  const timeblockStart = Date.parse(timer.startedAt ?? timer.blocks[0]?.start ?? new Date(now).toISOString());
  const timeblockEnd = Date.parse(timer.endsAt ?? timer.blocks[timer.blocks.length - 1]?.end ?? new Date(now).toISOString());
  const elapsedMs = now < timeblockStart ? 0 : now > timeblockEnd ? timeblockEnd - timeblockStart : now - timeblockStart;
  const remainingMs = Math.max(0, timeblockEnd - Math.max(now, timeblockStart));

  // 3. Unified Add Task / Break state
  const [itemType, setItemType] = useState<'task' | 'break'>('task');
  const [title, setTitle] = useState('');
  const [taskDuration, setTaskDuration] = useState(30);
  const [breakDuration, setBreakDuration] = useState(10);
  const [energy, setEnergy] = useState(3);
  const [quickEnergy, setQuickEnergy] = useState(false);
  const [position, setPosition] = useState<'after' | 'before'>('after');
  const [anchorId, setAnchorId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Eligible anchor items (Req 12: do not allow inserting into elapsed history)
  const getAnchorOptions = (pos: 'after' | 'before') => {
    const options: { id: string; label: string }[] = [];
    if (phase === 'scheduled') {
      return timer.blocks.map(b => ({
        id: b.id,
        label: `${b.taskName} (${durationLabel(Date.parse(b.end) - Date.parse(b.start))})`,
      }));
    }
    if (activeBlock && pos === 'after') {
      options.push({
        id: activeBlock.id,
        label: `Current: ${activeBlock.taskName}`,
      });
    }
    const startIndex = activeIndex >= 0 ? activeIndex + 1 : (nextIndex >= 0 ? nextIndex : 0);
    for (let i = startIndex; i < timer.blocks.length; i++) {
      const b = timer.blocks[i];
      const dur = durationLabel(Date.parse(b.end) - Date.parse(b.start));
      options.push({
        id: b.id,
        label: `${b.taskName} (${dur})`,
      });
    }
    return options;
  };

  const anchorOptions = getAnchorOptions(position);

  // Sync selected anchor when position or options change
  useEffect(() => {
    if (!anchorOptions.some(o => o.id === anchorId)) {
      setAnchorId(anchorOptions[0]?.id ?? '');
    }
  }, [position, anchorOptions, anchorId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !anchorId || phase === 'complete') return;
    onInsertItem({
      title: title.trim(),
      durationMinutes: itemType === 'task' ? taskDuration : breakDuration,
      isBreak: itemType === 'break',
      anchorId,
      position,
      energyRequired: itemType === 'task' ? energy : 1,
    });
    setTitle('');
    setIsDrawerOpen(false);
  };

  return (
    <aside className="live-timer-panel" aria-label="Session controls">
      {/* 1. Current / Upcoming Tasks Card */}
      <div className="live-timer-panel-card live-timer-status-card">
        <h3 className="live-timer-section-title">CURRENT &amp; UPCOMING TASKS</h3>
        <div className="live-timer-task-rows">
          <div className="live-timer-task-row">
            <div className="live-timer-task-info">
              <span className="live-timer-task-kicker">CURRENT TASK</span>
              <span className="live-timer-task-label" title={currentTaskName}>
                {currentTaskName}
              </span>
            </div>
            {activeBlock && (
              <div className="live-timer-task-badges">
                <div className="live-timer-badge">
                  <TimerIcon name={activeBlock.isBreak ? 'break' : 'clock'} />
                  <span>{durationLabel(Date.parse(activeBlock.end) - Date.parse(activeBlock.start))}</span>
                </div>
                {!activeBlock.isBreak && (
                  <div className="live-timer-badge">
                    <TimerIcon name="energy" />
                    <span>{activeBlock.energyRequired}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="live-timer-task-row">
            <div className="live-timer-task-info">
              <span className="live-timer-task-kicker">UPCOMING TASK</span>
              <span className="live-timer-task-label" title={upcomingTaskName}>
                {upcomingTaskName}
              </span>
            </div>
            {upcomingBlock && (
              <div className="live-timer-task-badges">
                <div className="live-timer-badge">
                  <TimerIcon name={upcomingBlock.isBreak ? 'break' : 'clock'} />
                  <span>{durationLabel(Date.parse(upcomingBlock.end) - Date.parse(upcomingBlock.start))}</span>
                </div>
                {!upcomingBlock.isBreak && (
                  <div className="live-timer-badge">
                    <TimerIcon name="energy" />
                    <span>{upcomingBlock.energyRequired}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Time Elapsed / Remaining Time */}
      <div className="live-timer-metrics-card">
        <div className="live-timer-metric">
          <span className="live-timer-metric-kicker">TIME ELAPSED</span>
          <div className="live-timer-metric-val">{formatDurationHM(elapsedMs)}</div>
        </div>
        <div className="live-timer-metric">
          <span className="live-timer-metric-kicker">REMAINING</span>
          <div className="live-timer-metric-val">{formatDurationHM(remainingMs)}</div>
        </div>
      </div>

      {/* 3. Add Task / Break Form & Drawer */}
      <form className="live-timer-add-wrap" onSubmit={handleSubmit}>
        <div className="live-timer-add-bar">
          <div className="live-timer-add-bar-left">
            <TimerIcon name="plus" />
            <input
              type="text"
              placeholder="Add a Task/ Break"
              value={title}
              onChange={e => {
                const val = e.target.value;
                setTitle(val);
                if (val.trim().length > 0) {
                  setIsDrawerOpen(true);
                } else {
                  setIsDrawerOpen(false);
                }
              }}
              aria-label="New task or break name"
              disabled={phase === 'complete'}
            />
          </div>
          <div className="live-timer-toggle-group">
            <button
              type="button"
              className={`live-timer-toggle-btn ${itemType === 'task' ? 'active' : ''}`}
              aria-label="Add as task"
              aria-pressed={itemType === 'task'}
              onClick={() => {
                setItemType('task');
                if (title.trim().length > 0) setIsDrawerOpen(true);
              }}
            >
              <TimerIcon name="task" />
            </button>
            <button
              type="button"
              className={`live-timer-toggle-btn ${itemType === 'break' ? 'active' : ''}`}
              aria-label="Add as break"
              aria-pressed={itemType === 'break'}
              onClick={() => {
                setItemType('break');
                if (title.trim().length > 0) setIsDrawerOpen(true);
              }}
            >
              <TimerIcon name="break" />
            </button>
          </div>
        </div>

        <div className="live-timer-add-drawer" aria-hidden={!isDrawerOpen}>
          <div className="live-timer-add-drawer-fields">
            <span className="live-timer-drawer-label">ELEMENTS</span>
            <div className="live-timer-drawer-row">
              {itemType === 'task' ? (
                <div className="task-quick-anchor live-timer-drawer-field">
                  <button
                    type="button"
                    className="live-timer-drawer-field-btn"
                    aria-label="Select energy level"
                    aria-expanded={quickEnergy}
                    onClick={() => setQuickEnergy(!quickEnergy)}
                  >
                    <TimerIcon name="energy" />
                    <span>{energy}</span>
                  </button>
                  {quickEnergy && (
                    <QuickTaskValue
                      task={{ durationMinutes: taskDuration, energyRequired: (energy || 3) as 1 | 2 | 3 | 4 | 5 }}
                      mode="energy"
                      onChange={(updates) => {
                        if (updates.energyRequired !== undefined) {
                          setEnergy(updates.energyRequired);
                        }
                      }}
                      onClose={() => setQuickEnergy(false)}
                    />
                  )}
                </div>
              ) : (
                <div className="live-timer-drawer-field live-timer-drawer-field-disabled">
                  <TimerIcon name="break" />
                  <span>Rest</span>
                </div>
              )}
              <div className="live-timer-drawer-field">
                <TimerIcon name="stopwatch" />
                <select
                  value={itemType === 'task' ? taskDuration : breakDuration}
                  onChange={e => {
                    const val = Number(e.target.value);
                    if (itemType === 'task') setTaskDuration(val);
                    else setBreakDuration(val);
                  }}
                  aria-label="Duration"
                >
                  {itemType === 'task' ? (
                    <>
                      <option value={15}>15m</option>
                      <option value={30}>30m</option>
                      <option value={45}>45m</option>
                      <option value={60}>1h</option>
                      <option value={90}>1h 30m</option>
                      <option value={120}>2h</option>
                    </>
                  ) : (
                    <>
                      <option value={5}>5m</option>
                      <option value={10}>10m</option>
                      <option value={15}>15m</option>
                      <option value={20}>20m</option>
                      <option value={30}>30m</option>
                      <option value={45}>45m</option>
                      <option value={60}>1h</option>
                    </>
                  )}
                </select>
                <TimerIcon name="chevron-down" />
              </div>
            </div>

            <span className="live-timer-drawer-label">TASK PLACEMENT</span>
            <div className="live-timer-drawer-row">
              <div className="live-timer-drawer-field">
                <select
                  value={position}
                  onChange={e => setPosition(e.target.value as 'after' | 'before')}
                  aria-label="Placement before or after"
                >
                  <option value="after">After</option>
                  <option value="before">Before</option>
                </select>
                <TimerIcon name="chevron-down" />
              </div>
              <div className="live-timer-drawer-field">
                <TimerIcon name="task" />
                <select
                  value={anchorId}
                  onChange={e => setAnchorId(e.target.value)}
                  aria-label="Anchor item"
                  disabled={!anchorOptions.length}
                >
                  {anchorOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <TimerIcon name="chevron-down" />
              </div>
            </div>
          </div>
        </div>
      </form>
    </aside>
  );
}

function TimerCard({
  timer: savedTimer,
  now,
  onClose,
  onComplete,
  onRegisterCapture,
  onReorder,
  newlyAddedId,
  error,
  hideHeader = false,
}: {
  timer: Timer;
  now: number;
  onClose?: () => void;
  onComplete?: CompleteTask;
  onRegisterCapture?: (capture: () => void) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  newlyAddedId?: string | null;
  error?: string;
  hideHeader?: boolean;
}) {
  const pendingRef = useRef(new Map<string, PendingTask>());
  const requests = useRef(new Map<string, Promise<boolean>>());
  const [pending, setPending] = useState(new Map<string, PendingTask>());
  const [anchor, setAnchor] = useState<TimelineAnchor | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [dragState, setDragState] = useState<{
    draggingId: string;
    fromIndex: number;
    hoverIndex: number;
  } | null>(null);

  const captureAnchor = useCallback(() => {
    const at = Date.now();
    originalExtent.current = Math.max(originalExtent.current, list.current?.offsetHeight ?? 0);
    const frames = Object.fromEntries(
      Array.from(list.current?.querySelectorAll<HTMLElement>('.live-timer-block') ?? []).map(row => [
        row.dataset.blockId!,
        { top: row.parentElement?.offsetTop ?? 0, height: row.offsetHeight }
      ])
    );
    const { activeIndex } = timerPosition(savedTimer.blocks, at);
    const active = savedTimer.blocks[activeIndex];
    const marker = list.current?.querySelector<HTMLElement>('.live-timer-now');
    const currentLine = marker ? parseFloat(getComputedStyle(marker).top) : 0;
    const activeFrame = active && frames[active.id];
    setAnchor({
      at,
      line: currentLine,
      activeId: active?.id,
      elapsed: activeFrame ? Math.max(0, Math.min(activeFrame.height, currentLine - activeFrame.top)) : 0,
      frames,
      schedule: scheduleKey(savedTimer),
    });
  }, [savedTimer]);

  useEffect(() => {
    onRegisterCapture?.(captureAnchor);
  }, [captureAnchor, onRegisterCapture]);

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
    if (Date.parse(block.end) <= anchor.at) return oldHeight;
    if (unchanged && !pending.has(block.taskId)) return oldHeight;
    if (block.isBreak && !anchor.frames[block.id]) return timerBlockHeight(block);
    if (block.isBreak || pending.has(block.taskId)) return oldHeight;
    const weight = Date.parse(block.end) - Math.max(anchor.at, Date.parse(block.start));
    return Math.max(timerBlockHeight(block), elapsedHeight(block) + (futureWork ? futureExtent * weight / futureWork : 0));
  };

  // Keep elapsed region in document even if its task is cleared.
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
  const [measurements, setMeasurements] = useState<Record<string, BlockFrame>>({});
  useEffect(() => {
    const elements = Array.from(list.current?.querySelectorAll<HTMLElement>('.live-timer-block') ?? []);
    const measure = () => {
      setMeasurements(Object.fromEntries(elements.map(element => [element.dataset.blockId!, { top: element.parentElement?.offsetTop ?? 0, height: element.offsetHeight }])));
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
  const minMovableIndex = activeIndex >= 0 ? activeIndex + 1 : (nextIndex >= 0 ? nextIndex : 0);

  const handleBlockDragStart = (e: React.PointerEvent, block: ScheduleBlock, fromIndex: number) => {
    if (fromIndex < minMovableIndex) return;
    const startY = e.clientY;
    let isDraggingActive = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      if (!isDraggingActive && Math.abs(deltaY) > 5) {
        isDraggingActive = true;
      }
      if (!isDraggingActive) return;

      if (!list.current) return;
      const blockElements = Array.from(list.current.querySelectorAll<HTMLElement>('.live-timer-block'));
      let targetIndex = fromIndex;

      for (let i = minMovableIndex; i < visibleBlocks.length; i++) {
        const el = blockElements[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
          targetIndex = i;
          break;
        } else if (moveEvent.clientY < rect.top && i === minMovableIndex) {
          targetIndex = minMovableIndex;
          break;
        } else if (moveEvent.clientY > rect.bottom && i === visibleBlocks.length - 1) {
          targetIndex = visibleBlocks.length - 1;
          break;
        }
      }

      targetIndex = Math.max(minMovableIndex, Math.min(visibleBlocks.length - 1, targetIndex));

      setDragState({
        draggingId: block.id,
        fromIndex,
        hoverIndex: targetIndex,
      });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setDragState(current => {
        if (current && isDraggingActive && current.fromIndex !== current.hoverIndex) {
          onReorder?.(current.fromIndex, current.hoverIndex);
        }
        return null;
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

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
    {!hideHeader && <header className="live-timer-header">
      <div><p className="live-timer-kicker">Timeblock</p><div className="live-timer-title"><h2>{timer.name}</h2><span>{date}</span></div></div>
      {onClose && <button type="button" className="live-timer-close" aria-label="Close live timer" onClick={onClose}><TimerIcon name="close" /></button>}
    </header>}
    <p className={hideHeader || (phase === 'running' && !allDone) ? 'sr-only' : 'live-timer-status'} role="status">{status}</p>
    {error && onComplete && <p role="alert" className="live-timer-error">{error}</p>}
    {(phase === 'running' || phase === 'gap') && <>
      <div className="live-timer-elapsed-gradient" style={{ height: Math.max(0, 13.6 + line - scrollTop) }} aria-hidden="true" />
      <div className="live-timer-callout" style={{ top: 13.6 + line - scrollTop }} aria-hidden="true">
        {timeLabel(now, timer.timezone)}
      </div>
      <div className="live-timer-crossbar" style={{ top: 13.6 + line - scrollTop }} aria-hidden="true" />
    </>}
    <div className="live-timer-blocks" ref={list} onScroll={e => setScrollTop(e.currentTarget.scrollTop)} style={{ minHeight: anchor && !allDone ? originalExtent.current : undefined }}>
      {visibleBlocks.map((block, index) => {
        const state = now >= Date.parse(block.end) ? 'past' : timer.blocks[activeIndex]?.id === block.id ? 'active' : 'upcoming';
        const exiting = !layout[block.id] && pending.get(block.taskId)?.reflow;
        const isDraggable = (phase === 'scheduled' || index >= minMovableIndex) && !pending.size && phase !== 'complete';
        const isDragging = dragState?.draggingId === block.id;
        const dragOverPosition = dragState && dragState.hoverIndex === index && !isDragging
          ? (dragState.fromIndex < index ? 'below' : 'above')
          : null;

        return <TimerBlock key={block.id} block={block} state={state} timezone={timer.timezone} height={displayHeight(block)} pending={pending.get(block.taskId)?.outcome}
          before={layout[block.id]?.before} exitTop={exiting ? anchor?.frames[block.id]?.top ?? 0 : undefined}
          isNewlyAdded={newlyAddedId === block.id}
          isDraggable={isDraggable}
          isDragging={isDragging}
          dragOverPosition={dragOverPosition}
          onDragStart={e => handleBlockDragStart(e, block, index)}
          onRetain={(value, outcome) => retain(block.taskId, value, outcome)} onReflow={() => reflow(block.taskId)} onComplete={onComplete && !block.isBreak && state !== 'past' ? outcome => complete(block.taskId, outcome) : undefined} />;
      })}
      {(phase === 'running' || phase === 'gap') && <>
        <div className="live-timer-now" style={{ top: line }} aria-hidden="true"><span>{timeLabel(now, timer.timezone)}</span></div>
      </>}
    </div>
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

export function LiveTimerModal({
  timer,
  onClose,
  onComplete,
  onInsertItem,
  onReorderBlocks,
  error,
}: {
  timer: Timer;
  onClose: () => void;
  onComplete: CompleteTask;
  onInsertItem?: (params: InsertItemParams, now: number) => Promise<boolean>;
  onReorderBlocks?: (fromIndex: number, toIndex: number, now: number) => Promise<boolean>;
  error?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const now = useClock();
  const [localTimer, setLocalTimer] = useState<Timer | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const captureAnchorRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setLocalTimer(null);
  }, [timer]);

  const currentTimer = localTimer ?? timer;

  const handleInsert = async (params: InsertItemParams) => {
    // 1. Anchor current visual state and marker line before modifying schedule
    captureAnchorRef.current?.();

    // 2. Insert item into local schedule immediately
    const next = insertItemIntoTimer(currentTimer, params, now);
    const addedBlock = next.blocks.find(b => !currentTimer.blocks.some(prev => prev.id === b.id));
    if (addedBlock) {
      setNewlyAddedId(addedBlock.id);
      setTimeout(() => setNewlyAddedId(null), 500);
    }
    setLocalTimer(next);

    // 3. Persist to storage in the background
    if (onInsertItem) {
      try {
        const ok = await onInsertItem(params, now);
        if (!ok) setLocalTimer(null);
      } catch {
        setLocalTimer(null);
      }
    }
  };

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    captureAnchorRef.current?.();
    const next = reorderTimerBlocks(currentTimer, fromIndex, toIndex, now);
    setLocalTimer(next);

    if (onReorderBlocks) {
      try {
        const ok = await onReorderBlocks(fromIndex, toIndex, now);
        if (!ok) setLocalTimer(null);
      } catch {
        setLocalTimer(null);
      }
    }
  };

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

  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: currentTimer.timezone,
    month: 'short',
    day: 'numeric',
  }).format(new Date(currentTimer.startedAt ?? currentTimer.blocks[0]?.start ?? now));

  return (
    <dialog ref={dialog} className="live-timer-modal" aria-label="Live timer" onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="live-timer-stage">
        <header className="live-timer-header">
          <div className="live-timer-header-titles">
            <span className="live-timer-eyebrow">TIMEBLOCK</span>
            <div className="live-timer-header-row">
              <h2>{currentTimer.name}</h2>
              <div className="live-timer-date-pill">{dateLabel}</div>
            </div>
          </div>
          {onClose && (
            <button type="button" className="live-timer-close" aria-label="Close live timer" onClick={onClose}>
              <TimerIcon name="cross" />
            </button>
          )}
        </header>

        <div className="live-timer-two-column">
          <LiveTimerPanel
            timer={currentTimer}
            now={now}
            onInsertItem={handleInsert}
          />
          <main className="live-timer-main">
            <TimerCard
              key={timer.id}
              timer={currentTimer}
              now={now}
              onClose={onClose}
              onComplete={onComplete}
              onRegisterCapture={capture => { captureAnchorRef.current = capture; }}
              onReorder={handleReorder}
              newlyAddedId={newlyAddedId}
              error={error}
              hideHeader
            />
          </main>
        </div>
      </div>
    </dialog>
  );
}

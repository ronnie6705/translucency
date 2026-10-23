import { generateScheduleResult } from '../recovery/recovery-planner';
import type { BreakPreferences, RecoveryAnchor, RecoveryOverride } from '../recovery/recovery-types';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { DayConfig, ScheduleBlock, Task } from '../types';
import { reorderSchedule } from '../reorder-schedule';
import { SCHEDULE_MOTION_MS, SCHEDULE_SPRING } from '../schedule-motion';
import { timerBlockHeight } from '../live-timer';
import { TimerBlock } from './LiveTimer';
import { TaskSpaceBadge } from './TimeblockWorkload';
import type { CatalogSpace } from './PlanTaskCatalog';
import { useLayoutMotion } from './use-layout-motion';

const noop = () => {};
type Drag = { id: string; pointer: number; y: number; originY: number; grab: number; active: boolean; blocks: ScheduleBlock[]; base?: ScheduleBlock[]; node: HTMLDivElement; invalid: boolean };
export function ScheduleBlocks({ preferences, onOverride, blocks, tasks, config, spaces, editing, onChange, onMessage }: {
  preferences: BreakPreferences; onOverride(anchor: RecoveryAnchor, override?: Omit<RecoveryOverride,'anchor'>): void;
  blocks: ScheduleBlock[]; tasks: Task[]; config: DayConfig; spaces: CatalogSpace[]; editing: boolean;
  onChange(blocks: ScheduleBlock[]): void; onMessage(message: string): void;
}) {
  const [draft, setDraft] = useState<ScheduleBlock[] | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const shown = draft ?? blocks;
  const list = useLayoutMotion(shown.map(b => `${b.id}:${b.start}`).join(','), SCHEDULE_MOTION_MS, SCHEDULE_SPRING, true);
  const fixed = (block: ScheduleBlock) => !!block.recovery || tasks.some(t => t.id === block.taskId && t.fixedStart);
  const reorder = (current: ScheduleBlock[], from: number, to: number): {blocks: ScheduleBlock[];base: ScheduleBlock[];error?: string;unchanged?: boolean} => {
    const base = current.filter(b => !b.recovery);
    const moved = current[from];
    if (!moved || moved.recovery) return {blocks:current,base,error:'Recovery breaks follow your tasks.'};
    const order = [...current]; order.splice(from,1); order.splice(to,0,moved);
    const target = order.filter(b => !b.recovery).findIndex(b => b.id === moved.id);
    const source = base.findIndex(b => b.id===moved.id);
    if (source===target) return {blocks:current,base,unchanged:true};
    const ordered = reorderSchedule(base,tasks,config,source,target);
    if (ordered.error) return {...ordered,base};
    const paced = generateScheduleResult(tasks,config,{preferences,baseSchedule:ordered.blocks});
    return {blocks:paced.blocks,base:ordered.blocks,error:paced.status==='invalid' ? paced.errors.join(' ') : undefined};
  };
  const position = () => {
    const d = drag.current;
    if (!d?.active) return;
    if (!d.node.hasPointerCapture(d.pointer)) d.node.setPointerCapture(d.pointer);
    // Translate is independent of the FLIP transform, and the same DOM card follows the pointer.
    d.node.style.translate = 'none';
    const top = d.node.getBoundingClientRect().top;
    d.node.style.translate = `0 ${d.y - d.grab - top}px`;
  };
  useLayoutEffect(position, [draft, dragging]);
  const start = (e: PointerEvent<HTMLDivElement>, block: ScheduleBlock) => {
    if (fixed(block) || e.button !== 0 || (e.target as HTMLElement).closest('button, input, select, a')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: block.id, pointer: e.pointerId, y: e.clientY, originY: e.clientY, grab: e.clientY - e.currentTarget.getBoundingClientRect().top, active: false, blocks, node: e.currentTarget, invalid: false };
  };
  const movePointer = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    d.y = e.clientY;
    if (!d.active && Math.abs(d.y - d.originY) < 5) return;
    e.preventDefault();
    d.active = true;
    d.node.dataset.motionDragging = 'true';
    setDragging(d.id);
    position();
    const container = list.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    if (d.y < bounds.top + 36) container.scrollTop -= 14;
    if (d.y > bounds.bottom - 36) container.scrollTop += 14;
    const rows = [...container.querySelectorAll<HTMLElement>('.tb-schedule-slot[data-motion-id]')];
    const from = d.blocks.findIndex(b => b.id === d.id);
    const others = rows.filter(row => row.dataset.motionId !== d.id);
    // Untransformed layout positions avoid targets chasing the spring animation.
    const to = others.filter(row => d.y > bounds.top + row.offsetTop - container.scrollTop + row.offsetHeight / 2).length;
    if (from === to) { d.invalid = false; return; }
    const result = reorder(d.blocks, from, to);
    d.invalid = !!result.error;
    if (result.unchanged) return;
    if (result.error) { onMessage(result.error); return; }
    d.blocks = result.blocks;
    d.base = result.base;
    setDraft(result.blocks);
    onMessage('');
  };
  const finish = (cancel = false) => {
    const d = drag.current;
    if (!d) return;
    const translate = d.node.style.translate;
    delete d.node.dataset.motionDragging;
    d.node.style.translate = 'none';
    if (d.active && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d.node.animate([{ translate }, { translate: '0 0' }], { duration: SCHEDULE_MOTION_MS, easing: SCHEDULE_SPRING });
    }
    if (d.active && !cancel && !d.invalid && d.base) { onChange(d.base); onMessage('Schedule order updated.'); }
    else if (cancel) onMessage('Reordering cancelled.');
    drag.current = null;
    setDragging(null);
    setDraft(null);
  };
  useEffect(() => {
    if (!dragging) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(true); }
    };
    document.addEventListener('keydown', cancel, true);
    return () => document.removeEventListener('keydown', cancel, true);
  }, [dragging]);
  const move = (from: number, to: number) => {
    const direction = to > from ? 1 : -1;
    while (blocks[to]?.recovery) to += direction;
    if (to < 0 || to >= blocks.length) return;
    const result = reorder(blocks, from, to);
    if (!result.error && !result.unchanged) onChange(result.base);
    onMessage(result.error ?? 'Schedule order updated.');
  };
  return <div className="tb-schedule-blocks" ref={list} style={{ '--schedule-motion': `${SCHEDULE_MOTION_MS}ms`, '--schedule-spring': SCHEDULE_SPRING } as CSSProperties}>
    {shown.map((block, index) => <div key={block.id} data-motion-id={block.id}
      className={`tb-schedule-slot${block.recovery ? ' is-recovery' : ''}${fixed(block) ? ' is-fixed' : ' can-reorder'}${dragging === block.id ? ' schedule-dragging' : ''}`}
      onDragStart={e => e.preventDefault()} onPointerDown={e => start(e, block)} onPointerMove={movePointer} onPointerUp={() => finish()} onPointerCancel={() => finish(true)}
      onKeyDown={e => { if (e.key === 'Escape' && drag.current) { e.preventDefault(); e.stopPropagation(); finish(true); } }}>
      <TimerBlock block={block} metadata={<TaskSpaceBadge id={block.taskId} spaces={spaces} />} state="preview" timezone={config.timezone} height={timerBlockHeight(block, 'preview')} onRetain={noop} onReflow={noop} scheduleDraggable={!fixed(block)} />
      {block.recovery && <div className="tb-recovery-controls"><label>Duration <select aria-label={`Recovery duration after ${tasks.find(t => t.id===block.recovery!.anchor.taskId)?.name ?? 'task'}`} value={(Date.parse(block.end)-Date.parse(block.start))/60000} onChange={e => onOverride(block.recovery!.anchor,{durationMinutes:Number(e.target.value)})}>{[...new Set([1,5,10,15,20,30,45,60,90,120,(Date.parse(block.end)-Date.parse(block.start))/60000])].sort((a,b)=>a-b).map(minutes => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></label><button type="button" className="tb-small" onClick={() => onOverride(block.recovery!.anchor,{removed:true})}>Remove break</button>{block.recovery.source==='manual-override' && <button type="button" className="tb-small" onClick={() => onOverride(block.recovery!.anchor)}>Restore automatic</button>}</div>}
      {editing && !block.recovery && <div className="tb-reorder"><button type="button" disabled={index === 0 || fixed(block)} aria-label={`Move ${block.taskName} up`} onClick={() => move(index,index-1)}>↑</button><button type="button" disabled={index === shown.length - 1 || fixed(block)} aria-label={`Move ${block.taskName} down`} onClick={() => move(index,index+1)}>↓</button></div>}
    </div>)}
    {!shown.length && <p className="tb-empty">No tasks fit this time window. Go back to review your workload.</p>}
  </div>;
}

import type { ScheduleBlock } from './types';
export const blockMinutes = (block: ScheduleBlock) => (Date.parse(block.end) - Date.parse(block.start)) / 60000;
/** Shared slicing primitive for capacity splitting and recovery boundaries. */
export function sliceScheduleBlock(block: ScheduleBlock, offsetMinutes: number, durationMinutes: number, id = block.id): ScheduleBlock {
  const start = Date.parse(block.start) + offsetMinutes * 60000;
  return { ...block, id, start: new Date(start).toISOString(), end: new Date(start + durationMinutes * 60000).toISOString() };
}
/** Ordered placement used by drag/recovery; fixed commitments are never moved. */
export function placeOrderedBlocks(blocks: ScheduleBlock[], start: number, end: number, preserveGaps = false, splitAroundFixed = false): { blocks: ScheduleBlock[]; error?: string } {
  if (splitAroundFixed) {
    // Planning may redistribute work around fixed commitments, using the same slicing primitive.
    // Fixed cards retain their clock times; flexible work retains its relative order and full estimate.
    const fixed = blocks.filter(b=>b.isFixed).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
    const queue: ScheduleBlock[] = [];
    const emitted = new Set<string>();
    let cursor = start;
    const emitFixed = (block:ScheduleBlock) => { queue.push(block); emitted.add(block.id); cursor=Date.parse(block.end); };
    for (const block of blocks) {
      if (block.isFixed) { if(!emitted.has(block.id)) emitFixed(block); continue; }
      let remaining = blockMinutes(block), offset = 0;
      while (remaining > 0) {
        const commitment = fixed.find(b=>!emitted.has(b.id));
        const gap = commitment ? (Date.parse(commitment.start)-cursor)/60000 : Infinity;
        if (commitment && (gap<=0 || block.isBreak && gap<remaining)) { emitFixed(commitment); continue; }
        const duration = Math.min(remaining,gap);
        const piece = sliceScheduleBlock(block,offset,duration,offset ? `${block.id}-placement-${offset}` : block.id);
        queue.push({...piece,start:new Date(cursor).toISOString(),end:new Date(cursor+duration*60000).toISOString(),workOffsetMinutes:(block.workOffsetMinutes ?? 0)+offset});
        cursor+=duration*60000; remaining-=duration; offset+=duration;
        if (remaining>0 && commitment) emitFixed(commitment);
      }
    }
    return placeOrderedBlocks(queue,start,end);
  }
  let cursor = start;
  const next: ScheduleBlock[] = [];
  for (const block of blocks) {
    const duration = blockMinutes(block) * 60000;
    const at = block.isFixed ? Date.parse(block.start) : preserveGaps && !block.recovery ? Math.max(cursor, Date.parse(block.start)) : cursor;
    if (!(duration > 0) || !Number.isFinite(at) || at < cursor || at + duration > end) return { blocks, error: 'This order cannot fit around your fixed times and time window. Adjust the workload, protected breaks, or time range.' };
    next.push({ ...block, start: new Date(at).toISOString(), end: new Date(at + duration).toISOString() });
    cursor = at + duration;
  }
  return { blocks: next };
}

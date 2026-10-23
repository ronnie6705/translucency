import type { ScheduleBlock } from './types';
export const blockMinutes = (block: ScheduleBlock) => (Date.parse(block.end) - Date.parse(block.start)) / 60000;
/** Shared slicing primitive for capacity splitting and recovery boundaries. */
export function sliceScheduleBlock(block: ScheduleBlock, offsetMinutes: number, durationMinutes: number, id = block.id): ScheduleBlock {
  const start = Date.parse(block.start) + offsetMinutes * 60000;
  return { ...block, id, start: new Date(start).toISOString(), end: new Date(start + durationMinutes * 60000).toISOString() };
}
/** Ordered placement used by drag/recovery; fixed commitments are never moved. */
export function placeOrderedBlocks(blocks: ScheduleBlock[], start: number, end: number, preserveGaps = false): { blocks: ScheduleBlock[]; error?: string } {
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

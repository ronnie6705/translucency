import type { ScheduleBlock } from './types';

export interface LiveTimer {
  id: string;
  name: string;
  timezone: string;
  blocks: ScheduleBlock[];
}

export function timerPosition(blocks: ScheduleBlock[], now: number) {
  const activeIndex = blocks.findIndex(block => Date.parse(block.start) <= now && now < Date.parse(block.end));
  const nextIndex = blocks.findIndex(block => Date.parse(block.start) > now);
  const phase = activeIndex >= 0 ? 'running' : nextIndex === 0 ? 'scheduled' : nextIndex > 0 ? 'gap' : 'complete';
  const active = blocks[activeIndex];
  const progress = active ? Math.max(0, Math.min(1, (now - Date.parse(active.start)) / (Date.parse(active.end) - Date.parse(active.start)))) : 0;
  return { activeIndex, nextIndex, phase, progress };
}

export function timerBlockHeight(block: ScheduleBlock) {
  const minutes = (Date.parse(block.end) - Date.parse(block.start)) / 60000;
  return block.isBreak ? 64 : Math.max(82, Math.min(240, 66 + minutes * 0.75));
}

export function validLiveTimer(value: unknown): value is LiveTimer {
  if (!value || typeof value !== 'object') return false;
  const timer = value as LiveTimer;
  if (typeof timer.id !== 'string' || typeof timer.name !== 'string' || typeof timer.timezone !== 'string' || !Array.isArray(timer.blocks) || !timer.blocks.length) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: timer.timezone }).format(); } catch { return false; }
  return timer.blocks.every((b, i) => b && typeof b.id === 'string' && typeof b.taskId === 'string' && typeof b.taskName === 'string' && typeof b.isBreak === 'boolean' && Number.isFinite(b.energyRequired) && Number.isFinite(Date.parse(b.start)) && Date.parse(b.end) > Date.parse(b.start) && (i === 0 || Date.parse(b.start) >= Date.parse(timer.blocks[i - 1].end)));
}

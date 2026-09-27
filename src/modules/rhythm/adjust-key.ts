import type { KeyboardEvent } from 'react';
import type { Task } from './types';

/** Shared by the task builder and the Workload step. Inputs keep their native keys. */
export function handleAdjustKey(event: KeyboardEvent<HTMLElement>, tasks: Task[], selectedIndex: number,
  select: (index: number) => void, update: (id: string, updates: Partial<Task>) => void,
  onEnergyChange?: (id: string) => void) {
  if ((event.target as HTMLElement).closest('input, select, textarea, [contenteditable="true"], [role="slider"]')) return;
  if (!tasks.length || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const index = Math.max(0, Math.min(tasks.length - 1, selectedIndex));
  if (event.key === 'ArrowUp') return select(Math.max(0, index - 1));
  if (event.key === 'ArrowDown') return select(Math.min(tasks.length - 1, index + 1));
  const task = tasks[index];
  if (task.isBreak) return;
  const energy = Math.min(5, Math.max(1, task.energyRequired + (event.key === 'ArrowRight' ? 1 : -1))) as Task['energyRequired'];
  if (energy !== task.energyRequired) {
    update(task.id, { energyRequired: energy });
    onEnergyChange?.(task.id);
  }
}

import type { Task } from './types';

export const ENERGY_DURATIONS = { 1: 15, 2: 30, 3: 45, 4: 60, 5: 90 } as const;
export const DEFAULT_TASK_ESTIMATE = { durationMinutes: 45, energyRequired: 3, durationMode: 'automatic' } as const;

/** One policy for mouse, keyboard, and saved-task edits. Energy edits suggest a duration; explicit time edits take precedence. */
export function updateTaskEstimate<T extends Pick<Task, 'durationMinutes' | 'energyRequired' | 'durationMode'> & Partial<Task>>(task: T, patch: Partial<Task>): T {
  const next = { ...task, ...patch };
  if (patch.durationMinutes !== undefined && patch.durationMode !== 'automatic') next.durationMode = 'custom';
  if (next.fixedStart || next.isBreak) {
    if (patch.durationMode === 'automatic') next.durationMode = task.durationMode;
    return next;
  }
  if (patch.durationMinutes === undefined && (patch.energyRequired !== undefined || patch.durationMode === 'automatic')) {
    next.durationMode = 'automatic';
    next.durationMinutes = ENERGY_DURATIONS[next.energyRequired];
  }
  return next;
}

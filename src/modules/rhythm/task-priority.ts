import type { Task } from './types';

export const PRIORITIES = {
  1: { label: 'High', color: '#FF6578' },
  2: { label: 'Medium', color: '#E8AD58' },
  3: { label: 'Low', color: '#8D8D9F' },
  4: { label: 'Unset', color: '#ffffff66' },
} as const;

export function stepPriority(priority: Task['priority'], direction: 'increase' | 'decrease'): Task['priority'] {
  return Math.max(1, Math.min(4, priority + (direction === 'increase' ? -1 : 1))) as Task['priority'];
}

export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.priority - b.priority);
}

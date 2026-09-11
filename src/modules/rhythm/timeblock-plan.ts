import type { Task } from './types';

export const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return {
    value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    label: `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`,
  };
});

const toMinutes = (time: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export function validateTimeblockPlan(tasks: Task[], startTime: string, endTime: string) {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const validRange = Number.isFinite(start) && Number.isFinite(end) && end > start && start % 15 === 0 && end % 15 === 0;
  const errors: Record<string, string> = {};
  for (const task of tasks) {
    if (!task.name.trim()) errors[task.id] = 'Enter a name.';
    else if (!Number.isFinite(task.durationMinutes) || task.durationMinutes <= 0) errors[task.id] = 'Choose a duration.';
    else if (!task.isBreak && ![1, 2, 3, 4, 5].includes(task.energyRequired)) errors[task.id] = 'Choose an energy rating.';
    else if (task.fixedStart) {
      const fixed = toMinutes(task.fixedStart);
      if (!Number.isFinite(fixed)) errors[task.id] = 'Choose a valid fixed time.';
      else if (validRange && (fixed < start || fixed + task.durationMinutes > end)) errors[task.id] = 'Fixed time and duration must fit within your time range.';
    }
  }
  const fixedTasks = tasks.filter(task => task.fixedStart).sort((a, b) => a.fixedStart!.localeCompare(b.fixedStart!));
  for (let i = 0; i < fixedTasks.length; i++) {
    for (let j = i + 1; j < fixedTasks.length; j++) {
      if (toMinutes(fixedTasks[i].fixedStart!) + fixedTasks[i].durationMinutes > toMinutes(fixedTasks[j].fixedStart!)) {
        errors[fixedTasks[i].id] = errors[fixedTasks[j].id] = 'Fixed times overlap. Adjust the time or duration.';
      }
    }
  }
  return { errors, validRange, valid: tasks.some(task => !task.isBreak) && validRange && Object.keys(errors).length === 0 };
}

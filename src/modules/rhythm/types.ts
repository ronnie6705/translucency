// src/types.ts

export type Chronotype = 'Lion' | 'Bear' | 'Wolf' | 'Dolphin';

export interface Task {
  id: string;
  name: string;
  durationMinutes: number;
  energyRequired: 1 | 2 | 3 | 4 | 5;
  priority: 1 | 2 | 3; // 1 = high, 3 = low
  isBreak?: boolean;
  fixedStart?: string; // "HH:MM" in 24h
}

export interface DayConfig {
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  chronotype: Chronotype;
  timezone: string;
}

export interface ScheduleBlock {
  id: string;
  taskId: string;
  taskName: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  isBreak: boolean;
  energyRequired: number;
}

export interface SavedTimeblock {
  id: string;
  name: string;
  createdAt: string;
  dayConfig: DayConfig;
  tasks: Task[];
}

export interface SavedTaskList {
  id: string;
  name: string;
  createdAt: string;
  tasks: Task[];
}

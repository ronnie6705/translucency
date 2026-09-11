import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Chronotype, Task } from '../types';
import { TIME_OPTIONS, validateTimeblockPlan } from '../timeblock-plan';
import { TIME_ZONE_OPTIONS } from '../utils/timezone';
import { TaskDetailFields } from './TaskDetailFields';
import { fixedTimeDuration } from '../task-spaces';
import { TimeRangeSelector } from './TimeRangeSelector';

interface TaskBuilderStepProps {
  tasks: Task[];
  chronotype: Chronotype;
  date: string;
  onAdd(task: Task): void;
  onUpdate(taskId: string, updates: Partial<Task>): void;
  onRemove(taskId: string): void;
  onReorder(nextOrder: Task[]): void;
  timeZone: string;
  onTimeZoneChange(timeZone: string): void;
  onExport(): void;
  onStartLiveTimer?(exportCalendar?: boolean): void;
  startingTimer?: boolean;
  onDone(): void;
  onPlanNext?(): void;
  onScheduleBack?(): void;
  startTime: string;
  endTime: string;
  onRangeChange(startTime: string, endTime: string): void;
  onThemeChange?(theme: 'light' | 'dark'): void;
  onStageChange?(
    stage: 'tasks' | 'adjust' | 'range-select' | 'range-blocks' | 'range-export'
  ): void;
  onSaveTimeblock?(): void;
  onSaveTaskList?(): void;
  onStartTimeblock?(): void;
  mode?: 'timeblock' | 'task-list';
  initialStep?: 'tasks' | 'adjust' | 'range';
}

const TimeIcon = ({ active = false }: { active?: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={active ? 'icon active' : 'icon'}
    aria-hidden="true"
  >
    <g clipPath="url(#estimated-time-icon-clip)">
      <path
        opacity="0.32"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 2.16699C4.41015 2.16699 1.5 5.07714 1.5 8.66699C1.5 12.2568 4.41015 15.167 8 15.167C11.5899 15.167 14.5 12.2568 14.5 8.66699C14.5 7.05224 13.9107 5.57436 12.9362 4.4379L14.0202 3.35388C14.2155 3.15862 14.2155 2.84203 14.0202 2.64677C13.825 2.45151 13.5084 2.45151 13.3131 2.64677L12.2291 3.73079C11.0926 2.75634 9.61476 2.16699 8 2.16699Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.99707 5.91699C8.41113 5.91717 8.74707 6.25289 8.74707 6.66699V9.33398C8.74672 9.74779 8.41092 10.0838 7.99707 10.084C7.58322 10.0838 7.24742 9.74779 7.24707 9.33398V6.66699C7.24707 6.25289 7.58301 5.91717 7.99707 5.91699ZM9.33105 -0.0830078C9.74497 -0.0826561 10.0811 0.252996 10.0811 0.666992C10.0809 1.08084 9.74486 1.41664 9.33105 1.41699H6.66406C6.24996 1.41699 5.91424 1.08106 5.91406 0.666992C5.91406 0.252779 6.24985 -0.0830078 6.66406 -0.0830078H9.33105Z"
        fill="currentColor"
      />
    </g>
    <defs>
      <clipPath id="estimated-time-icon-clip">
        <rect width="16" height="16" fill="currentColor" />
      </clipPath>
    </defs>
  </svg>
);

const EnergyIcon = ({ active = false }: { active?: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={active ? 'icon active' : 'icon'}
    aria-hidden="true"
  >
    <path
      opacity="0.32"
      d="M6.16388 10.9001V12.0105C6.16388 13.8757 6.16388 14.8083 6.51263 15.1903C6.81451 15.5208 7.26213 15.6779 7.70437 15.6083C8.21528 15.5279 8.79787 14.7997 9.96307 13.3432L12.9314 9.63282C13.819 8.52326 14.2628 7.96848 14.2634 7.50158C14.2638 7.09552 14.0792 6.7114 13.7618 6.45808C13.3969 6.16681 12.6865 6.16681 11.2655 6.16681H10.8972C10.5238 6.16681 10.3372 6.16681 10.1945 6.09414C10.1319 6.06221 10.0751 6.02079 10.0259 5.97168L5.96875 10.0289C6.01786 10.078 6.05929 10.1348 6.09121 10.1975C6.16388 10.3401 6.16388 10.5268 6.16388 10.9001V10.9001Z"
      fill="currentColor"
    />
    <path
      d="M9.83385 5.09937V3.98898C9.83385 2.12377 9.83385 1.19116 9.4851 0.809248C9.18322 0.478675 8.7356 0.321657 8.29336 0.391211C7.78245 0.471566 7.19986 1.19981 6.03466 2.6563L3.06636 6.36668C2.1787 7.47625 1.73488 8.03103 1.73438 8.49793C1.73394 8.90398 1.91856 9.28811 2.23591 9.54142C2.60081 9.8327 3.31128 9.8327 4.73221 9.8327H5.10052C5.47389 9.8327 5.66057 9.8327 5.80318 9.90536C5.86596 9.93735 5.92286 9.97887 5.97206 10.0281L10.0293 5.97091C9.98003 5.92171 9.9385 5.86481 9.90652 5.80203C9.83385 5.65942 9.83385 5.47274 9.83385 5.09937Z"
      fill="currentColor"
    />
  </svg>
);

const EnterIcon = () => (
  <svg
    width="19"
    height="21"
    viewBox="0 0 19 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M0.0390625 12.44V19.24C0.0390625 19.7702 0.46887 20.2 0.999063 20.2H17.0391C17.5693 20.2 17.9991 19.7702 17.9991 19.24V0.999978C17.9991 0.469785 17.5693 0.039978 17.0391 0.039978H7.67906C7.14887 0.039978 6.71906 0.469784 6.71906 0.999978V10.52C6.71906 11.0502 6.28926 11.48 5.75906 11.48H0.999063C0.468869 11.48 0.0390625 11.9098 0.0390625 12.44Z"
      fill="url(#enterGradient)"
      stroke="white"
      strokeWidth="0.08"
    />
    <path
      d="M8.99609 16.44L10.3961 17.2483V15.6317L8.99609 16.44ZM14.8361 14.72H14.6961V16.12H14.8361H14.9761V14.72H14.8361ZM14.5161 16.44V16.3H10.2561V16.44V16.58H14.5161V16.44ZM14.8361 16.12H14.6961C14.6961 16.2194 14.6155 16.3 14.5161 16.3V16.44V16.58C14.7701 16.58 14.9761 16.374 14.9761 16.12H14.8361Z"
      fill="#3E45DF"
    />
    <defs>
      <linearGradient
        id="enterGradient"
        x1="9.01906"
        y1="0.039978"
        x2="9.01906"
        y2="20.2"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="white" />
        <stop offset="1" stopColor="#D4D4F0" />
      </linearGradient>
    </defs>
  </svg>
);

const ListIcon = () => (
  <svg
    width="29"
    height="29"
    viewBox="0 0 29 29"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M18.8015 23.4996H12.9265M25.8515 23.4996H23.5015M19.9765 14.0996H25.8515H12.9265H15.2765M18.8015 4.69959H12.9265M25.8515 4.69959H23.5015M4.70157 11.7496H4.23157C3.57351 11.7496 3.24447 11.7496 2.99313 11.8777C2.77204 11.9903 2.59229 12.1701 2.47963 12.3912C2.35157 12.6425 2.35157 12.9715 2.35157 13.6296V14.5696C2.35157 15.2277 2.35157 15.5567 2.47963 15.808C2.59229 16.0291 2.77204 16.2089 2.99313 16.3215C3.24447 16.4496 3.57351 16.4496 4.23157 16.4496H5.17157C5.82963 16.4496 6.15866 16.4496 6.41001 16.3215C6.6311 16.2089 6.81085 16.0291 6.9235 15.808C7.05157 15.5567 7.05157 15.2277 7.05157 14.5696V14.0996M5.17157 21.1496H4.23157C3.57351 21.1496 3.24447 21.1496 2.99313 21.2777C2.77204 21.3903 2.59229 21.5701 2.47963 21.7912C2.35157 22.0425 2.35157 22.3715 2.35157 23.0296V23.9696C2.35157 24.6277 2.35157 24.9567 2.47963 25.208C2.59229 25.4291 2.77204 25.6089 2.99313 25.7215C3.24447 25.8496 3.57351 25.8496 4.23157 25.8496H5.17157C5.82963 25.8496 6.15866 25.8496 6.41001 25.7215C6.6311 25.6089 6.81085 25.4291 6.9235 25.208C7.05157 24.9567 7.05157 24.6277 7.05157 23.9696V23.0296C7.05157 22.3715 7.05157 22.0425 6.9235 21.7912C6.81085 21.5701 6.6311 21.3903 6.41001 21.2777C6.15866 21.1496 5.82963 21.1496 5.17157 21.1496ZM4.23157 7.04961H5.17157C5.82963 7.04961 6.15866 7.04961 6.41001 6.92154C6.6311 6.80889 6.81085 6.62914 6.9235 6.40805C7.05157 6.1567 7.05157 5.82767 7.05157 5.16961V4.22961C7.05157 3.57155 7.05157 3.24252 6.9235 2.99117C6.81085 2.77008 6.6311 2.59033 6.41001 2.47768C6.15866 2.34961 5.82963 2.34961 5.17157 2.34961H4.23157C3.57351 2.34961 3.24447 2.34961 2.99313 2.47768C2.77204 2.59033 2.59229 2.77008 2.47963 2.99117C2.35157 3.24252 2.35157 3.57155 2.35157 4.22961V5.16961C2.35157 5.82767 2.35157 6.1567 2.47963 6.40805C2.59229 6.62914 2.77204 6.80889 2.99313 6.92154C3.24447 7.04961 3.57351 7.04961 4.23157 7.04961Z"
      stroke="currentColor"
      strokeWidth="1.7625"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const GridIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      opacity="0.32"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.85 15.75C2.28995 15.75 2.00992 15.75 1.79601 15.641C1.60785 15.5451 1.45487 15.3922 1.35899 15.204C1.25 14.9901 1.25 14.7101 1.25 14.15V12.35C1.25 11.7899 1.25 11.5099 1.35899 11.296C1.45487 11.1078 1.60785 10.9549 1.79601 10.859C2.00992 10.75 2.28995 10.75 2.85 10.75H9.65C10.2101 10.75 10.4901 10.75 10.704 10.859C10.8922 10.9549 11.0451 11.1078 11.141 11.296C11.25 11.5099 11.25 11.7899 11.25 12.35V14.15C11.25 14.7101 11.25 14.9901 11.141 15.204C11.0451 15.3922 10.8922 15.5451 10.704 15.641C10.4901 15.75 10.2101 15.75 9.65 15.75H2.85ZM2.16667 17.25C1.66041 17.25 1.25 17.6604 1.25 18.1667C1.25 20.698 3.30203 22.75 5.83333 22.75H9.65C10.2101 22.75 10.4901 22.75 10.704 22.641C10.8922 22.5451 11.0451 22.3922 11.141 22.204C11.25 21.9901 11.25 21.7101 11.25 21.15V18.85C11.25 18.2899 11.25 18.0099 11.141 17.796C11.0451 17.6078 10.8922 17.4549 10.704 17.359C10.4901 17.25 10.2101 17.25 9.65 17.25H2.16667ZM14.35 17.25C13.7899 17.25 13.5099 17.25 13.296 17.359C13.1078 17.4549 12.9549 17.6078 12.859 17.796C12.75 18.0099 12.75 18.2899 12.75 18.85V21.15C12.75 21.7101 12.75 21.9901 12.859 22.204C12.9549 22.3922 13.1078 22.5451 13.296 22.641C13.5099 22.75 13.7899 22.75 14.35 22.75H18.1667C20.698 22.75 22.75 20.698 22.75 18.1667C22.75 17.6604 22.3396 17.25 21.8333 17.25H14.35ZM21.15 15.75C21.7101 15.75 21.9901 15.75 22.204 15.641C22.3922 15.5451 22.5451 15.3922 22.641 15.204C22.75 14.9901 22.75 14.7101 22.75 14.15V12.35C22.75 11.7899 22.75 11.5099 22.641 11.296C22.5451 11.1078 22.3922 10.9549 22.204 10.859C21.9901 10.75 21.7101 10.75 21.15 10.75H14.35C13.7899 10.75 13.5099 10.75 13.296 10.859C13.1078 10.9549 12.9549 11.1078 12.859 11.296C12.75 11.5099 12.75 11.7899 12.75 12.35V14.15C12.75 14.7101 12.75 14.9901 12.859 15.204C12.9549 15.3922 13.1078 15.5451 13.296 15.641C13.5099 15.75 13.7899 15.75 14.35 15.75H21.15Z"
      fill="currentColor"
    />
    <path
      d="M2.58333 9.25H12H21.4167C21.7267 9.25 21.8817 9.25 22.0088 9.21593C22.3539 9.12346 22.6235 8.85391 22.7159 8.50882C22.75 8.38165 22.75 8.22666 22.75 7.91667C22.75 6.36671 22.75 5.59174 22.5796 4.9559C22.1173 3.23044 20.7696 1.88271 19.0441 1.42037C18.4083 1.25 17.6333 1.25 16.0833 1.25H7.91667C6.36671 1.25 5.59174 1.25 4.9559 1.42037C3.23044 1.88271 1.88271 3.23044 1.42037 4.9559C1.25 5.59174 1.25 6.36671 1.25 7.91667C1.25 8.22666 1.25 8.38165 1.28407 8.50882C1.37654 8.85391 1.64609 9.12346 1.99118 9.21593C2.11835 9.25 2.27334 9.25 2.58333 9.25Z"
      fill="currentColor"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="29"
    height="29"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M6 6L18 18M18 6L6 18"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M3 6H21"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M8 6V4H16V6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.5 6L17.5 20H6.5L5.5 6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 11V16M14 11V16"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const ADJUST_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => (i + 1) * 15);

export const TaskBuilderStep: React.FC<TaskBuilderStepProps> = ({
  tasks,
  chronotype,
  date,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  timeZone,
  onTimeZoneChange,
  onExport,
  onStartLiveTimer,
  startingTimer,
  onDone,
  onPlanNext,
  onScheduleBack,
  startTime,
  endTime,
  onRangeChange,
  onThemeChange,
  onStageChange,
  onSaveTimeblock,
  onSaveTaskList,
  onStartTimeblock,
  mode = 'timeblock',
  initialStep = 'tasks',
}) => {
  const [taskName, setTaskName] = useState('');
  const [energy, setEnergy] = useState(3);
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(30);
  const [isBreak, setIsBreak] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [fixedStart, setFixedStart] = useState('');
  const [fixedEnd, setFixedEnd] = useState('');
  const [fixedTimeError, setFixedTimeError] = useState('');
  const [isTaskInputFocused, setTaskInputFocused] = useState(false);
  const [quickEditMode, setQuickEditMode] = useState<'none' | 'time' | 'energy'>('none');
  const [savedQuickEdit, setSavedQuickEdit] = useState<{
    taskId: string;
    mode: 'time' | 'energy';
  } | null>(null);
  const savedQuickRef = useRef<HTMLDivElement | null>(null);
  const [removeMode, setRemoveMode] = useState(false);
  const [currentStep, setCurrentStep] = useState<'tasks' | 'adjust' | 'range'>(initialStep);
  const [selectedAdjustIndex, setSelectedAdjustIndex] = useState(0);
  const [energyPulse, setEnergyPulse] = useState<{ id: string; key: number } | null>(null);
  const timeQuickRef = useRef<HTMLDivElement | null>(null);
  const energyQuickRef = useRef<HTMLDivElement | null>(null);
  const adjustListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onThemeChange?.(currentStep === 'tasks' ? 'light' : 'dark');
  }, [currentStep, onThemeChange]);

  useEffect(() => {
    if (!onStageChange) return;
    if (currentStep === 'range') {
      onStageChange('range-select');
    } else {
      onStageChange(currentStep);
    }
  }, [currentStep, onStageChange]);

  const hasName = taskName.trim().length > 0;
  const durationMinutes = hours * 60 + minutes;
  const canSave = hasName && durationMinutes > 0 && energy >= 1 && !fixedTimeError;
  const isTaskListMode = mode === 'task-list';

  useEffect(() => {
    setCurrentStep(initialStep);
  }, [initialStep]);

  const formattedTasks = useMemo(() => {
    let taskNumber = 0;
    let breakNumber = 0;
    return tasks.map(task => {
      const label = task.isBreak ? `Break ${++breakNumber}` : `Task ${++taskNumber}`;
      return {
        id: task.id,
        label,
        task,
      };
    });
  }, [tasks]);

  const { orderedAdjustItems, taskCount, breakCount, taskItems, breakItems } = useMemo(() => {
    const taskItems = formattedTasks.filter(item => !item.task.isBreak);
    const breakItems = formattedTasks.filter(item => item.task.isBreak);
    return {
      orderedAdjustItems: [...taskItems, ...breakItems],
      taskCount: taskItems.length,
      breakCount: breakItems.length,
      taskItems,
      breakItems,
    };
  }, [formattedTasks]);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSave) return;

    const newTask: Task = {
      id: crypto.randomUUID(),
      name: taskName.trim(),
      durationMinutes: durationMinutes,
      energyRequired: Math.min(5, Math.max(1, energy)) as 1 | 2 | 3 | 4 | 5,
      priority: 2,
      isBreak,
      fixedStart: fixedStart || undefined,
    };

    onAdd(newTask);
    setTaskName('');
    setEnergy(3);
    setHours(1);
    setMinutes(30);
    setIsBreak(false);
    setFixedStart('');
    setFixedEnd('');
    setFixedTimeError('');
    setDetailsOpen(false);
  };

  const toggleDetails = () => {
    if (!hasName) return;
    setDetailsOpen(prev => !prev);
  };

  useEffect(() => {
    if (!hasName) {
      setDetailsOpen(false);
    }
  }, [hasName]);

  useEffect(() => {
    if (!hasName) {
      setQuickEditMode('none');
    }
  }, [hasName]);

  useEffect(() => {
    if (!savedQuickEdit) return;
    const handler = (event: MouseEvent | TouchEvent | FocusEvent) => {
      const target = event.target as Node | null;
      if (savedQuickRef.current && target && savedQuickRef.current.contains(target)) {
        return;
      }
      setSavedQuickEdit(null);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    document.addEventListener('focusin', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('focusin', handler);
    };
  }, [savedQuickEdit]);

  useEffect(() => {
    if (quickEditMode === 'none') return;

    let skipNextEvent = true;

    const handleGlobalInteraction = (event: MouseEvent | TouchEvent | FocusEvent) => {
      if (skipNextEvent) {
        skipNextEvent = false;
        return;
      }

      const target = event.target as Node | null;
      const activeRef =
        quickEditMode === 'time' ? timeQuickRef.current : energyQuickRef.current;
      if (!activeRef) return;
      if (target && activeRef.contains(target)) {
        return;
      }
      setQuickEditMode('none');
    };

    document.addEventListener('mousedown', handleGlobalInteraction);
    document.addEventListener('touchstart', handleGlobalInteraction);
    document.addEventListener('focusin', handleGlobalInteraction);

    return () => {
      document.removeEventListener('mousedown', handleGlobalInteraction);
      document.removeEventListener('touchstart', handleGlobalInteraction);
      document.removeEventListener('focusin', handleGlobalInteraction);
    };
  }, [quickEditMode]);

  const toggleSavedQuickEdit = (taskId: string, mode: 'time' | 'energy') => {
    setSavedQuickEdit(prev =>
      prev && prev.taskId === taskId && prev.mode === mode ? null : { taskId, mode }
    );
  };

  const handleSavedEnergyChange = (taskId: string, value: number) => {
    const parsed = Math.min(5, Math.max(1, Math.round(value))) as 1 | 2 | 3 | 4 | 5;
    onUpdate(taskId, { energyRequired: parsed });
  };

  const handleSavedTimeChange = (
    taskId: string,
    part: 'hours' | 'minutes',
    value: number,
    currentMinutes: number
  ) => {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    const nextHours = part === 'hours' ? Math.min(12, Math.max(0, value)) : hours;
    const nextMinutes =
      part === 'minutes' ? Math.min(55, Math.max(0, Math.round(value / 5) * 5)) : minutes;
    const total = nextHours * 60 + nextMinutes;
    onUpdate(taskId, { durationMinutes: total });
  };

useEffect(() => {
  if (!orderedAdjustItems.length) {
    setRemoveMode(false);
    setSavedQuickEdit(null);
    if (mode === 'task-list') setCurrentStep('tasks');
    setSelectedAdjustIndex(0);
  } else {
    setSelectedAdjustIndex(prev => Math.min(prev, orderedAdjustItems.length - 1));
  }
}, [orderedAdjustItems.length, mode]);

useEffect(() => {
  if (currentStep === 'adjust') {
    adjustListRef.current?.focus({ preventScroll: true });
  }
}, [currentStep, orderedAdjustItems.length]);

useEffect(() => {
  if (!energyPulse) return;
  const timer = setTimeout(() => setEnergyPulse(null), 400);
  return () => clearTimeout(timer);
}, [energyPulse]);

  const triggerEnergyPulse = (taskId: string) => {
    setEnergyPulse(null);
    requestAnimationFrame(() => {
      setEnergyPulse({ id: taskId, key: Date.now() });
    });
  };

  const handleAdjustKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (!orderedAdjustItems.length) return;
    const key = event.key;
    if (
      key === 'ArrowUp' ||
      key === 'ArrowDown' ||
      key === 'ArrowLeft' ||
      key === 'ArrowRight'
    ) {
      event.preventDefault();
    }
    if (key === 'ArrowUp') {
      setSelectedAdjustIndex(prev => Math.max(0, prev - 1));
      return;
    }
    if (key === 'ArrowDown') {
      setSelectedAdjustIndex(prev => Math.min(orderedAdjustItems.length - 1, prev + 1));
      return;
    }
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const selected = orderedAdjustItems[selectedAdjustIndex]?.task;
      if (!selected || selected.isBreak) return;
      const delta = key === 'ArrowRight' ? 1 : -1;
      const nextEnergy = Math.min(5, Math.max(1, selected.energyRequired + delta));
      if (nextEnergy !== selected.energyRequired) {
        onUpdate(selected.id, { energyRequired: nextEnergy as 1 | 2 | 3 | 4 | 5 });
        triggerEnergyPulse(selected.id);
      }
    }
  };

  const handleAdjustTimeChange = (taskId: string, minutes: number) => {
    onUpdate(taskId, { durationMinutes: minutes });
  };

  const handleFixedTimeChange = (field: 'start' | 'end', value: string) => {
    const nextStart = field === 'start' ? value : fixedStart;
    const nextEnd = field === 'end' ? value : fixedEnd;
    if (field === 'start') {
      setFixedStart(value);
    } else {
      setFixedEnd(value);
    }
    setFixedTimeError('');

    if (nextStart && nextEnd) {
      const diff = fixedTimeDuration(nextStart, nextEnd)!;
      if (diff <= 0) {
        setFixedTimeError('End time must be after start time');
        return;
      }
      setHours(Math.floor(diff / 60));
      setMinutes(diff % 60);
    }
  };

  type FormattedItem = { id: string; label: string; task: Task };
  const renderSavedItem = (item: FormattedItem) => {
    const task = item.task;
    const isBreakTask = !!task.isBreak;
    const isTimeEditing =
      savedQuickEdit?.taskId === task.id && savedQuickEdit.mode === 'time';
    const isEnergyEditing =
      savedQuickEdit?.taskId === task.id && savedQuickEdit.mode === 'energy';
    const hoursValue = Math.floor(task.durationMinutes / 60);
    const minutesValue = task.durationMinutes % 60;

    return (
      <li key={task.id} className={isBreakTask ? 'break-list-item' : undefined}>
        <div className="task-item-main">
          <span className="task-id">{item.label}</span>
          <span className="task-name">{task.name}</span>
          {task.fixedStart && (
            <span className="task-fixed-time">Fixed at {task.fixedStart}</span>
          )}
        </div>
        <div className="task-item-elements">
          {removeMode && (
            <button
              type="button"
              className="task-remove-btn"
              onClick={() => onRemove(task.id)}
              aria-label={`Remove ${task.name}`}
            >
              <TrashIcon />
            </button>
          )}
          {!isBreakTask && (
            <div className="saved-quick-field">
              {isEnergyEditing ? (
                <div className="quick-edit-group saved" ref={savedQuickRef}>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={task.energyRequired}
                    onChange={e =>
                      handleSavedEnergyChange(task.id, Number(e.target.value))
                    }
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="quick-display saved"
                  onClick={() => toggleSavedQuickEdit(task.id, 'energy')}
                >
                  <EnergyIcon /> {task.energyRequired}
                </button>
              )}
            </div>
          )}
          <div className="saved-quick-field">
            {isTimeEditing ? (
              <div className="quick-edit-group saved" ref={savedQuickRef}>
                <input
                  type="number"
                  min="0"
                  max="12"
                  value={hoursValue}
                  onChange={e =>
                    handleSavedTimeChange(
                      task.id,
                      'hours',
                      Number(e.target.value),
                      task.durationMinutes
                    )
                  }
                />
                <span className="quick-colon">:</span>
                <input
                  type="number"
                  min="0"
                  max="55"
                  step="5"
                  value={minutesValue}
                  onChange={e =>
                    handleSavedTimeChange(
                      task.id,
                      'minutes',
                      Number(e.target.value),
                      task.durationMinutes
                    )
                  }
                />
              </div>
            ) : (
              <button
                type="button"
                className="quick-display saved"
                onClick={() => toggleSavedQuickEdit(task.id, 'time')}
              >
                <TimeIcon /> {formatDuration(task.durationMinutes)}
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };

  const planValidation = validateTimeblockPlan(tasks, startTime, endTime);
  const hasSavedTasks = formattedTasks.length > 0;

  if (currentStep === 'range') {
    return (
      <div className="task-step range-mode">
        <TimeRangeSelector
          tasks={tasks}
          chronotype={chronotype}
          date={date}
          onReorder={onReorder}
          timeZone={timeZone}
          startTime={startTime}
          endTime={endTime}
          onTimeZoneChange={onTimeZoneChange}
          onExport={onExport}
          onStartLiveTimer={onStartLiveTimer}
          startingTimer={startingTimer}
          onRangeChange={onRangeChange}
          skipRangeSelection
          onBack={onScheduleBack ?? (() => setCurrentStep('adjust'))}
          onDone={onDone}
          onStageChange={stage => onStageChange?.(stage)}
          onSaveTimeblock={onSaveTimeblock}
        />
      </div>
    );
  }

  if (currentStep === 'adjust') {
    return (
      <div className="task-step adjust-mode">
        <div className="time-range-header">
          <div>
            <p className="eyebrow">Create a Timeblock</p>
            <h3>Plan Your Timeblock</h3>
          </div>
        </div>
        {orderedAdjustItems.length ? (
          <>
            <div
              className="adjust-grid"
              tabIndex={0}
              onKeyDown={handleAdjustKey}
              ref={adjustListRef}
            >
              {orderedAdjustItems.map((item, index) => {
                const sectionLabel =
                  (taskCount && index === 0 ? 'Rate Your Tasks' : null) ||
                  (breakCount && index === taskCount ? 'Breaks (Optional)' : null);
                const isSelected = selectedAdjustIndex === index;
                const pulseClass =
                  energyPulse && energyPulse.id === item.id
                    ? ` pulse pulse-${energyPulse.key}`
                    : '';
                const cardClass =
                  'adjust-task-card ' +
                  (item.task.isBreak
                    ? 'break-card'
                    : `energy-level-${item.task.energyRequired}`) +
                  (isSelected ? ' selected' : '') +
                  pulseClass;

                return (
                  <React.Fragment key={item.id}>
                    {sectionLabel && (
                      <p className="adjust-section-label">{sectionLabel}</p>
                    )}
                    <div className={cardClass} onClick={() => setSelectedAdjustIndex(index)}>
                      <div className="adjust-task-header">
                        <div>
                          <p>{item.label}</p>
                          {item.task.isBreak ? <label className="plan-break-name">Break name<input aria-label={`Name for break ${index - taskCount + 1}`} value={item.task.name} onChange={event => onUpdate(item.id, { name: event.target.value })} /></label> : <strong>{item.task.name}</strong>}
                        </div>
                        <div className="adjust-chip-row">
                          <div className="plan-rating-field">
                            <span className="plan-field-label">Duration</span>
                            <label className="adjust-pill">
                            <span className="pill-icon">
                              <TimeIcon />
                            </span>
                            <select
                              aria-label={`Duration for ${item.task.name}`}
                              aria-invalid={item.task.durationMinutes <= 0}
                              aria-describedby={planValidation.errors[item.id] ? `plan-error-${item.id}` : undefined}
                              value={item.task.durationMinutes || 0}
                              onChange={e =>
                                handleAdjustTimeChange(item.task.id, Number(e.target.value))
                              }
                            >
                              <option value={0}>Duration</option>
                              {Array.from(new Set([...ADJUST_TIME_OPTIONS, item.task.durationMinutes].filter(value => value > 0))).sort((a, b) => a - b).map(minutes => (
                                <option key={`time-${item.id}-${minutes}`} value={minutes}>
                                  {formatDuration(minutes)}
                                </option>
                              ))}
                            </select>
                            </label>
                          </div>
                          {(item.task.isBreak || item.task.fixedStart) && <label className="plan-fixed-time">Fixed time (optional)<input type="time" aria-label={`Fixed time for ${item.task.name || 'break'}`} value={item.task.fixedStart ?? ''} onChange={event => onUpdate(item.id, { fixedStart: event.target.value || undefined })} /></label>}
                          {!item.task.isBreak ? (
                            <div className="plan-rating-field plan-energy-field">
                              <span className="plan-field-label">Energy</span>
                              <label className="adjust-pill energy">
                              <span className="pill-icon">
                                <EnergyIcon />
                              </span>
                              <select aria-label={`Energy for ${item.task.name}`} value={item.task.energyRequired || 0} onChange={event => onUpdate(item.task.id, { energyRequired: Number(event.target.value) as Task['energyRequired'] })}>
                                <option value={0}>Energy</option>
                                {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}
                              </select>
                              </label>
                            </div>
                          ) : (
                            <button type="button" className="task-remove-btn" aria-label={`Remove ${item.task.name || 'break'}`} onClick={() => onRemove(item.id)}><TrashIcon /></button>
                          )}
                        </div>
                      </div>
                      {planValidation.errors[item.id] && <p className="plan-error" id={`plan-error-${item.id}`} role="status">{planValidation.errors[item.id]}</p>}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            <p className="adjust-hint">Use ↑ ↓ to move, ← → to fine-tune energy on tasks.</p>
          </>
        ) : (
          <p className="adjust-empty">Add tasks to adjust their estimates.</p>
        )}
        <div className="plan-add-actions">
          {!breakCount && <p className="adjust-section-label">Breaks (Optional)</p>}
          <p className="adjust-hint">Leave fixed time empty and Rhythm will place the break for you.</p>
          <button type="button" className="task-step-save" onClick={() => onAdd({ id: crypto.randomUUID(), name: '', durationMinutes: 15, energyRequired: 1, priority: 2, isBreak: true })}>+ Add Break</button>
        </div>
        <section className="plan-time-section" aria-labelledby="plan-time-title">
          <h4 id="plan-time-title">Time Range</h4>
          <div className="plan-time-range">
            <label>Start<select aria-label="Start time" value={startTime} onChange={event => onRangeChange(event.target.value, endTime > event.target.value ? endTime : '')}>
              <option value="">Select start</option>
              {TIME_OPTIONS.slice(0, -1).map(time => <option key={time.value} value={time.value}>{time.label}</option>)}
            </select></label>
            <span aria-hidden="true">→</span>
            <label>End<select aria-label="End time" value={endTime} disabled={!startTime} onChange={event => onRangeChange(startTime, event.target.value)}>
              <option value="">Select end</option>
              {TIME_OPTIONS.filter(time => time.value > startTime).map(time => <option key={time.value} value={time.value}>{time.label}</option>)}
            </select></label>
          </div>
          {!planValidation.validRange && <p className="adjust-hint">Choose a start and a later end time to continue.</p>}
          <div className="time-zone-selector full"><label><span>Time Zone</span><select aria-label="Time Zone" value={timeZone} onChange={event => onTimeZoneChange(event.target.value)}>{TIME_ZONE_OPTIONS.map(zone => <option key={zone.label} value={zone.value}>{zone.label}</option>)}</select></label></div>
        </section>
        <div className="time-range-header-actions plan-footer">
          <button type="button" className="task-step-done" onClick={onDone}>
            Cancel
          </button>
          <button
            type="button"
            className="task-remove-toggle"
            onClick={() => setCurrentStep('tasks')}
          >
            Edit task list
          </button>
          {onSaveTimeblock && (
            <button
              type="button"
              className="task-step-save"
              onClick={onSaveTimeblock}
              disabled={!formattedTasks.length}
            >
              Save
            </button>
          )}
          <button
            type="button"
            className="time-range-next"
            onClick={onPlanNext ?? (() => setCurrentStep('range'))}
            disabled={!planValidation.valid}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="task-step">
      <header className="task-step-header">
        <div className="task-step-title">
          <ListIcon />
          <div>
            <p className="eyebrow">
              {isTaskListMode ? 'Create a Task List' : 'Create a Timeblock'}
            </p>
            <h3>Add your Tasks</h3>
          </div>
        </div>
        <div className="task-header-actions">
          {isTaskListMode ? (
            <button
              type="button"
              className="task-step-save"
              onClick={onSaveTaskList}
              disabled={!hasSavedTasks}
            >
              Save
            </button>
          ) : (
            <>
              <button type="button" className="task-step-done" onClick={onDone}>
                Cancel
              </button>
              <button
                type="button"
                className="task-step-primary"
                onClick={() => setCurrentStep('adjust')}
                disabled={!formattedTasks.length}
              >
                Next
              </button>
              {onSaveTimeblock && (
                <button
                  type="button"
                  className="task-step-save ghost"
                  onClick={onSaveTimeblock}
                  disabled={!hasSavedTasks}
                >
                  Save
                </button>
              )}
            </>
          )}
          {isTaskListMode && (
            <button
              type="button"
              className="task-step-primary"
              onClick={onStartTimeblock}
              disabled={!hasSavedTasks}
            >
              <span>Timeblock</span>
              <GridIcon />
            </button>
          )}
          {isTaskListMode && (
            <button
              type="button"
              className="task-step-close"
              onClick={onDone}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </header>

      <form className="task-step-form" onSubmit={handleSave}>
        <div className="task-entry-block">
          <div
            className={`task-step-input ${
              hasName || isTaskInputFocused ? 'active' : ''
            }`}
          >
            <input
              onFocus={() => setTaskInputFocused(true)}
              onBlur={() => setTaskInputFocused(false)}
              type="text"
              placeholder="What is your task?"
              value={taskName}
              onChange={e => setTaskName(e.target.value)}
            />
            <div className="task-step-quick-inputs">
              <div
                ref={timeQuickRef}
                className={`quick-field ${quickEditMode === 'time' ? 'editing' : ''}`}
                onMouseDown={() => hasName && setQuickEditMode('time')}
                role="presentation"
              >
                {quickEditMode === 'time' ? (
                  <div className="quick-edit-group" tabIndex={-1}>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={hours}
                      disabled={!hasName}
                      onChange={e => {
                        setHours(Math.min(12, Math.max(0, Number(e.target.value))));
                        setDetailsOpen(true);
                      }}
                      aria-label="Quick hours"
                    />
                    <span className="quick-colon">:</span>
                    <input
                      type="number"
                      min="0"
                      max="55"
                      step="5"
                      value={minutes}
                      disabled={!hasName}
                      onChange={e => {
                        setMinutes(Math.min(55, Math.max(0, Number(e.target.value))));
                        setDetailsOpen(true);
                      }}
                      aria-label="Quick minutes"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="quick-display"
                    onClick={() => hasName && setQuickEditMode('time')}
                    disabled={!hasName}
                  >
                    <span>{formatDuration(durationMinutes)}</span>
                    <TimeIcon active={hasName} />
                  </button>
                )}
              </div>
              <div
                ref={energyQuickRef}
                className={`quick-field energy ${quickEditMode === 'energy' ? 'editing' : ''}`}
                onMouseDown={() => hasName && setQuickEditMode('energy')}
                role="presentation"
              >
                {quickEditMode === 'energy' ? (
                  <div className="quick-edit-group" tabIndex={-1}>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={energy}
                      disabled={!hasName}
                      onChange={e => {
                        setEnergy(Math.min(5, Math.max(1, Number(e.target.value))));
                        setDetailsOpen(true);
                      }}
                      aria-label="Quick energy"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="quick-display"
                    onClick={() => hasName && setQuickEditMode('energy')}
                    disabled={!hasName}
                  >
                    <span>{energy}</span>
                    <EnergyIcon active={hasName} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="inline-save"
                disabled={!canSave}
                aria-label="Save task"
              >
                <span>Save</span>
                <EnterIcon />
              </button>
            </div>
          </div>

          <div
            className={
              'task-step-details-wrapper' +
              (hasName ? ' visible' : ' disabled hidden') +
              (detailsOpen && hasName ? ' expanded' : ' collapsed') +
              (isBreak ? ' break-selected' : '')
            }
            aria-hidden={!hasName}
          >
            <button
              type="button"
              className="task-step-expand ghost"
              onClick={toggleDetails}
              aria-expanded={detailsOpen && hasName}
              disabled={!hasName}
            >
              <span className="plus-icon" aria-hidden="true">
                {detailsOpen && hasName ? '−' : '+'}
              </span>
              <span className="task-step-expand-text">
                {detailsOpen && hasName
                  ? 'Hide Task Details'
                  : 'Add Task Details'}
              </span>
              <span className="task-step-expand-icons" aria-hidden="true">
                <TimeIcon active={hasName} />
                <EnergyIcon active={hasName} />
              </span>
            </button>

            <TaskDetailFields open={detailsOpen} hasName={hasName} energy={energy} hours={hours} minutes={minutes}
              isBreak={isBreak} fixedStart={fixedStart} fixedEnd={fixedEnd} fixedTimeError={fixedTimeError}
              setEnergy={setEnergy} setHours={setHours} setMinutes={setMinutes} setIsBreak={setIsBreak}
              handleFixedTimeChange={handleFixedTimeChange} />
          </div>
        </div>
      </form>
      {formattedTasks.length > 0 && (
        <>
          <div className="task-step-saved-header">
            <h4>Added Tasks</h4>
            <button
              type="button"
              className="task-remove-toggle"
              onClick={() => setRemoveMode(prev => !prev)}
            >
              {removeMode ? 'Done' : 'Remove tasks'}
            </button>
          </div>
          <ul className="task-step-saved">
            {taskItems.length > 0 && (
              <>
                {taskItems.map(renderSavedItem)}
              </>
            )}
            {breakItems.length > 0 && (
              <>
                {breakItems.map(renderSavedItem)}
              </>
            )}
          </ul>
        </>
      )}
    </div>
  );
};

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

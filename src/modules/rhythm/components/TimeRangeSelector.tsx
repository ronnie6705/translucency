import React, { useEffect, useMemo, useState } from 'react';
import type { Chronotype, Task } from '../types';
import { TIME_ZONE_OPTIONS } from '../utils/timezone';
import { planSequentialTasks } from '../utils/manualSchedule';
import { generateSchedule } from '../rhythmScheduler';
import { TimerIcon } from './LiveTimer';

interface TimeRangeSelectorProps {
  tasks: Task[];
  chronotype: Chronotype;
  date: string;
  onBack?: () => void;
  onDone?: () => void;
  onReorder?: (nextOrder: Task[]) => void;
  onExport?: () => void;
  onStartLiveTimer?: (exportCalendar?: boolean) => void;
  startingTimer?: boolean;
  timeZone: string;
  startTime: string;
  endTime: string;
  onTimeZoneChange?: (timeZone: string) => void;
  onRangeChange?: (startTime: string, endTime: string) => void;
  onStageChange?: (stage: 'range-select' | 'range-blocks' | 'range-export') => void;
  onSaveTimeblock?: () => void;
}

const STEP_MINUTES = 15;
const TOTAL_STEPS = (24 * 60) / STEP_MINUTES;
const TIMELINE_HEIGHT = 620;
const MIN_BLOCK_HEIGHT = 44;

type DropTargetId = string | 'end' | null;

const ClockIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="10" cy="10" r="7.2" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M10 5.5V10.2L13.1 11.8"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BoltIcon = () => (
  <svg
    width="14"
    height="16"
    viewBox="0 0 14 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M7.25 0.75L2 8.5H6.1L5.25 15.25L11.75 6.75H7.65L8.5 0.75H7.25Z"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinejoin="round"
      fill="currentColor"
    />
  </svg>
);

const CalendarIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M7 3V6M17 3V6M4.5 9.5H19.5M6 5H18C19.1046 5 20 5.89543 20 7V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V7C4 5.89543 4.89543 5 6 5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FileIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M14 3H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V8L14 3Z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 3V8H19"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const LiveTimerIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle cx="12" cy="13" r="7" stroke="currentColor" strokeWidth="1.8" />
    <path
      d="M12 13L15 11M9 3H15M12 3V6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ListIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M8 6H20M8 12H20M8 18H20M4 6H4.01M4 12H4.01M4 18H4.01"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const slotLabel = (index: number) => {
  const totalMinutes = index * STEP_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const minuteText = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`;
  return `${hour12}${minuteText} ${ampm}`.trim();
};

const formatDuration = (start: number, end: number) => {
  const totalMinutes = (end - start) * STEP_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourText = hours ? `${hours}h` : '';
  const minuteText = minutes ? `${minutes}m` : '';
  return `${hourText} ${minuteText}`.trim() || '0m';
};

const timeStringToIndex = (value: string): number | null => {
  const [rawHours, rawMinutes] = value.split(':').map(Number);
  if (
    Number.isNaN(rawHours) ||
    Number.isNaN(rawMinutes) ||
    rawHours < 0 ||
    rawHours > 23 ||
    rawMinutes < 0 ||
    rawMinutes > 59 ||
    rawMinutes % STEP_MINUTES !== 0
  ) {
    return null;
  }
  return (rawHours * 60 + rawMinutes) / STEP_MINUTES;
};

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  tasks,
  chronotype,
  date,
  onBack,
  onDone,
  onReorder,
  onExport,
  onStartLiveTimer,
  startingTimer,
  timeZone,
  startTime,
  endTime,
  onTimeZoneChange,
  onRangeChange,
  onStageChange,
  onSaveTimeblock,
}) => {
  const slots = useMemo(() => Array.from({ length: TOTAL_STEPS }, (_, i) => slotLabel(i)), []);
  const initialStartIndex = timeStringToIndex(startTime);
  const initialEndIndex = timeStringToIndex(endTime);
  const hasInitialRange =
    initialStartIndex !== null &&
    initialEndIndex !== null &&
    initialEndIndex > initialStartIndex;
  const [startIndex, setStartIndex] = useState<number | null>(initialStartIndex);
  const [endIndex, setEndIndex] = useState<number | null>(initialEndIndex);
  const [mode, setMode] = useState<'start' | 'end' | 'review' | 'blocks' | 'export'>(
    hasInitialRange ? 'review' : 'start'
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<DropTargetId>(null);
  const [timelineHeight, setTimelineHeight] = useState(TIMELINE_HEIGHT);

  useEffect(() => {
    const updateHeight = () => {
      if (typeof window === 'undefined') {
        setTimelineHeight(TIMELINE_HEIGHT);
        return;
      }
      const viewport = window.innerHeight || TIMELINE_HEIGHT;
      const paddingAllowance = 240;
      const desired = Math.min(TIMELINE_HEIGHT, Math.max(320, viewport - paddingAllowance));
      setTimelineHeight(desired);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    if (!onStageChange) return;
    if (mode === 'blocks') {
      onStageChange('range-blocks');
    } else if (mode === 'export') {
      onStageChange('range-export');
    } else {
      onStageChange('range-select');
    }
  }, [mode, onStageChange]);

  const canReview = startIndex !== null && endIndex !== null && endIndex > startIndex;
  const chronotypeSuggestedOrder = useMemo(() => {
    if (
      startIndex === null ||
      endIndex === null ||
      startIndex >= endIndex ||
      !tasks.length
    ) {
      return null;
    }
    const startTime = indexToTimeString(startIndex);
    const endTime = indexToTimeString(endIndex);
    const schedule = generateSchedule(
      tasks.map(task => ({ ...task })),
      {
        date,
        startTime,
        endTime,
        chronotype,
        timezone: timeZone,
      }
    );
    if (!schedule.length) return null;
    const ordered: Task[] = [];
    const seen = new Set<string>();
    for (const block of schedule) {
      const match = tasks.find(task => task.id === block.taskId);
      if (match && !seen.has(match.id)) {
        seen.add(match.id);
        ordered.push(match);
      }
    }
    for (const task of tasks) {
      if (!seen.has(task.id)) {
        seen.add(task.id);
        ordered.push(task);
      }
    }
    return ordered.length ? ordered : null;
  }, [startIndex, endIndex, tasks, date, chronotype, timeZone]);

  const plannedSegments = useMemo(() => {
    if (startIndex === null || endIndex === null) return [];
    const rangeMinutes = (endIndex - startIndex) * STEP_MINUTES;
    const planningTasks = chronotypeSuggestedOrder ?? tasks;
    const rangeStartMinutes = startIndex * STEP_MINUTES;
    const rangeEndMinutes = endIndex * STEP_MINUTES;
    return planSequentialTasks(planningTasks, rangeMinutes, {
      absoluteRangeStart: rangeStartMinutes,
      absoluteRangeEnd: rangeEndMinutes,
    });
  }, [tasks, chronotypeSuggestedOrder, startIndex, endIndex]);

  const timelineBlocks = useMemo(() => {
    if (
      startIndex === null ||
      endIndex === null ||
      !plannedSegments.length
    ) {
      return [];
    }
    const rangeMinutes = (endIndex - startIndex) * STEP_MINUTES || 1;
    const rangeStartMinutes = startIndex * STEP_MINUTES;
    return plannedSegments.map(segment => {
      const blockHeight = Math.max(
        MIN_BLOCK_HEIGHT,
        (segment.durationMinutes / rangeMinutes) * TIMELINE_HEIGHT
      );
      const startLabel = formatClockLabel(
        rangeStartMinutes + segment.offsetMinutes
      );
      const blockTitle =
        segment.totalParts && segment.totalParts > 1 && segment.partIndex
          ? `${segment.task.name} ${segment.partIndex}`
          : segment.task.name;
      const blockKey =
        segment.totalParts && segment.totalParts > 1 && segment.partIndex
          ? `${segment.task.id}-part-${segment.partIndex}`
          : segment.task.id;
      return {
        task: segment.task,
        height: blockHeight,
        startLabel,
        endLabel: formatClockLabel(
          rangeStartMinutes + segment.offsetMinutes + segment.durationMinutes
        ),
        scheduledMinutes: segment.durationMinutes,
        clipped: segment.clipped,
        title: blockTitle,
        key: blockKey,
      };
    });
  }, [plannedSegments, startIndex, endIndex]);

  const handleSelect = (column: 'start' | 'end', index: number) => {
    if (column === 'start') {
      setStartIndex(index);
      if (endIndex !== null && index >= endIndex) {
        setEndIndex(null);
      }
      setMode('end');
    } else {
      if (startIndex === null || index <= startIndex) return;
      setEndIndex(index);
      setMode('review');
    }
  };

  useEffect(() => {
    if (
      onRangeChange &&
      startIndex !== null &&
      endIndex !== null &&
      startIndex < endIndex
    ) {
      onRangeChange(indexToTimeString(startIndex), indexToTimeString(endIndex));
    }
  }, [startIndex, endIndex, onRangeChange]);

  const handleReorderBlocks = (sourceId: string, targetId: DropTargetId) => {
    if (!onReorder || !sourceId) return;
    if (targetId && sourceId === targetId) {
      return;
    }

    const sourceIndex = tasks.findIndex(task => task.id === sourceId);
    if (sourceIndex === -1) return;

    const updated = [...tasks];
    const [moved] = updated.splice(sourceIndex, 1);

    if (!targetId || targetId === 'end') {
      updated.push(moved);
    } else {
      const targetOriginalIndex = tasks.findIndex(task => task.id === targetId);
      if (targetOriginalIndex === -1) {
        updated.push(moved);
      } else {
        const targetIndexAfterRemoval = updated.findIndex(task => task.id === targetId);
        const insertAfter = sourceIndex < targetOriginalIndex;
        const insertIndex = insertAfter ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
        updated.splice(insertIndex, 0, moved);
      }
    }

    onReorder(updated);
  };

  const handleDropComplete = (event: React.DragEvent, targetId: DropTargetId) => {
    event.preventDefault();
    if (draggingId) {
      handleReorderBlocks(draggingId, targetId);
    }
    setDraggingId(null);
    setDropTargetId(null);
  };

  const handleDragStartBlock = (event: React.DragEvent, taskId: string) => {
    event.dataTransfer?.setData('text/plain', taskId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(taskId);
  };

  const handleDragOverBlock = (event: React.DragEvent, targetId: DropTargetId) => {
    if (!draggingId) return;
    if (targetId === draggingId) return;
    event.preventDefault();
    setDropTargetId(targetId);
  };

  const handleDragEndBlock = () => {
    setDraggingId(null);
    setDropTargetId(null);
  };

  const summary = canReview
    ? {
        range: `${slotLabel(startIndex!)} - ${slotLabel(endIndex!)}`,
        duration: formatDuration(startIndex!, endIndex!),
        tasks: tasks.length,
      }
    : null;

  const handleBackClick = () => {
    if (mode === 'export') {
      setMode('blocks');
      return;
    }
    if (mode === 'blocks') {
      setMode('review');
      return;
    }
    if (onBack) {
      onBack();
    }
  };

  const handleNextClick = () => {
    if (mode === 'export') {
      setMode('start');
      setStartIndex(null);
      setEndIndex(null);
      return;
    }
    if (mode === 'blocks') {
      setMode('export');
      return;
    }
    if (mode === 'review' && canReview) {
      if (chronotypeSuggestedOrder && onReorder) {
        onReorder(chronotypeSuggestedOrder);
      }
      setMode('blocks');
      return;
    }
    if (canReview) {
      setMode('blocks');
    }
  };

  const nextDisabled = !canReview && mode !== 'blocks' && mode !== 'export';

  return (
    <section className={`time-range-card${mode === 'export' ? ' calendar-mode' : ''}`}>
      <div className="time-range-header">
        <div>
          <p className="eyebrow">Create a Timeblock</p>
          <h3>
            {mode === 'export'
              ? "Let's get you all set up!"
              : mode === 'blocks'
              ? 'Edit your Time Block'
              : 'Set your Time Range'}
          </h3>
        </div>
        <div className="time-range-header-actions">
          {onDone && (
            <button type="button" className="task-step-done" aria-label={mode === 'export' ? 'Close timeblock' : undefined} onClick={onDone}>
              {mode === 'export' ? <TimerIcon name="close" /> : 'Cancel'}
            </button>
          )}
          {onBack && (
            <button type="button" className="task-remove-toggle" aria-label={mode === 'export' ? 'Back' : undefined} onClick={handleBackClick}>
              {mode === 'export' ? <TimerIcon name="back" /> : 'Back'}
            </button>
          )}
          {onSaveTimeblock && (
            <button
              type="button"
              className="task-step-save"
              onClick={onSaveTimeblock}
              disabled={!tasks.length}
            >
              Save
            </button>
          )}
          {mode !== 'export' && (
            <button
              type="button"
              className="time-range-next"
              disabled={nextDisabled}
              onClick={handleNextClick}
            >
              Next
            </button>
          )}
        </div>
      </div>

      {(mode !== 'blocks' && mode !== 'export') && (
        <div className="time-picker-columns">
          <div className="time-column">
            <p>Start</p>
            <div className="time-column-inner">
              {slots.map((slot, index) => (
                <button
                  type="button"
                  key={`start-${slot}-${index}`}
                  className={
                    'time-slot' +
                    (startIndex === index ? ' active' : '') +
                    (mode === 'start' ? ' highlight' : '')
                  }
                  onClick={() => handleSelect('start', index)}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
          <div className="time-column">
            <p>End</p>
            <div className="time-column-inner">
              {slots.map((slot, index) => (
                <button
                  type="button"
                  key={`end-${slot}-${index}`}
                  className={
                    'time-slot' +
                    (endIndex === index ? ' active' : '') +
                    (mode === 'end' ? ' highlight' : '')
                  }
                  onClick={() => handleSelect('end', index)}
                  disabled={startIndex === null || index <= startIndex}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(mode === 'start' || mode === 'end' || mode === 'review') && (
        <div className="time-zone-selector full">
          <label>
            <span>Time Zone</span>
            <select
              value={timeZone}
              onChange={e => onTimeZoneChange?.(e.target.value)}
            >
              {TIME_ZONE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div
        className={
          'time-range-summary' + (summary && mode !== 'start' && mode !== 'export' ? ' visible' : '')
        }
      >
        {summary && mode !== 'start' && mode !== 'export' && (
          <>
            <h4>Time Range Summary</h4>
            <div className="time-summary-grid">
              <div>
                <span className="label">Total Time</span>
                <strong>{summary.duration}</strong>
              </div>
              <div>
                <span className="label">Range</span>
                <strong>{summary.range}</strong>
              </div>
              <div>
                <span className="label">No. of Tasks</span>
                <strong>{summary.tasks}</strong>
              </div>
            </div>
          </>
        )}
      </div>

      {mode === 'export' && summary && (
        <div className="calendar-handoff-screen">
          <p className="calendar-handoff-eyebrow">Your Timeblock</p>

          <div className="calendar-handoff-summary">
            <div>
              <FileIcon />
              <strong>{summary.tasks} tasks</strong>
            </div>
            <div>
              <ClockIcon />
              <strong>{summary.duration}</strong>
            </div>
            <div>
              <ClockIcon />
              <span>{summary.range}</span>
              <strong>{formatDisplayDate(date)}</strong>
              <small>{formatWeekday(date)}</small>
            </div>
          </div>

          <div className="calendar-handoff-tasklist">
            <div className="calendar-handoff-taskrows">
              {timelineBlocks.map(
                ({ task, title, key, startLabel, endLabel, scheduledMinutes }) => (
                  <div className="calendar-handoff-taskrow" key={key}>
                    <div>
                      <span>
                        {task.isBreak
                          ? 'Break'
                          : `Task ${taskSequenceLabel(timelineBlocks, key)}`}
                      </span>
                      <strong>{title}</strong>
                      <small>{startLabel} - {endLabel}</small>
                    </div>
                    <div className="calendar-handoff-taskmeta">
                      {!task.isBreak && (
                        <span>
                          <BoltIcon />
                          {task.energyRequired}
                        </span>
                      )}
                      <span>
                        <ClockIcon />
                        {formatDurationTask(scheduledMinutes)}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="calendar-handoff-options">
            <p>Choose an option</p>
            <button type="button" className="calendar-action secondary" onClick={() => onStartLiveTimer?.()} disabled={!onStartLiveTimer || !tasks.length || startingTimer}>
              <TimerIcon name="timer" /><span>{startingTimer ? 'Starting…' : 'Start a Live Timer'}</span>
            </button>
            <button
              type="button"
              className="calendar-action secondary"
              onClick={onExport}
              disabled={!onExport || !tasks.length}
            >
              <TimerIcon name="calendar" />
              <span>Export to ICS</span>
            </button>
            <button type="button" className="calendar-action secondary" onClick={() => onStartLiveTimer?.(true)} disabled={!onStartLiveTimer || !tasks.length || startingTimer}>
              <TimerIcon name="calendar" /><TimerIcon name="timer" /><span>Both Live Timer &amp; ICS</span>
            </button>
          </div>
        </div>
      )}

      {mode === 'blocks' && summary && (
        <div className="time-block-preview">
          <div className="time-block-tip">Drag to reorder your timeblocks</div>
          <div className="time-block-timeline">
            <div className="timeline-stack" style={{ height: `${timelineHeight}px` }}>
              {timelineBlocks.length ? (
                timelineBlocks.map(
                  ({ task, height, startLabel, scheduledMinutes, clipped, title, key }) => (
                  <div
                    key={key}
                    className={
                      'calendar-block' +
                      (task.isBreak ? ' break' : '') +
                      ` energy-level-${task.energyRequired}` +
                      (draggingId === task.id ? ' dragging' : '') +
                      (dropTargetId === task.id ? ' drop-target' : '')
                    }
                    style={{ height: `${height}px` }}
                    draggable
                    onDragStart={event => handleDragStartBlock(event, task.id)}
                    onDragEnd={handleDragEndBlock}
                    onDragOver={event => handleDragOverBlock(event, task.id)}
                    onDrop={event => handleDropComplete(event, task.id)}
                  >
                    <div className="block-content">
                      <div className="block-info">
                        <span className="block-start">{startLabel}</span>
                        <p className="block-title">{title}</p>
                        {clipped && (
                          <span className="block-reduced">
                            Reduced to {formatDurationTask(scheduledMinutes)} to fit the
                            time range
                          </span>
                        )}
                      </div>
                      <div className="block-meta">
                        <span className="meta-pill">
                          <ClockIcon />
                          {formatDurationTask(scheduledMinutes)}
                        </span>
                        <span className="meta-pill">
                          <BoltIcon />
                          {task.energyRequired}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="timeline-empty">
                  <p>No tasks added yet.</p>
                  <span>Add tasks to see your calendar blocks.</span>
                </div>
              )}
              {timelineBlocks.length > 0 && (
                <div
                  className={
                    'timeline-drop-end' +
                    (draggingId ? ' visible' : '') +
                    (dropTargetId === 'end' ? ' active' : '')
                  }
                  onDragOver={event => handleDragOverBlock(event, 'end')}
                  onDragEnter={event => handleDragOverBlock(event, 'end')}
                  onDrop={event => handleDropComplete(event, 'end')}
                >
                  Drop here to move to end
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

function formatDurationTask(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourText = hours ? `${hours}h` : '';
  const minuteText = minutes ? `${minutes}m` : '';
  return `${hourText} ${minuteText}`.trim() || '0m';
}

function formatClockLabel(totalMinutes: number) {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hourValue = hours % 12 === 0 ? 12 : hours % 12;
  const minuteText = mins.toString().padStart(2, '0');
  return `${hourValue}:${minuteText} ${ampm}`;
}

function formatDisplayDate(date: string) {
  const parsed = parseLocalDate(date);
  if (!parsed) return date;
  const month = parsed.toLocaleDateString(undefined, { month: 'long' });
  return `${month} ${ordinal(parsed.getDate())}, ${parsed.getFullYear()}`;
}

function formatWeekday(date: string) {
  const parsed = parseLocalDate(date);
  if (!parsed) return '';
  return parsed.toLocaleDateString(undefined, { weekday: 'long' });
}

function parseLocalDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function ordinal(day: number) {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function taskSequenceLabel(blocks: Array<{ key: string; task: Task }>, key: string) {
  let taskCount = 0;
  for (const block of blocks) {
    if (!block.task.isBreak) taskCount += 1;
    if (block.key === key) return taskCount;
  }
  return '';
}

function indexToTimeString(index: number): string {
  const minutes = index * STEP_MINUTES;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export default TimeRangeSelector;

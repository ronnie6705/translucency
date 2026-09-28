import React, { useEffect, useMemo, useState } from 'react';
import type { SavedTimeblock, Task } from '../types';
import type { LiveTimer } from '../live-timer';
import { TaskRow } from './TasksPanel';
import { TimeblockSchedule } from './LiveTimer';
import { TimeblockSettings } from './TimeblockSettings';
import { TaskSettingsModal } from './task-dialogs';
import { ChronotypeIcon } from './chronotype-icons';
import {
  SliderVerticalIcon,
  CalendarDatesIcon,
  FileMetaIcon,
  TimeMetaIcon,
  ChevronDownIcon,
  AddTimeblockPlusIcon,
} from '../assets/timeblock-icons';
import { acceptedSchedule } from '../schedule';
import { createDateInTimeZone } from '../utils/timezone';
import { formatTaskDuration } from '../task-spaces';

export interface TimeblockWorkspaceProps {
  timeblocks: SavedTimeblock[];
  liveTimer?: LiveTimer;
  onAddTimeblock: () => void;
  onOpenTimer: (timeblock: SavedTimeblock) => void;
  onRenameTimeblock: (timeblock: SavedTimeblock) => void;
  onEditTimeblock: (timeblock: SavedTimeblock) => void;
  onDeleteTimeblock: (timeblockId: string) => void;
  onUpdateTask: (timeblockId: string, taskId: string, updates: Partial<Task>) => Promise<boolean>;
  onDeleteTask: (timeblockId: string, taskId: string) => Promise<boolean>;
}

export function TimeblockWorkspace({
  timeblocks,
  liveTimer,
  onAddTimeblock,
  onOpenTimer,
  onRenameTimeblock,
  onEditTimeblock,
  onDeleteTimeblock,
  onUpdateTask,
  onDeleteTask,
}: TimeblockWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Default to expanding all timeblocks
    return new Set(timeblocks.map((tb) => tb.id));
  });
  const [editingTask, setEditingTask] = useState<{
    task: Task;
    timeblockId: string;
  } | null>(null);

  // Sync expanded IDs if new timeblock is added
  useEffect(() => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      timeblocks.forEach((tb) => {
        if (!prev.has(tb.id) && prev.size === 0) {
          next.add(tb.id);
        }
      });
      return next;
    });
  }, [timeblocks]);

  // Global shortcut: ⌘ / Ctrl + Space triggers Add Timeblock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.code === 'Space' || e.key === ' ')) {
        const target = e.target as HTMLElement;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        onAddTimeblock();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onAddTimeblock]);

  const allTimeblocks = useMemo(() => {
    if (
      liveTimer &&
      !timeblocks.some(
        (tb) => tb.id === liveTimer.id || tb.name === liveTimer.name
      )
    ) {
      const now = new Date();
      const todayStr = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-');
      const syntheticTb: SavedTimeblock = {
        id: liveTimer.id,
        name: liveTimer.name,
        createdAt: liveTimer.startedAt ?? new Date().toISOString(),
        dayConfig: {
          date: todayStr,
          startTime: '09:00',
          endTime: '17:00',
          timezone: liveTimer.timezone,
          chronotype: 'Lion',
        },
        tasks: liveTimer.blocks
          .filter((b) => !b.isBreak)
          .map((b) => ({
            id: b.taskId,
            name: b.taskName,
            durationMinutes:
              (Date.parse(b.end) - Date.parse(b.start)) / 60000,
            energyRequired: (Math.max(1, Math.min(5, Math.round(b.energyRequired || 3))) as 1 | 2 | 3 | 4 | 5),
            priority: 1,
          })),
      };
      return [syntheticTb, ...timeblocks];
    }
    return timeblocks;
  }, [timeblocks, liveTimer]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const cleanQuery = searchQuery.trim().toLowerCase();

  return (
    <div className="timeblock-workspace" id="rhythm-timeblocks">
      {/* 1. Header: SliderVerticalIcon + Timeblock heading + Search tasks input */}
      <header className="timeblock-workspace-header">
        <div className="timeblock-header-title-wrap">
          <div className="timeblock-header-icon-box" aria-hidden="true">
            <SliderVerticalIcon className="size-[24px] text-white" />
          </div>
          <h1 className="timeblock-workspace-title">Timeblock</h1>
        </div>

        <div className="timeblock-search-container">
          <input
            type="text"
            className="timeblock-search-input"
            placeholder="Search tasks"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search tasks across timeblocks"
          />
        </div>
      </header>

      {/* 2. Add Timeblock Button */}
      <button
        type="button"
        className="timeblock-add-card"
        onClick={onAddTimeblock}
        aria-label="Add Timeblock"
      >
        <div className="timeblock-add-left">
          <div className="timeblock-add-icon-tile" aria-hidden="true">
            <AddTimeblockPlusIcon className="size-[22px] text-white" />
          </div>
          <span className="timeblock-add-label">Add Timeblock</span>
        </div>
        <div className="timeblock-add-shortcut" aria-hidden="true">
          ⌘ / Ctrl + Space
        </div>
      </button>

      {/* 3. Timeblock Cards Stack */}
      <div className="timeblock-cards-stack">
        {allTimeblocks.map((tb) => {
          const isLive =
            liveTimer != null &&
            (liveTimer.id === tb.id || liveTimer.name === tb.name);
          const isExpanded = expandedIds.has(tb.id);

          // Format metadata chips
          const formattedDate = new Intl.DateTimeFormat('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: tb.dayConfig.timezone,
          }).format(
            createDateInTimeZone(
              tb.dayConfig.date,
              tb.dayConfig.startTime || '09:00',
              tb.dayConfig.timezone
            )
          );

          const totalMinutes = tb.tasks.reduce(
            (sum, t) => sum + (t.durationMinutes || 0),
            0
          );
          const totalDurationStr = formatTaskDuration(totalMinutes);

          // Filter tasks based on search
          const matchingTasks = cleanQuery
            ? tb.tasks.filter((t) => t.name.toLowerCase().includes(cleanQuery))
            : tb.tasks;

          // Prepare Schedule timer object
          let scheduleTimer: LiveTimer;
          if (isLive && liveTimer) {
            scheduleTimer = liveTimer;
          } else {
            const blocks = acceptedSchedule(tb);

            scheduleTimer = {
              id: tb.id,
              name: tb.name,
              timezone: tb.dayConfig.timezone,
              blocks,
              startedAt:
                blocks[0]?.start ??
                createDateInTimeZone(
                  tb.dayConfig.date,
                  tb.dayConfig.startTime || '09:00',
                  tb.dayConfig.timezone
                ).toISOString(),
              endsAt:
                blocks[blocks.length - 1]?.end ??
                createDateInTimeZone(
                  tb.dayConfig.date,
                  tb.dayConfig.endTime || '17:00',
                  tb.dayConfig.timezone
                ).toISOString(),
            };
          }

          return (
            <article
              key={tb.id}
              className={`timeblock-workspace-card ${isLive ? 'is-live' : ''} ${
                !isExpanded ? 'is-collapsed' : ''
              }`}
              aria-label={`Timeblock: ${tb.name}`}
              onClick={(e) => {
                // If clicked inside interactive controls (settings, buttons, inputs), don't toggle
                if (
                  (e.target as HTMLElement).closest(
                    '.timeblock-settings, button, a, input, [role="button"]'
                  )
                ) {
                  return;
                }
                // If collapsed, clicking anywhere on the card expands it.
                // If expanded, clicking the header area collapses it.
                if (
                  !isExpanded ||
                  (e.target as HTMLElement).closest('.timeblock-card-header')
                ) {
                  toggleExpanded(tb.id);
                }
              }}
            >
              {/* Card Header */}
              <header
                className="timeblock-card-header"
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded ? `Collapse ${tb.name}` : `Expand ${tb.name}`
                }
                onClick={(e) => {
                  if (
                    (e.target as HTMLElement).closest(
                      '.timeblock-settings, button, a, input'
                    )
                  ) {
                    return;
                  }
                  toggleExpanded(tb.id);
                }}
                onKeyDown={(e) => {
                  if (
                    (e.key === 'Enter' || e.key === ' ') &&
                    !(e.target as HTMLElement).closest(
                      '.timeblock-settings, button, a, input'
                    )
                  ) {
                    e.preventDefault();
                    toggleExpanded(tb.id);
                  }
                }}
              >
                <div className="timeblock-card-header-left">
                  <div
                    className="timeblock-chronotype-pill"
                    title={`Chronotype: ${tb.dayConfig.chronotype}`}
                  >
                    <SliderVerticalIcon className="timeblock-slider-icon" />
                    <ChronotypeIcon
                      chronotype={tb.dayConfig.chronotype}
                      className="timeblock-chronotype-animal"
                    />
                  </div>

                  <div className="timeblock-card-title-group">
                    <h2
                      className="timeblock-card-title"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTimeblock(tb);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {tb.name}
                    </h2>
                    <div className="timeblock-card-meta-chips">
                      <span className="timeblock-meta-chip">
                        <CalendarDatesIcon className="h-[18.37px] w-[18.37px]" />
                        <span>{formattedDate}</span>
                      </span>
                      <span className="timeblock-meta-chip">
                        <FileMetaIcon className="h-[16.23px] w-[16.23px]" />
                        <span>
                          {tb.tasks.length}{' '}
                          {tb.tasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                      </span>
                      <span className="timeblock-meta-chip">
                        <TimeMetaIcon className="h-[18.37px] w-[18.37px]" />
                        <span>{totalDurationStr}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="timeblock-card-header-right">
                  {isLive && (
                    <div
                      className="timeblock-live-badge"
                      role="heading"
                      aria-level={2}
                      aria-label="Live Timer"
                    >
                      LIVE
                    </div>
                  )}

                  <TimeblockSettings
                    timeblockName={tb.name}
                    onRename={() => onRenameTimeblock(tb)}
                    onEdit={() => onEditTimeblock(tb)}
                    onDelete={() => onDeleteTimeblock(tb.id)}
                  />

                  <button
                    type="button"
                    className="timeblock-collapse-btn"
                    aria-label={
                      isExpanded
                        ? `Collapse ${tb.name}`
                        : `Expand ${tb.name}`
                    }
                    aria-expanded={isExpanded}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(tb.id);
                    }}
                  >
                    <ChevronDownIcon
                      className={`timeblock-chevron ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              </header>

              {/* Card Body (when expanded) */}
              {isExpanded && (
                <div className="timeblock-card-body">
                  {/* Left Column: Tasks */}
                  <div className="timeblock-tasks-column">
                    <div className="timeblock-tasks-list">
                      {matchingTasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          onUpdate={(updates) =>
                            onUpdateTask(tb.id, task.id, updates)
                          }
                          onSettings={() =>
                            setEditingTask({ task, timeblockId: tb.id })
                          }
                        />
                      ))}
                      {matchingTasks.length === 0 && (
                        <div className="timeblock-tasks-empty">
                          {cleanQuery
                            ? `No tasks match "${searchQuery}".`
                            : 'No tasks in this timeblock.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Embedded Schedule */}
                  <div className="timeblock-schedule-column">
                    {scheduleTimer.blocks.length > 0 ? (
                      <TimeblockSchedule
                        timer={scheduleTimer}
                        onClick={() => onOpenTimer(tb)}
                      />
                    ) : (
                      <div
                        className="timeblock-schedule-empty"
                        role="button"
                        tabIndex={0}
                        aria-label={`Open timer for ${tb.name}`}
                        onClick={() => onOpenTimer(tb)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenTimer(tb);
                          }
                        }}
                      >
                        <p>No schedule blocks</p>
                        <span>Click to open timer</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {timeblocks.length === 0 && (
          <div className="timeblock-empty-state">
            <p className="timeblock-empty-title">No timeblocks saved yet</p>
            <p className="timeblock-empty-desc">
              Click &ldquo;Add Timeblock&rdquo; above or press ⌘ / Ctrl + Space to
              create and schedule your first timeblock.
            </p>
          </div>
        )}
      </div>

      {/* Task Settings Modal */}
      {editingTask && (
        <TaskSettingsModal
          task={editingTask.task}
          onClose={() => setEditingTask(null)}
          onSave={async (updated) => {
            const ok = await onUpdateTask(
              editingTask.timeblockId,
              editingTask.task.id,
              updated
            );
            if (ok) setEditingTask(null);
            return ok;
          }}
          onDelete={async () => {
            const ok = await onDeleteTask(
              editingTask.timeblockId,
              editingTask.task.id
            );
            if (ok) setEditingTask(null);
            return ok;
          }}
        />
      )}
    </div>
  );
}

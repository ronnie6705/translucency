"use client";
import { createTimeblockRun, launchTimeblockRun, createRunCommand } from './timeblock-run';
import { updateLiveTimerTimeWindow } from './update-live-time-window';
// src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTaskWorkspace } from "./task-workspace";
import type { ReactNode } from 'react';

import { TasksPanel } from './components/TasksPanel';
import { CreateTimeblockFlow } from './components/CreateTimeblockFlow';
import { TaskBuilderStep } from './components/TaskBuilderStep';
import { ChronotypeSelector } from './components/ChronotypeSelector';
import { chronotypeIconMap } from './components/chronotype-options';
import type { Chronotype, DayConfig, SavedTaskList, SavedTimeblock, ScheduleBlock, Task } from './types';
import { generateICS } from './ics';
import { createDateInTimeZone, DEVICE_TIME_ZONE } from './utils/timezone';
import { completeLiveTask } from './complete-live-task';
import { insertLiveTimerItem, reorderLiveTimer } from './insert-live-task';
import { generateSchedule } from './rhythmScheduler';
import { validateTimeblockPlan } from './timeblock-plan';
import { buildManualSchedule } from './utils/manualSchedule';
import { LiveTimerModal, LiveTimerPreview, type Timer } from './components/LiveTimer';
import { TimeblockWorkspace } from './components/TimeblockWorkspace';
import { NameListModal } from './components/task-dialogs';
import { changeTasks, updateTimeblockTask } from './task-spaces';
import './live-timer.css';
import './timeblock-flow.css';
import './plan-timeblock.css';
import './timeblock-workspace.css';
import './create-timeblock.css';
import './task-energy.css';

const today = new Date();
const todayStr = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0'),
].join('-');

function App({ section = "rhythm" }: { section?: string }) {
  const { spaces, taskLists: savedTaskLists, timeblocks: savedTimeblocks, liveTimer, save, setSavedTaskLists, setSavedTimeblocks, ready, error: storageError, reload } = useTaskWorkspace().library;
  const [timerOpen, setTimerOpen] = useState(false);
  const [startingTimer, setStartingTimer] = useState(false);
  const [modalTimer, setModalTimer] = useState<Timer | null>(null);
  const [renamingTimeblock, setRenamingTimeblock] = useState<SavedTimeblock | null>(null);

  const handleOpenTimeblockTimer = async (timeblock: SavedTimeblock) => {
    const isRunning = liveTimer != null && liveTimer.id === timeblock.id;
    if (isRunning) {
      setModalTimer(liveTimer);
    } else {
      const rawBlocks = timeblock.schedule ?? buildManualSchedule(timeblock.tasks, timeblock.dayConfig);
      const now = Date.now();
      let blocks = rawBlocks;
      if (rawBlocks.length > 0) {
        const firstStart = Date.parse(rawBlocks[0].start);
        if (firstStart <= now) {
          const delta = now + 5 * 60 * 1000 - firstStart;
          blocks = rawBlocks.map(b => ({
            ...b,
            start: new Date(Date.parse(b.start) + delta).toISOString(),
            end: new Date(Date.parse(b.end) + delta).toISOString(),
          }));
        }
      }
      const scheduledTimer: Timer = {
        id: timeblock.id,
        name: timeblock.name,
        timezone: timeblock.dayConfig.timezone,
        blocks,
        startedAt: blocks[0]?.start ?? createDateInTimeZone(timeblock.dayConfig.date, timeblock.dayConfig.startTime || '09:00', timeblock.dayConfig.timezone).toISOString(),
        endsAt: blocks[blocks.length - 1]?.end ?? createDateInTimeZone(timeblock.dayConfig.date, timeblock.dayConfig.endTime || '17:00', timeblock.dayConfig.timezone).toISOString(),
      };
      if (!blocks.length) return;
      const run = createTimeblockRun(scheduledTimer, timeblock.dayConfig.chronotype, timeblock.id);
      if (await save(data => launchTimeblockRun(data, scheduledTimer, run))) setModalTimer({...scheduledTimer,runId:run.id});
    }
  };

  const [dayConfig, setDayConfig] = useState<DayConfig>({
    date: todayStr,
    startTime: '09:00',
    endTime: '18:00',
    chronotype: 'Bear',
    timezone: DEVICE_TIME_ZONE,
  });

  const [tasks, setTasks] = useState<Task[]>([]);
  const [browseAllTasks, setBrowseAllTasks] = useState(false);
  const availableTasks = (spaces ?? []).map(space => ({
    ...space,
    tasks: space.tasks.filter(task => !task.isBreak && !task.completed),
    lists: savedTaskLists.filter(list => list.spaceId === space.id || (!list.spaceId && space.id === spaces?.[0]?.id))
      .map(list => ({ ...list, tasks: list.tasks.filter(task => !task.isBreak && !task.completed) })),
  }));
  const generatedPlanKey = useRef<string | null>(null);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const flowDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!showFlowModal) return;
    const trigger = document.activeElement as HTMLElement | null;
    flowDialog.current?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; trigger?.focus({preventScroll:true}); };
  }, [showFlowModal]);
  const [flowStep, setFlowStep] = useState<'chronotype' | 'tasks'>('tasks');
  const [flowContext, setFlowContext] = useState<'task-list' | 'timeblock'>(
    'task-list'
  );
  const [taskBuilderInitialStep, setTaskBuilderInitialStep] = useState<
    'tasks' | 'adjust' | 'range'
  >('tasks');
  const [taskFlowTheme, setTaskFlowTheme] = useState<'light' | 'dark'>('light');
  const [taskFlowStage, setTaskFlowStage] = useState<
    'tasks' | 'adjust' | 'range-select' | 'range-blocks' | 'range-export'
  >('tasks');
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      flowDialog.current?.querySelector('.flow-modal')?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [flowStep, taskFlowStage, showFlowModal]);

  const [activeTaskListId, setActiveTaskListId] = useState<string | null>(null);

  const [activeTimeblockId, setActiveTimeblockId] = useState<string | null>(null);
  const [timeblockSearch, setTimeblockSearch] = useState('');
  const [isTimeblockEditMode, setIsTimeblockEditMode] = useState(false);
  const [draftTimeRange, setDraftTimeRange] = useState<{
    startTime: string;
    endTime: string;
  } | null>(null);

  const filteredTimeblocks = useMemo(() => {
    if (!timeblockSearch.trim()) return savedTimeblocks;
    const query = timeblockSearch.toLowerCase();
    return savedTimeblocks.filter(block => block.name.toLowerCase().includes(query));
  }, [savedTimeblocks, timeblockSearch]);





  const handleAddTask = (task: Task) => {
    setTasks(prev => [...prev, task]);
  };

  const handleUpdateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  };

  const handleRemoveTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleReorderTasks = (nextOrder: Task[]) => {
    setTasks(nextOrder);
  };

  const handleExportTimeblocks = () => {
    if (!tasks.length) return;
    const scheduleBlocks = buildManualSchedule(tasks, dayConfig);
    if (!scheduleBlocks.length) return;
    const fileName = formatICSFileName(dayConfig.date);
    generateICS(scheduleBlocks, fileName, dayConfig.timezone);
  };

  const handleStartLiveTimer = async (exportCalendar = false) => {
    if (startingTimer) return;
    const blocks = buildManualSchedule(tasks, dayConfig);
    if (!blocks.length) return;
    setStartingTimer(true);
    const timer = {
      id: crypto.randomUUID(),
      name: savedTimeblocks.find(block => block.id === activeTimeblockId)?.name ?? "Today's Plan",
      timezone: dayConfig.timezone,
      blocks,
      startedAt: createDateInTimeZone(dayConfig.date, dayConfig.startTime, dayConfig.timezone).toISOString(),
      endsAt: createDateInTimeZone(dayConfig.date, dayConfig.endTime, dayConfig.timezone).toISOString(),
    };
    const run = createTimeblockRun(timer, dayConfig.chronotype, activeTimeblockId ?? undefined);
    const saved = await save(data => launchTimeblockRun(data, timer, run));
    setStartingTimer(false);
    if (!saved) return;
    if (exportCalendar) generateICS(blocks, formatICSFileName(dayConfig.date), dayConfig.timezone);
    closeFlowModal();
    setTimerOpen(true);
  };

  const handleCreatePlanningTask = async (task: Task, requestedSpaceId: string | null) => {
    return save(data => {
      const destination = data.spaces?.find(space => space.id === requestedSpaceId)
        ?? data.spaces?.find(space => space.name.toLowerCase() === 'general') ?? data.spaces?.[0];
      if (destination) return changeTasks(data, { spaceId: destination.id }, current => [...current, task]);
      return { ...data, spaces: [{ id: crypto.randomUUID(), name: 'General', icon: 'grid', color: '#9a9eff', createdAt: new Date().toISOString(), tasks: [task] }] };
    });
  };

  const finishTimeblock = async (blocks: ScheduleBlock[], launch: boolean, exportCalendar: boolean) => {
    if (startingTimer || !blocks.length || (!launch && !exportCalendar)) return;
    setStartingTimer(true);
    try {
      const existing = savedTimeblocks.find(block => block.id === activeTimeblockId);
      const id = existing?.id ?? crypto.randomUUID();
      const name = existing?.name ?? "Today's Plan";
      const timeblock: SavedTimeblock = { id, name, createdAt: existing?.createdAt ?? new Date().toISOString(), dayConfig: { ...dayConfig }, tasks, schedule: blocks };
      const timer: Timer = { id, name, timezone: dayConfig.timezone, blocks,
        startedAt: blocks[0].start, endsAt: blocks[blocks.length - 1].end };
      const run = launch ? createTimeblockRun(timer, dayConfig.chronotype, id) : undefined;
      const saved = await save(data => ({ ...(run ? launchTimeblockRun(data, timer, run) : data),
        timeblocks: existing ? data.timeblocks.map(block => block.id === id ? timeblock : block) : [timeblock, ...data.timeblocks],
      }));
      if (!saved) return;
      if (exportCalendar) generateICS(blocks, formatICSFileName(dayConfig.date), dayConfig.timezone);
      closeFlowModal();
      if (launch) setTimerOpen(true);
    } finally { setStartingTimer(false); }
  };

  const handleTimezoneChange = (timezone: string) => {
    setDayConfig(prev => ({ ...prev, timezone }));
  };

  const resetFlowVisualState = () => {
    setBrowseAllTasks(false);
    generatedPlanKey.current = null;
    setTaskFlowStage('tasks');
    setTaskFlowTheme('light');
    setTaskBuilderInitialStep('tasks');
  };

  const closeFlowModal = () => {
    setShowFlowModal(false);
    setFlowStep('tasks');
    setFlowContext('task-list');
    setTasks([]);
    setActiveTaskListId(null);
    setActiveTimeblockId(null);
    setDraftTimeRange(null);
    resetFlowVisualState();
  };

  const handleChronotypeSelect = (ct: Chronotype) => {
    setDayConfig(prev => ({ ...prev, chronotype: ct }));
  };

  const handleGenerateTimeblock = () => {
    if (!validateTimeblockPlan(tasks, dayConfig.startTime, dayConfig.endTime).valid) return;
    // Going back without changing the inputs preserves manual rearrangements.
    const key = JSON.stringify({ tasks: [...tasks].sort((a, b) => a.id.localeCompare(b.id)), dayConfig });
    if (generatedPlanKey.current !== key) {
      // The existing scheduler consumes durations on its working task objects.
      const schedule = generateSchedule(tasks.map(task => ({ ...task })), dayConfig);
      const ids = [...new Set(schedule.map(block => block.taskId))];
      const tasksById = new Map(tasks.map(task => [task.id, task]));
      const ordered = ids.flatMap(id => tasksById.has(id) ? [tasksById.get(id)!] : []);
      setTasks([...ordered, ...tasks.filter(task => !ids.includes(task.id))]);
      generatedPlanKey.current = key;
    }
    setTaskBuilderInitialStep('range');
    setFlowStep('tasks');
  };

  const handleStartNewTimeblock = () => {
    resetFlowVisualState();
    setBrowseAllTasks(true);
    setFlowContext('timeblock');
    setFlowStep('tasks');
    setTaskBuilderInitialStep('adjust');
    setActiveTaskListId(null);
    setActiveTimeblockId(null);
    setTasks([]);
    setDraftTimeRange(null);
    setShowFlowModal(true);
  };

  const handleLoadSavedTimeblock = (target: string | SavedTimeblock) => {
    let block: SavedTimeblock | undefined;
    if (typeof target !== 'string') {
      block = target;
    } else {
      block = savedTimeblocks.find(tb => tb.id === target || tb.name === target);
      if (!block && liveTimer && (liveTimer.id === target || liveTimer.name === target)) {
        const now = new Date();
        const todayString = [
          now.getFullYear(),
          String(now.getMonth() + 1).padStart(2, '0'),
          String(now.getDate()).padStart(2, '0'),
        ].join('-');
        block = {
          id: liveTimer.id,
          name: liveTimer.name,
          createdAt: liveTimer.startedAt ?? new Date().toISOString(),
          dayConfig: {
            date: todayString,
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
              durationMinutes: (Date.parse(b.end) - Date.parse(b.start)) / 60000,
              energyRequired: (Math.max(1, Math.min(5, Math.round(b.energyRequired || 3))) as 1 | 2 | 3 | 4 | 5),
              priority: 1,
            })),
        };
      }
    }
    if (!block) return;
    setFlowContext('timeblock');
    resetFlowVisualState();
    setActiveTaskListId(null);
    setActiveTimeblockId(block.id);
    setTasks(block.tasks.map(task => ({ ...task })));
    setDayConfig(prev => ({
      ...block.dayConfig,
      date: prev.date,
    }));
    setDraftTimeRange({
      startTime: block.dayConfig.startTime,
      endTime: block.dayConfig.endTime,
    });
    setTaskBuilderInitialStep('adjust');
    setFlowStep('tasks');
    setShowFlowModal(true);
  };

  const handleDeleteTimeblock = async (timeblockId: string) => {
    if (typeof window === 'undefined') return;
    const isLive = liveTimer != null && (liveTimer.id === timeblockId || liveTimer.name === timeblockId);
    const block = savedTimeblocks.find(item => item.id === timeblockId) || (isLive ? { id: liveTimer!.id, name: liveTimer!.name } : null);
    if (!block) return;
    const shouldDelete = window.confirm(`Delete "${block.name}"?`);
    if (!shouldDelete) return;

    if (isLive) {
      await save(d => ({
        ...d,
        liveTimer: undefined,
        runs: d.runs?.filter(run => run.timeblockId !== timeblockId && run.id !== d.liveTimer?.runId),
        timeblocks: d.timeblocks.filter(item => item.id !== timeblockId),
      }));
    } else {
      await save(d => ({...d, timeblocks:d.timeblocks.filter(item=>item.id!==timeblockId),runs:d.runs?.filter(run=>run.timeblockId!==timeblockId)}));
    }
    setActiveTimeblockId(current => (current === timeblockId ? null : current));
  };

  const handleLoadSavedTaskList = (taskListId: string) => {
    const list = savedTaskLists.find(item => item.id === taskListId);
    if (!list) return;
    setFlowContext('task-list');
    resetFlowVisualState();
    setFlowStep('tasks');
    setTaskBuilderInitialStep('tasks');
    setActiveTimeblockId(null);
    setActiveTaskListId(list.id);
    setTasks(list.tasks.map(task => ({ ...task })));
    setDraftTimeRange(null);
    setShowFlowModal(true);
  };

  const handleDeleteTaskList = (taskListId: string) => {
    const list = savedTaskLists.find(item => item.id === taskListId);
    if (!list || typeof window === 'undefined') return;
    const shouldDelete = window.confirm(`Delete "${list.name}"?`);
    if (!shouldDelete) return;
    setSavedTaskLists(prev => prev.filter(item => item.id !== taskListId));
    setActiveTaskListId(current => (current === taskListId ? null : current));
  };

  const handleTimeblockSavedTaskList = (taskListId: string) => {
    const list = savedTaskLists.find(item => item.id === taskListId);
    if (!list) return;
    resetFlowVisualState();
    setFlowContext('timeblock');
    setFlowStep('tasks');
    setTaskBuilderInitialStep('adjust');
    setActiveTaskListId(list.id);
    setActiveTimeblockId(null);
    setTasks(list.tasks.filter(task => !task.completed).map(task => ({ ...task })));
    setDraftTimeRange(null);
    setShowFlowModal(true);
  };

  const handleSaveTaskList = async () => {
    if (!tasks.length) return;
    const existing = activeTaskListId
      ? savedTaskLists.find(list => list.id === activeTaskListId)
      : null;
    const defaultName =
      existing?.name ||
      `Task List ${new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}`;
    if (typeof window === 'undefined') return;
    const nameInput = window.prompt('Name this task list', defaultName);
    if (nameInput === null) return;
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const payload: SavedTaskList = {
      spaceId: existing?.spaceId,
      id: existing?.id ?? crypto.randomUUID(),
      name: trimmed,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      tasks: tasks.map(task => ({ ...task })),
    };
    const saved = await setSavedTaskLists(prev => {
      if (existing) {
        return prev.map(list => (list.id === payload.id ? payload : list));
      }
      return [payload, ...prev];
    });
    if (saved) closeFlowModal();
  };

  const handleTimeblockTaskList = () => {
    if (!tasks.length) return;
    setFlowContext('timeblock');
    setActiveTimeblockId(null);
    setTaskFlowStage('adjust');
    setTaskFlowTheme('dark');
    setTaskBuilderInitialStep('adjust');
    setDraftTimeRange(null);
    setFlowStep('tasks');
  };

  const handleSaveCurrentTimeblock = async () => {
    if (!tasks.length) return;
    const existing = activeTimeblockId
      ? savedTimeblocks.find(tb => tb.id === activeTimeblockId)
      : null;
    const defaultName =
      existing?.name ||
      `Timeblock ${new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })}`;
    if (typeof window === 'undefined') return;
    const nameInput = window.prompt('Name this timeblock', defaultName);
    if (nameInput === null) return;
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    const payload: SavedTimeblock = {
      id: existing?.id ?? crypto.randomUUID(),
      name: trimmed,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      dayConfig: { ...dayConfig },
      tasks: tasks.map(task => ({ ...task })),
    };
    const saved = await setSavedTimeblocks(prev => {
      if (existing) {
        return prev.map(block => (block.id === payload.id ? payload : block));
      }
      return [payload, ...prev];
    });
    if (saved) closeFlowModal();
  };

  const modalThemeClass =
    flowStep === 'chronotype'
      ? 'modal-chronotype'
      : taskFlowTheme === 'dark'
      ? 'modal-task'
      : 'modal-chronotype';
  const modalSize =
    flowStep === 'chronotype'
      ? 'compact'
      : taskFlowStage === 'tasks'
      ? 'roomy'
      : taskFlowStage === 'adjust'
      ? 'expanded'
      : taskFlowStage === 'range-select'
      ? 'tall'
      : taskFlowStage === 'range-blocks'
      ? 'xl'
      : taskFlowStage === 'range-export'
      ? 'calendar'
      : 'roomy';

  if (!ready) return <div className="platform-notice" role="status">{storageError || 'Loading your planning space…'}{storageError && <button onClick={reload}>Try again</button>}</div>;
  return (
    <div className="app">
      {storageError && <div className="platform-notice" role="alert">{storageError}</div>}
      <div className="app-main">
        {section === "rhythm-timeblocks" ? (
          <TimeblockWorkspace
            timeblocks={savedTimeblocks}
            liveTimer={liveTimer}
            onAddTimeblock={handleStartNewTimeblock}
            onOpenTimer={handleOpenTimeblockTimer}
            onRenameTimeblock={(tb) => setRenamingTimeblock(tb)}
            onEditTimeblock={(tb) => handleLoadSavedTimeblock(tb)}
            onDeleteTimeblock={handleDeleteTimeblock}
            onUpdateTask={async (timeblockId, taskId, updates) => {
              return await save((data) =>
                updateTimeblockTask(data, timeblockId, taskId, updates)
              );
            }}
            onDeleteTask={async (timeblockId, taskId) => {
              return await save((data) => ({
                ...data,
                timeblocks: data.timeblocks.map((b) =>
                  b.id === timeblockId
                    ? { ...b, schedule: undefined, tasks: b.tasks.filter((t) => t.id !== taskId) }
                    : b
                ),
              }));
            }}
          />
        ) : (
          <section
            className={`dashboard-shell${
              section === "rhythm-tasks" ? " single-panel" : ""
            }`}
            aria-label="Rhythm dashboard"
          >
            {section !== "rhythm-timeblocks" && (
              <TasksPanel
                onTimeblock={handleTimeblockSavedTaskList}
                onEditList={handleLoadSavedTaskList}
                onDeleteList={handleDeleteTaskList}
              />
            )}

            {section !== "rhythm-tasks" && (
              <aside className="timeblocks-panel" id="rhythm-timeblocks">
                <div className="dashboard-header">
                  <div className="timeblocks-title-row">
                    <div>
                      <p className="section-kicker">Timeblocks</p>
                      <h1>Saved and in-progress timeblocking plans appear here</h1>
                    </div>
                    <button
                      type="button"
                      className={`timeblock-edit-toggle${
                        isTimeblockEditMode ? " active" : ""
                      }`}
                      aria-pressed={isTimeblockEditMode}
                      onClick={() => setIsTimeblockEditMode((current) => !current)}
                    >
                      <span>{isTimeblockEditMode ? "Done" : "Edit"}</span>
                      <EditIcon />
                    </button>
                  </div>
                  <label className="dashboard-search compact">
                    <span className="sr-only">Search timeblocks</span>
                    <input
                      type="search"
                      placeholder="Search Timeblocks"
                      value={timeblockSearch}
                      onChange={(e) => setTimeblockSearch(e.target.value)}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="add-timeblock-card"
                  onClick={handleStartNewTimeblock}
                >
                  <GridIcon />
                  <span>Add Timeblock</span>
                </button>

                <div className="timeblock-stack">
                  {filteredTimeblocks.map((block) => {
                    return (
                      <article
                        key={block.id}
                        className={`timeblock-rail-card${
                          isTimeblockEditMode ? " editing" : ""
                        }`}
                        onClick={() => {
                          handleLoadSavedTimeblock(block.id);
                        }}
                      >
                        <span className="chronotype-mark" aria-hidden="true">
                          {chronotypeIconMap[block.dayConfig.chronotype]}
                        </span>
                        <div className="timeblock-copy">
                          <p className="card-eyebrow">
                            {block.dayConfig.chronotype}
                          </p>
                          <h2>{block.name}</h2>
                          <p>
                            {formatTimeWindow(
                              block.dayConfig.startTime,
                              block.dayConfig.endTime
                            )}
                          </p>
                        </div>
                        <div className="timeblock-control-group">
                          <div className="timeblock-metrics">
                            <MetaChip
                              icon={<FileIcon />}
                              label={`${block.tasks.length} tasks`}
                            />
                            <MetaChip
                              icon={<ClockIcon />}
                              label={formatMinutesFromTasks(block.tasks)}
                            />
                          </div>
                          <button
                            type="button"
                            className="timeblock-delete-button"
                            aria-label={`Delete ${block.name}`}
                            tabIndex={isTimeblockEditMode ? 0 : -1}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteTimeblock(block.id);
                            }}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                  {!filteredTimeblocks.length && (
                    <p className="dashboard-empty">
                      {timeblockSearch.trim()
                        ? "No matching timeblocks."
                        : "No saved timeblocks yet."}
                    </p>
                  )}
                </div>
              </aside>
            )}
          </section>
        )}
      </div>
      {showFlowModal && (
        <dialog ref={flowDialog} className={`flow-modal-backdrop${flowContext === 'timeblock' ? ' tb-backdrop' : ''}`} aria-label={flowContext === 'task-list' ? 'Build a task list' : 'Create a timeblock'} onCancel={e => { e.preventDefault(); if (!startingTimer) closeFlowModal(); }}>
          <div className={flowContext === 'timeblock' ? 'tb-shell' : `flow-modal flow-unified ${modalThemeClass}`} data-modal-size={modalSize}>
            {flowContext === 'timeblock' ? (
              <CreateTimeblockFlow tasks={tasks} spaces={availableTasks} config={dayConfig} busy={startingTimer} error={storageError}
                onTasksChange={setTasks} onConfigChange={setDayConfig} onCreateTask={handleCreatePlanningTask}
                onFinish={finishTimeblock} onClose={closeFlowModal} />
            ) : flowStep === 'chronotype' ? (
              <div className="task-step chronotype-step">
                <div className="task-step-header">
                  <div>
                    <p className="eyebrow">Create a Timeblock</p>
                    <h3>Choose your Rhythm</h3>
                    <p className="task-step-subhead">
                      How does your energy flow through the day?
                    </p>
                  </div>
                  <div className="task-header-actions">
                    <button className="task-step-done" onClick={closeFlowModal}>
                      Cancel
                    </button>
                    <button className="task-remove-toggle" onClick={() => { setTaskBuilderInitialStep('adjust'); setFlowStep('tasks'); }}>Back</button>
                    <button className="task-step-primary" onClick={handleGenerateTimeblock}>
                      Next
                    </button>
                  </div>
                </div>

                <ChronotypeSelector value={dayConfig.chronotype} onChange={handleChronotypeSelect} />
              </div>
            ) : (
              <TaskBuilderStep
                key={`${flowContext}:${taskBuilderInitialStep}`}
                tasks={tasks}
                availableTasks={browseAllTasks ? availableTasks : undefined}
                chronotype={dayConfig.chronotype}
                date={dayConfig.date}
                onAdd={handleAddTask}
                onUpdate={handleUpdateTask}
                onRemove={handleRemoveTask}
                onReorder={handleReorderTasks}
                timeZone={dayConfig.timezone}
                onTimeZoneChange={handleTimezoneChange}
                onExport={handleExportTimeblocks}
                onStartLiveTimer={handleStartLiveTimer}
                startingTimer={startingTimer}
                startTime={draftTimeRange?.startTime ?? ''}
                endTime={draftTimeRange?.endTime ?? ''}
                onRangeChange={(startTime, endTime) => {
                  setDraftTimeRange({ startTime, endTime });
                  setDayConfig(prev => ({ ...prev, startTime, endTime }));
                }}
                onDone={closeFlowModal}
                onPlanNext={() => setFlowStep('chronotype')}
                onScheduleBack={() => setFlowStep('chronotype')}
                onThemeChange={setTaskFlowTheme}
                onStageChange={setTaskFlowStage}
                mode={flowContext}
                initialStep={taskBuilderInitialStep}
                onSaveTaskList={flowContext === 'task-list' ? handleSaveTaskList : undefined}
                onStartTimeblock={
                  flowContext === 'task-list' ? handleTimeblockTaskList : undefined
                }
                onSaveTimeblock={undefined}
              />
            )}
          </div>
        </dialog>
      )}
      {modalTimer && (
        <LiveTimerModal
          onTimeWindowChange={liveTimer && liveTimer.id === modalTimer.id ? (newEndTime, now) => { const command = createRunCommand(); return save(library => updateLiveTimerTimeWindow({library,timerId:liveTimer.id,newEndTime,now,command})); } : undefined}
          timer={liveTimer && liveTimer.id === modalTimer.id ? liveTimer : modalTimer}
          onClose={() => {
            setTimerOpen(false);
            setModalTimer(null);
          }}
          error={storageError}
          onComplete={(taskId, now, outcome) => {
            const currentId = modalTimer.id;
            if (liveTimer && liveTimer.id === currentId) {
              const command = createRunCommand();
              return save(data => completeLiveTask(data, liveTimer.id, taskId, now, outcome, command));
            }
            return Promise.resolve(false);
          }}
          onInsertItem={
            liveTimer && liveTimer.id === modalTimer.id
              ? (params, now) => { const command = createRunCommand(); return save(data => insertLiveTimerItem(data, liveTimer.id, params, now, command)); }
              : undefined
          }
          onReorderBlocks={
            liveTimer && liveTimer.id === modalTimer.id
              ? (fromIndex, toIndex, now) => { const command = createRunCommand(); return save(data => reorderLiveTimer(data, liveTimer.id, fromIndex, toIndex, now, command)); }
              : undefined
          }
        />
      )}
      {!modalTimer && timerOpen && liveTimer && (
        <LiveTimerModal
          timer={liveTimer}
          onTimeWindowChange={(newEndTime, now) => { const command = createRunCommand(); return save(library => updateLiveTimerTimeWindow({library,timerId:liveTimer.id,newEndTime,now,command})); }}
          onClose={() => setTimerOpen(false)}
          error={storageError}
          onComplete={(taskId, now, outcome) => { const command = createRunCommand(); return save(data => completeLiveTask(data, liveTimer.id, taskId, now, outcome, command)); }}
          onInsertItem={(params, now) => { const command = createRunCommand(); return save(data => insertLiveTimerItem(data, liveTimer.id, params, now, command)); }}
          onReorderBlocks={(fromIndex, toIndex, now) => { const command = createRunCommand(); return save(data => reorderLiveTimer(data, liveTimer.id, fromIndex, toIndex, now, command)); }}
        />
      )}
      {renamingTimeblock && (
        <NameListModal
          name={renamingTimeblock.name}
          error={storageError}
          onClose={() => setRenamingTimeblock(null)}
          onSave={async (newName) => {
            const ok = await save((data) => ({
              ...data,
              timeblocks: data.timeblocks.map((b) =>
                b.id === renamingTimeblock.id ? { ...b, name: newName } : b
              ),
              liveTimer:
                data.liveTimer &&
                (data.liveTimer.id === renamingTimeblock.id ||
                  data.liveTimer.name === renamingTimeblock.name)
                  ? { ...data.liveTimer, name: newName }
                  : data.liveTimer,
            }));
            if (ok) setRenamingTimeblock(null);
            return ok;
          }}
        />
      )}
    </div>
  );
}

function MetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="meta-chip">
      {icon}
      <span>{label}</span>
    </span>
  );
}

function ListIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 29 29" aria-hidden="true" focusable="false">
      <path d="M18.8015 23.4996H12.9265M25.8515 23.4996H23.5015M19.9765 14.0996H25.8515H12.9265H15.2765M18.8015 4.69959H12.9265M25.8515 4.69959H23.5015M4.70157 11.7496H4.23157C3.57351 11.7496 3.24447 11.7496 2.99313 11.8777C2.77204 11.9903 2.59229 12.1701 2.47963 12.3912C2.35157 12.6425 2.35157 12.9715 2.35157 13.6296V14.5696C2.35157 15.2277 2.35157 15.5567 2.47963 15.808C2.59229 16.0291 2.77204 16.2089 2.99313 16.3215C3.24447 16.4496 3.57351 16.4496 4.23157 16.4496H5.17157C5.82963 16.4496 6.15866 16.4496 6.41001 16.3215C6.6311 16.2089 6.81085 16.0291 6.9235 15.808C7.05157 15.5567 7.05157 15.2277 7.05157 14.5696V14.0996M5.17157 21.1496H4.23157C3.57351 21.1496 3.24447 21.1496 2.99313 21.2777C2.77204 21.3903 2.59229 21.5701 2.47963 21.7912C2.35157 22.0425 2.35157 22.3715 2.35157 23.0296V23.9696C2.35157 24.6277 2.35157 24.9567 2.47963 25.208C2.59229 25.4291 2.77204 25.6089 2.99313 25.7215C3.24447 25.8496 3.57351 25.8496 4.23157 25.8496H5.17157C5.82963 25.8496 6.15866 25.8496 6.41001 25.7215C6.6311 25.6089 6.81085 25.4291 6.9235 25.208C7.05157 24.9567 7.05157 24.6277 7.05157 23.9696V23.0296C7.05157 22.3715 7.05157 22.0425 6.9235 21.7912C6.81085 21.5701 6.6311 21.3903 6.41001 21.2777C6.15866 21.1496 5.82963 21.1496 5.17157 21.1496ZM4.23157 7.04961H5.17157C5.82963 7.04961 6.15866 7.04961 6.41001 6.92154C6.6311 6.80889 6.81085 6.62914 6.9235 6.40805C7.05157 6.1567 7.05157 5.82767 7.05157 5.16961V4.22961C7.05157 3.57155 7.05157 3.24252 6.9235 2.99117C6.81085 2.77008 6.6311 2.59033 6.41001 2.47768C6.15866 2.34961 5.82963 2.34961 5.17157 2.34961H4.23157C3.57351 2.34961 3.24447 2.34961 2.99313 2.47768C2.77204 2.59033 2.59229 2.77008 2.47963 2.99117C2.35157 3.24252 2.35157 3.57155 2.35157 4.22961V5.16961C2.35157 5.82767 2.35157 6.1567 2.47963 6.40805C2.59229 6.62914 2.77204 6.80889 2.99313 6.92154C3.24447 7.04961 3.57351 7.04961 4.23157 7.04961Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m13 2-8 12h6l-1 8 8-12h-6z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L8 20H4v-4z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z" />
    </svg>
  );
}

function ChevronIcon({ flipped = false }: { flipped?: boolean }) {
  return (
    <svg
      className={`chevron-icon${flipped ? ' flipped' : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function formatICSFileName(date: string): string {
  // date: "YYYY-MM-DD"
  const [year, month, day] = date.split('-');
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthIdx = Number(month) - 1;
  const monthName = monthNames[monthIdx] || month;
  return `${day}_${monthName}_${year}_Rhythm.ics`;
}

function formatMinutesFromTasks(tasks: Task[]): string {
  const total = tasks.reduce((sum, task) => sum + task.durationMinutes, 0);
  return formatMinutesValue(total);
}

function formatMinutesValue(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

function formatTimeWindow(start: string, end: string): string {
  return `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
}

function formatTimeLabel(value: string): string {
  const [rawHour, rawMinute] = value.split(':').map(Number);
  if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
  const period = rawHour >= 12 ? 'PM' : 'AM';
  const displayHour = rawHour % 12 === 0 ? 12 : rawHour % 12;
  return `${displayHour}:${String(rawMinute).padStart(2, '0')} ${period}`;
}




export default App;

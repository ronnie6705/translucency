"use client";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { AudioLines, LayoutDashboard, ListTodo, CalendarDays, Circle, Settings, PanelLeftClose, PanelLeftOpen, Menu, X, LockKeyhole, Plus, CircleCheck, ChevronDown } from "lucide-react";
import { useTaskWorkspace } from "@/modules/rhythm/task-workspace";
import { SpaceIcon } from "@/modules/rhythm/components/space-icons";
import type { Page } from "./app";
import { activeAccount } from '@/lib/cloud/storage';

const planLinks = [
  { id: "rhythm", label: "Planning space", icon: LayoutDashboard },
  { id: "rhythm-tasks", label: "Tasks", icon: ListTodo },
  { id: "rhythm-timeblocks", label: "Timeblocks", icon: CalendarDays },
] as const;

export function PlatformShell({ page, go, name, children }: { page: Page; go: (page: Page) => void; name?: string; children: ReactNode }) {
  const tasks = useTaskWorkspace();
  const [pinned, setPinned] = useState(false);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const rail = useRef<HTMLElement>(null);
  const links = planLinks;
  useEffect(() => {
    try { setTasksExpanded(localStorage.getItem("platform:tasks-expanded") !== "false"); } catch { /* preference only */ }
    try { setPinned(localStorage.getItem("platform:sidebar-pinned") === "true"); } catch { /* preference only */ }
  }, []);
  useEffect(() => {
    if (!mobile) return;
    const first = rail.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMobile(false); trigger.current?.focus(); }
      if (event.key === "Tab") {
        const items = Array.from(rail.current?.querySelectorAll<HTMLElement>("a,button") ?? []).filter(el => el.getClientRects().length);
        const first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = before; document.removeEventListener("keydown", key); };
  }, [mobile]);
  const navigate = (target: Page) => { setMobile(false); go(target); };
  const toggleTasks = () => {
    const next = !tasksExpanded;
    setTasksExpanded(next);
    try { localStorage.setItem("platform:tasks-expanded", String(next)); } catch { /* preference only */ }
  };
  const handleTasksClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const onAllTasks = page === "rhythm-tasks" && !tasks.activeSpaceId && !tasks.showCompleted;
    if (onAllTasks) {
      toggleTasks();
    } else {
      tasks.selectSpace(null);
      navigate("rhythm-tasks");
      if (!tasksExpanded) {
        setTasksExpanded(true);
        try { localStorage.setItem("platform:tasks-expanded", "true"); } catch { /* preference only */ }
      }
    }
  };
  const handleTasksKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === " " || e.key === "Spacebar") && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      handleTasksClick(e as unknown as React.MouseEvent);
    }
  };
  const expanded = pinned || hover || focused || mobile;
  return (
    <div className={`platform-shell ${pinned ? "rail-pinned" : ""}`}>
      <a className="platform-skip" href="#main">Skip to content</a>
      {mobile && <button className="rail-scrim" tabIndex={-1} aria-label="Close navigation" onClick={() => { setMobile(false); trigger.current?.focus(); }} />}
      <aside ref={rail} id="product-navigation" className={`product-rail ${expanded ? "expanded" : ""} ${mobile ? "mobile-open" : ""}`}
        aria-label="Product navigation" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
        <div className="rail-brand"><span className="platform-mark"><AudioLines size={23} /></span><span className="rail-label">Rhythm<span className="rail-brand-caption">PLAN. FOCUS. LIVE.</span></span></div>
        <div className="rail-section-label rail-label">YOUR DAY</div>
        <nav aria-label="Rhythm navigation" className="module-navigation">
          {links.map(({ id, label, icon: Icon }) => <Fragment key={id}>{id === "rhythm-tasks" ? <a href="#rhythm-tasks" className={`rail-tasks-toggle ${page === "rhythm-tasks" && !tasks.activeSpaceId && !tasks.showCompleted ? "active" : ""}`} title="Tasks" aria-label="Tasks" aria-expanded={tasksExpanded} aria-controls="rail-task-children" aria-current={page === "rhythm-tasks" && !tasks.activeSpaceId && !tasks.showCompleted ? "page" : undefined} onClick={handleTasksClick} onKeyDown={handleTasksKeyDown}><Icon size={18} /><span className="rail-label">{label}</span><ChevronDown className="rail-tasks-chevron rail-label" size={16} aria-hidden="true" /></a > : <a href={`#${id}`} title={label} aria-label={label} className={page === id ? "active" : ""} aria-current={page === id ? "page" : undefined} onClick={e => { e.preventDefault(); navigate(id); }}><Icon size={18} /><span className="rail-label">{label}</span></a>}{id === 'rhythm-tasks' && <div id="rail-task-children" hidden={!tasksExpanded} className="rail-spaces" role="group" aria-label="Task spaces and views">{tasks.library.spaces?.map(space=><a key={space.id} href="#rhythm-tasks" title={space.name} aria-label={space.name} className={tasks.activeSpaceId===space.id?'active':''} aria-current={tasks.activeSpaceId===space.id?'page':undefined} onClick={e=>{e.preventDefault();tasks.selectSpace(space.id);navigate('rhythm-tasks');}}><SpaceIcon icon={space.icon} color={space.color}/><span className="rail-label">{space.name}</span></a>)}<a href="#rhythm-tasks" title="Completed" aria-label="Completed" className={page === "rhythm-tasks" && tasks.showCompleted ? "active" : ""} aria-current={page === "rhythm-tasks" && tasks.showCompleted ? "page" : undefined} onClick={e => { e.preventDefault(); tasks.selectCompleted(); navigate("rhythm-tasks"); }}><CircleCheck size={18}/><span className="rail-label">Completed</span></a><button title="Add New Space" aria-label="Add New Space" onClick={()=>{setMobile(false);tasks.openSpace();}}><Plus size={18}/><span className="rail-label">Add New Space</span></button></div>}</Fragment>)}
        </nav>
        <div className="rail-bottom">
          <a href="#settings" title="Settings & privacy" aria-label="Settings & privacy" onClick={e => { e.preventDefault(); navigate("settings"); }}><Settings size={19} /><span className="rail-label">Settings & privacy</span></a>
          <button className="rail-pin" title={pinned ? "Unpin sidebar" : "Pin sidebar open"} aria-label={pinned ? "Unpin sidebar" : "Pin sidebar open"} aria-pressed={pinned} onClick={() => { const next = !pinned; setPinned(next); try { localStorage.setItem("platform:sidebar-pinned", String(next)); } catch { /* preference only */ } }}>
            {pinned ? <PanelLeftClose size={19} /> : <PanelLeftOpen size={19} />}<span className="rail-label">{pinned ? "Collapse sidebar" : "Keep sidebar open"}</span>
          </button>
          <button className="rail-mobile-close" aria-label="Close menu" onClick={() => { setMobile(false); trigger.current?.focus(); }}><X size={19} /><span>Close menu</span></button>
        </div>
      </aside>
      <div className="platform-workspace" inert={mobile || undefined}>
        <header className="platform-topbar">
          <button ref={trigger} className="platform-menu" aria-label="Open navigation" aria-expanded={mobile} aria-controls="product-navigation" onClick={() => setMobile(true)}><Menu size={22} /></button>
          <div className="platform-breadcrumb">Rhythm<span>/</span><strong>{page === "settings" || page === "privacy" ? "Settings" : "Planning"}</strong></div>
          <span className="platform-private"><LockKeyhole size={13} /> {activeAccount() ? 'Account workspace' : 'Only on this device'}</span>
          <button className="platform-avatar" aria-label="Open settings" onClick={() => go("settings")}>{name?.[0]?.toUpperCase() || <Circle size={17} />}</button>
        </header>
        {children}
      </div>
    </div>
  );
}

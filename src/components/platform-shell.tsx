"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AudioLines, Layers2, LayoutDashboard, ListTodo, CalendarDays, Feather, History, Sparkles, Droplets, Leaf, Circle, Settings, PanelLeftClose, PanelLeftOpen, Menu, X, LockKeyhole, Plus } from "lucide-react";
import type { Page } from "./app";
import { activeAccount } from '@/lib/cloud/storage';

const reflectLinks = [
  { id: "home", label: "Overview", icon: LayoutDashboard },
  { id: "check-in", label: "Check-in", icon: Plus },
  { id: "roles", label: "Perspectives", icon: Feather },
  { id: "journey", label: "Journey", icon: History },
  { id: "insights", label: "Insights", icon: Sparkles },
  { id: "water", label: "Water sources", icon: Droplets },
  { id: "drying", label: "Drying sources", icon: Leaf },
  { id: "signals", label: "Optional signals", icon: Circle },
] as const;
const planLinks = [
  { id: "rhythm", label: "Planning space", icon: LayoutDashboard },
  { id: "rhythm-tasks", label: "Task lists", icon: ListTodo },
  { id: "rhythm-timeblocks", label: "Timeblocks", icon: CalendarDays },
] as const;

export function PlatformShell({ page, reflectionPage, go, name, children }: { page: Page; reflectionPage: Page; go: (page: Page) => void; name?: string; children: ReactNode }) {
  const [pinned, setPinned] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const rail = useRef<HTMLElement>(null);
  const rhythm = page.startsWith("rhythm");
  const links = rhythm ? planLinks : reflectLinks;
  useEffect(() => {
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
  const expanded = pinned || hover || focused || mobile;
  return (
    <div className={`platform-shell ${pinned ? "rail-pinned" : ""}`}>
      <a className="platform-skip" href="#main">Skip to content</a>
      {mobile && <button className="rail-scrim" tabIndex={-1} aria-label="Close navigation" onClick={() => { setMobile(false); trigger.current?.focus(); }} />}
      <aside ref={rail} id="product-navigation" className={`product-rail ${expanded ? "expanded" : ""} ${mobile ? "mobile-open" : ""}`}
        aria-label="Product navigation" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onFocusCapture={() => setFocused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
        <div className="rail-brand"><span className="platform-mark"><AudioLines size={23} /></span><span className="rail-label">Your space<span className="rail-brand-caption">REFLECT. PLAN. LIVE.</span></span></div>
        <div className="rail-section-label rail-label">YOUR APPS</div>
        <nav aria-label="Switch app" className="product-switcher">
          <a href={`#${reflectionPage}`} title="Translucency" aria-label="Translucency" aria-current={!rhythm ? "true" : undefined} className={!rhythm ? "selected" : ""} onClick={e => { e.preventDefault(); navigate(reflectionPage); }}>
            <span className="product-icon"><Layers2 size={22} /></span><span className="rail-label">Translucency<small>A little perspective</small></span>
          </a>
          <a href="#rhythm" title="Rhythm" aria-label="Rhythm" aria-current={rhythm ? "true" : undefined} className={rhythm ? "selected" : ""} onClick={e => { e.preventDefault(); navigate("rhythm"); }}>
            <span className="product-icon"><AudioLines size={23} /></span><span className="rail-label">Rhythm<small>Find your flow</small></span>
          </a>
        </nav>
        <div className="rail-divider" />
        <div className="rail-section-label rail-label">{rhythm ? "YOUR DAY" : "YOUR PERSPECTIVE"}</div>
        <nav aria-label={rhythm ? "Rhythm navigation" : "Translucency navigation"} className="module-navigation">
          {links.map(({ id, label, icon: Icon }) => <a key={id} href={`#${id}`} title={label} aria-label={label} className={page === id ? "active" : ""} aria-current={page === id ? "page" : undefined} onClick={e => { e.preventDefault(); navigate(id); }}><Icon size={18} /><span className="rail-label">{label}</span></a>)}
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
          <div className="platform-breadcrumb">Your space<span>/</span><strong>{rhythm ? "Rhythm" : "Translucency"}</strong></div>
          <span className="platform-private"><LockKeyhole size={13} /> {activeAccount() ? 'Account workspace' : 'Only on this device'}</span>
          <button className="platform-avatar" aria-label="Open settings" onClick={() => go("settings")}>{name?.[0]?.toUpperCase() || <Circle size={17} />}</button>
        </header>
        {children}
      </div>
    </div>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlatformShell } from "./platform-shell";
import { TaskWorkspaceProvider } from "@/modules/rhythm/task-workspace";
import Rhythm from "@/modules/rhythm/App";
import { RhythmDataSettings } from "@/modules/rhythm/data-settings";
import { AccountControls } from "./account";
export type Page = "rhythm" | "rhythm-tasks" | "rhythm-timeblocks" | "settings" | "privacy";
const pages: readonly string[] = ["rhythm", "rhythm-tasks", "rhythm-timeblocks", "settings", "privacy"];
export default function App() {
  const [page, setPage] = useState<Page>("rhythm");
  const [notice, setNotice] = useState("");
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const hash = () => {
      const value = location.hash.slice(1);
      // Keep the skip link working; retired reflection links open planning.
      if (value === "main") return;
      const next = pages.includes(value) ? value as Page : "rhythm";
      setPage(next);
      if (value !== next) history.replaceState(null, "", `#${next}`);
    };
    hash();
    window.addEventListener("hashchange", hash);
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => setNotice("Offline support could not start. You can still use the app while connected."));
      } else {
        navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(reg => void reg.unregister()));
      }
    }
    return () => window.removeEventListener("hashchange", hash);
  }, []);
  const go = useCallback((target: Page) => {
    location.hash = target;
    setPage(target);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => main.current?.focus({preventScroll: true}));
  }, []);
  const settings = page === "settings" || page === "privacy";
  return <TaskWorkspaceProvider page={page}><PlatformShell page={page} go={go}>
    <main id="main" ref={main} tabIndex={-1} className="platform-main">
      <AccountControls />
      <div hidden={settings} className="rhythm-module">
        {page === "rhythm" && <header className="module-heading"><p>PLAN WITH YOUR ENERGY</p><h1>Find your rhythm.</h1><span>A little structure. More room for life.</span></header>}
        <Rhythm section={page} />
      </div>
      {settings && <section className="rhythm-settings"><header className="module-heading"><h1>Settings &amp; privacy</h1><p>Manage your Rhythm planning data.</p></header><RhythmDataSettings /></section>}
      {notice && <div className="platform-toast" role="status">{notice}</div>}
    </main>
  </PlatformShell></TaskWorkspaceProvider>;
}

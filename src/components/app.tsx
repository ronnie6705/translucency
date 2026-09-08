"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Droplets,
  Leaf,
  Plus,
} from "lucide-react";
import { defaultRoles, sources, suggestRole } from "@/lib/catalog";
import { loadData, updateData } from "@/lib/storage";
import { seedData } from "@/lib/seed";
import { insights } from "@/lib/insights";
import {
  dayKey,
  stateLabels,
  type AppData,
  type Kind,
  type Role,
} from "@/lib/types";
import { Material } from "./material";
import { GentleReminder } from "./reminder";
import {
  AddInfluenceButton,
  DailyInfluences,
  InfluenceEntries,
  useInfluenceEditor,
  type MaterialResponse,
} from "./influences";
import { getDailyInfluences } from "@/lib/influences";
import { Button, Chips, Heading, TextLink } from "./ui";
import { CheckInScreen, SourceScreen } from "./check-in";
import { RolesScreen, SessionScreen } from "./roles";
import { JourneyScreen, InsightsScreen, SettingsScreen } from "./reflect";
import { PlatformShell } from "./platform-shell";
import Rhythm from "@/modules/rhythm/App";
import { RhythmDataSettings } from "@/modules/rhythm/data-settings";
import { AccountControls } from './account';
export type Page =
  | "rhythm"
  | "rhythm-tasks"
  | "rhythm-timeblocks"
  | "home"
  | "check-in"
  | "water"
  | "drying"
  | "signals"
  | "roles"
  | "custom-roles"
  | "session"
  | "journey"
  | "insights"
  | "settings"
  | "privacy";
export type Commit = (
  fn: (data: AppData) => AppData,
  message?: string,
) => Promise<boolean>;
export interface ScreenProps {
  data: AppData;
  commit: Commit;
  go: (page: Page) => void;
  roles: Role[];
}
export default function App() {
  const [data, setData] = useState<AppData>();
  const [page, setCurrentPage] = useState<Page>("home");
  const [reflectionPage, setReflectionPage] = useState<Page>("home");
  const setPage = useCallback((target: Page) => {
    setCurrentPage(target);
    if (!target.startsWith("rhythm")) setReflectionPage(target);
  }, []);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [roleId, setRoleId] = useState("observer");
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    loadData()
      .then(setData)
      .catch(() =>
        setError(
          "Local storage is unavailable. Allow this site to store data, then reload.",
        ),
      );
    const sync = () => {
      loadData()
        .then(setData)
        .catch(() => {});
    };
    const channel = new BroadcastChannel("translucency");
    channel.onmessage = sync;
    window.addEventListener("focus", sync);
    window.addEventListener("cloud-refreshed", sync);
    const hash = () => {
      const value = location.hash.slice(1) as Page;
      if (
        [
          "rhythm",
          "rhythm-tasks",
          "rhythm-timeblocks",
          "home",
          "check-in",
          "water",
          "drying",
          "signals",
          "roles",
          "custom-roles",
          "session",
          "journey",
          "insights",
          "settings",
          "privacy",
        ].includes(value)
      )
        setPage(value);
    };
    hash();
    window.addEventListener("hashchange", hash);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() =>
          setNotice(
            "Offline support could not start. You can still use the app while connected.",
          ),
        );
    return () => {
      channel.close();
      window.removeEventListener("focus", sync);
      window.removeEventListener("cloud-refreshed", sync);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const go = useCallback((target: Page) => {
    location.hash = target;
    setPage(target);
    window.scrollTo(0, 0);
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  }, []);
  const commit: Commit = async (fn, message) => {
    try {
      const updated = await updateData(fn);
      setData(updated);
      setError("");
      if (message) setNotice(message);
      const ch = new BroadcastChannel("translucency");
      ch.postMessage("updated");
      ch.close();
      return true;
    } catch {
      setError(
        "Your change was not saved. Local storage may be full or unavailable. Please try again.",
      );
      return false;
    }
  };
  if (!data)
    return (
      <main className="platform-loading">
        <AccountControls />
        <div className="brand-mark" />
        <h1>Rhythm</h1>
        <p role="status">{error || "Making a little space…"}</p>
        {error && <Button onClick={() => location.reload()}>Try again</Button>}
      </main>
    );
  const roles = [...defaultRoles, ...data.roles];
  const props = { data, commit, go, roles };
  const useRole = (id: string) => {
    setRoleId(id);
    go("session");
  };
  return (
    <PlatformShell page={page} reflectionPage={reflectionPage} go={go} name={data.profile.name}>
      <main id="main" ref={main} tabIndex={-1} className="platform-main">
        <AccountControls />
        {error && <div role="alert" className="platform-notice">{error}</div>}
        <div hidden={!page.startsWith("rhythm")} className="rhythm-module">
          <header className="module-heading"><p>PLAN WITH YOUR ENERGY</p><h1>Find your rhythm.</h1><span>A little structure. More room for life.</span></header>
          <Rhythm section={page} />
        </div>
        <div className="translucency-module" hidden={page.startsWith("rhythm")}>
          {!data.profile.onboarded && reflectionPage !== "settings" && reflectionPage !== "privacy" ? <Onboarding {...props} /> : <>
              {reflectionPage === "home" && <Home {...props} useRole={useRole} />}
              {reflectionPage === "check-in" && <CheckInScreen {...props} />}
              {(["water", "drying", "signals"] as string[]).includes(reflectionPage) && (
                <SourceScreen key={reflectionPage} {...props} kind={reflectionPage as Kind} />
              )}
              {(reflectionPage === "roles" || reflectionPage === "custom-roles") && (
                <RolesScreen
                  {...props}
                  custom={reflectionPage === "custom-roles"}
                  useRole={useRole}
                />
              )}
              {reflectionPage === "session" && (
                <SessionScreen
                  key={roleId}
                  {...props}
                  role={roles.find((r) => r.id === roleId) || defaultRoles[2]}
                />
              )}
              {reflectionPage === "journey" && <JourneyScreen {...props} />}
              {reflectionPage === "insights" && <InsightsScreen {...props} />}
              {(reflectionPage === "settings" || reflectionPage === "privacy") && (
                <SettingsScreen {...props} privacy={reflectionPage === "privacy"} />
              )}
          </>}
          {(reflectionPage === "settings" || reflectionPage === "privacy") && <RhythmDataSettings />}
        </div>
        {notice && <div className="platform-toast" role="status">{notice}</div>}
      </main>
    </PlatformShell>
  );
}

function Home({
  data,
  commit,
  roles,
  go,
  useRole,
}: ScreenProps & { useRole: (id: string) => void }) {
  const [response, setResponse] = useState<MaterialResponse>();
  const [considerState, setConsiderState] = useState(false);
  const editor = useInfluenceEditor(data, commit, (r) => {
    setResponse(r);
    setConsiderState(true);
  });
  const events = getDailyInfluences(
    data.influences.filter((e) => !e.demo),
    new Date(),
  );
  const personal = [...data.checkIns]
    .filter((c) => !c.demo)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = personal[0];
  const today = latest && dayKey(latest.timestamp) === dayKey(new Date());
  const role =
    roles.find(
      (r) =>
        r.id ===
        suggestRole(
          events.filter((e) => e.type === "water").map((e) => e.categoryLabel),
          data.profile.selectedRoleIds,
        ),
    ) || roles[2];
  const history = insights(
    data.checkIns,
    data.sessions,
    roles,
    data.influences,
  ).find((i) => i.kind === "history");
  const hour = new Date().getHours();
  return (
    <>
      <Heading
        eyebrow="YOUR EVERYDAY, WITH A LITTLE MORE PERSPECTIVE"
        title={`Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}${data.profile.name ? `, ${data.profile.name}` : ""}.`}
        description="You don’t have to figure everything out today."
        action={
          <Button onClick={() => go("check-in")}>
            <Plus size={17} /> Check in
          </Button>
        }
      />
      <GentleReminder data={data} onCheckIn={() => go("check-in")} />
      <div className="home-grid">
        <section className="panel-card">
          <div className="section-top">
            <span className="eyebrow">YOUR MATERIAL</span>
            <span className="small-pill">
              <span />
              {latest
                ? today
                  ? "Today’s check-in"
                  : "Last check-in"
                : "A space to begin"}
            </span>
          </div>
          <Material state={latest?.state ?? 1} response={response} />
          <div className="panel-description">
            <div>
              <p className="eyebrow">
                {latest
                  ? "YOUR LAST RECORDED STATE"
                  : "HOW DOES YOUR PANEL FEEL?"}
              </p>
              <h2>{latest ? stateLabels[latest.state] : "Room to notice."}</h2>
              <p>
                {latest
                  ? latest.state >= 2
                    ? today
                      ? "You are carrying more today. Thoughts and signals may feel a little louder."
                      : "You were carrying more at your last check-in. This records that moment, not how you must feel now."
                    : "There is a little more space between what you notice and how you respond."
                  : "A brief check-in can help you understand what you’re carrying."}
              </p>
            </div>
            <span className="state-symbol">◌</span>
          </div>
          <div className="panel-foot">
            <span>Always intact. Always you.</span>
            <TextLink onClick={() => go("check-in")}>
              {latest ? "Make space to reflect" : "Find your state"}
            </TextLink>
          </div>
          {considerState && (
            <div className="state-confirmation">
              <p>
                {latest
                  ? `Does ${stateLabels[latest.state].toLowerCase()} still feel right?`
                  : "Your felt state is yours to choose."}{" "}
                Logged influences don’t change it automatically.
              </p>
              <div>
                <button
                  className="text-link"
                  onClick={() => setConsiderState(false)}
                >
                  {latest ? "Keep current state" : "Return to my day"}
                </button>
                <button className="text-link" onClick={() => go("check-in")}>
                  {latest ? "Adjust state" : "Choose my state"} ↗
                </button>
              </div>
            </div>
          )}
        </section>
        <div className="home-context">
          {(["water", "drying"] as const).map((kind) => (
            <section
              key={kind}
              className={`source-card ${kind}`}
              data-influence-source={kind}
            >
              <div className="section-top">
                <span className="source-icon">
                  {kind === "water" ? (
                    <Droplets size={20} />
                  ) : (
                    <Leaf size={20} />
                  )}
                </span>
                <TextLink onClick={() => go(kind)}>Explore</TextLink>
              </div>
              <h3>
                {kind === "water"
                  ? "What added water?"
                  : "What helped you dry?"}
              </h3>
              <p>
                {kind === "water"
                  ? "What your system has been carrying."
                  : "Small things that make a little space."}
              </p>
              <InfluenceEntries
                events={events}
                type={kind}
                highlightId={response?.instance.id}
                limit={3}
                onOpen={(e, el) => editor.open(kind, e, el)}
              />
              <AddInfluenceButton
                type={kind}
                onClick={(el) => editor.open(kind, undefined, el)}
              />
            </section>
          ))}
          <DailyInfluences events={events} date={new Date()} />
        </div>
      </div>
      {editor.editor}
      <div className="home-lower">
        <section className={`perspective-feature ${role.tone}`}>
          <div className="role-symbol">{role.icon}</div>
          <div>
            <p className="eyebrow">A PERSPECTIVE TO BORROW</p>
            <h3>{role.name}</h3>
            <p>“{role.corePhrase}”</p>
            <TextLink onClick={() => useRole(role.id)}>
              Use this perspective
            </TextLink>
          </div>
          <button
            className="circle-link"
            aria-label="Explore all roles"
            onClick={() => go("roles")}
          >
            <ArrowUpRight size={20} />
          </button>
        </section>
        <section className="history-feature">
          <div className="section-top">
            <p className="eyebrow">A LITTLE PERSPECTIVE FROM YOUR PAST</p>
            {data.checkIns.some((c) => c.demo) && (
              <span className="demo-tag">Includes demo</span>
            )}
          </div>
          <h3>{history?.title || "Your story has room to change."}</h3>
          <p>
            {history?.body ||
              "As you reflect over time, your material states will form a picture here. There is no need to fill every day."}
          </p>
          <div className="history-strip">
            {data.checkIns.slice(-7).map((c) => (
              <Material key={c.id} state={c.state} mini />
            ))}
            <TextLink onClick={() => go("journey")}>Your journey</TextLink>
          </div>
        </section>
      </div>
    </>
  );
}
function Onboarding({ data, commit, roles, go }: ScreenProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(data.profile.name);
  const [water, setWater] = useState(data.profile.favourites.water);
  const [drying, setDrying] = useState(data.profile.favourites.drying);
  const [selected, setSelected] = useState(data.profile.selectedRoleIds);
  const [demo, setDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  return (
    <div className="onboarding">
      <a className="brand" href="#">
        <span className="brand-mark" />
        translucency
      </a>
      <div className="onboarding-grid">
        <div className="onboarding-art">
          <Material state={2} />
          <p>Translucent does not mean damaged.</p>
        </div>
        <section>
          <p className="eyebrow">A LITTLE SPACE FOR YOU · {step + 1} OF 3</p>
          <h1>
            {
              [
                "Understand yourself. Then return to your life.",
                "What shapes your day?",
                "Borrow a perspective, not a personality.",
              ][step]
            }
          </h1>
          {step === 0 ? (
            <>
              <p className="lede">Some days, more gets through.</p>
              <p>
                Translucency is how sensitised and permeable your mind-body
                system feels. Like a material holding water, thoughts and
                sensations can feel louder when you’re carrying more.
              </p>
              <p>
                Your panel stays whole. As stress eases, it can become more
                opaque again. This is a metaphor, never a measurement of your
                health.
              </p>
              <label>
                Your name <span>(optional)</span>
                <input
                  value={name}
                  maxLength={40}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                />
              </label>
            </>
          ) : step === 1 ? (
            <>
              <p>
                Water Sources add load. Drying Sources are restorative actions.
                Choose a few familiar ones to keep close; you can change them
                later.
              </p>
              <h3>What tends to add water?</h3>
              <Chips
                items={sources.water.slice(0, 9)}
                selected={water}
                onChange={setWater}
              />
              <h3>What helps you dry?</h3>
              <Chips
                items={sources.drying.slice(0, 9)}
                selected={drying}
                onChange={setDrying}
              />
            </>
          ) : (
            <>
              <p>
                You do not have to become someone else. Sometimes it helps to
                borrow their perspective. Choose 2–3 starting roles.
              </p>
              <Chips
                items={roles.map((r) => r.name)}
                selected={roles
                  .filter((r) => selected.includes(r.id))
                  .map((r) => r.name)}
                onChange={(names) =>
                  setSelected(
                    roles
                      .filter((r) => names.includes(r.name))
                      .map((r) => r.id),
                  )
                }
                max={3}
              />
              <p>
                One or two brief check-ins can be enough. Logging is available
                when it helps. Life outside the app is the goal.
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={demo}
                  onChange={(e) => setDemo(e.target.checked)}
                />{" "}
                Include labelled demo history to explore Journey and Insights
              </label>
              <p className="small">
                No advertising. Guest records stay in this browser; signed-in
                account records sync to the cloud. You can export or delete
                your workspace data in Settings.
              </p>
              <details>
                <summary>About this app and appropriate care</summary>
                <p>
                  Translucency helps you reflect on stress, sensitivity, and
                  coping patterns. It does not diagnose medical conditions. If
                  you experience a concerning, severe, or worsening physical or
                  mental-health problem, seek appropriate professional care.
                </p>
              </details>
            </>
          )}
          <div className="form-actions">
            {step > 0 && (
              <Button secondary onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button
              disabled={busy || (step === 2 && selected.length < 2)}
              onClick={async () => {
                if (step < 2) {
                  setStep(step + 1);
                  return;
                }
                setBusy(true);
                if (
                  await commit((d) => {
                    const history =
                      demo && !d.checkIns.some((c) => c.demo) ? seedData(d) : d;
                    return {
                      ...d,
                      profile: {
                        ...d.profile,
                        name: name.trim(),
                        onboarded: true,
                        selectedRoleIds: selected,
                        favourites: { ...d.profile.favourites, water, drying },
                      },
                      checkIns: demo
                        ? history.checkIns
                        : d.checkIns.filter((c) => !c.demo),
                      sessions: demo
                        ? history.sessions
                        : d.sessions.filter((s) => !s.demo),
                      influences: demo
                        ? history.influences
                        : d.influences.filter((e) => !e.demo),
                    };
                  })
                ) {
                  go("home");
                }
                setBusy(false);
              }}
            >
              {step === 2 ? "Enter your space" : "Continue"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

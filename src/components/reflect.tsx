import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Droplets,
  Feather,
  Leaf,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import {
  dayKey,
  stateLabels,
  type Helpfulness,
  type RoleSession,
} from "@/lib/types";
import { dailyEntries, insights } from "@/lib/insights";
import { emptyData, seedData } from "@/lib/seed";
import type { ScreenProps } from "./app";
import { Material } from "./material";
import { Button, Heading, TextLink } from "./ui";
import {
  DailyInfluences,
  InfluenceEntries,
  useInfluenceEditor,
} from "./influences";
import {
  getDailyInfluences,
  getAverageImpactByCategory,
} from "@/lib/influences";
export function JourneyScreen({ data, roles, commit }: ScreenProps) {
  const editor = useInfluenceEditor(data, commit);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [selected, setSelected] = useState(dayKey(new Date()));
  const [recent, setRecent] = useState(true);
  const [includeDemo, setIncludeDemo] = useState(true);
  const entries = data.checkIns.filter((c) => includeDemo || !c.demo);
  const influences = data.influences.filter((e) => includeDemo || !e.demo);
  const selectedInfluences = getDailyInfluences(influences, selected);
  const days = dailyEntries(entries);
  const map = new Map(days.map((c) => [dayKey(c.timestamp), c]));
  const count = recent
    ? 30
    : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startDate = recent
    ? new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate() - 29,
      )
    : month;
  const offset = (startDate.getDay() + 6) % 7;
  const selectedEntries = entries
    .filter((c) => dayKey(c.timestamp) === selected)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const sessions = data.sessions.filter(
    (s) => (includeDemo || !s.demo) && dayKey(s.timestamp) === selected,
  );
  const changeMonth = (n: number) => {
    setRecent(false);
    setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  };
  return (
    <>
      <Heading
        eyebrow="A RECORD OF CHANGE, NOT A RECORD TO KEEP"
        title="Your material has a history."
        description="You have been here before. Leave room to see what changed."
      />
      <div className="journey-grid">
        <section className="calendar-card">
          <div className="calendar-header">
            <div>
              <p className="eyebrow">YOUR JOURNEY</p>
              <h2>
                {recent
                  ? "The last 30 days"
                  : month.toLocaleDateString("en-AU", {
                      month: "long",
                      year: "numeric",
                    })}
              </h2>
            </div>
            <div className="calendar-controls">
              <button
                aria-label="Previous month"
                onClick={() => changeMonth(-1)}
              >
                <ArrowLeft size={18} />
              </button>
              <button
                onClick={() => {
                  setMonth(
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      1,
                    ),
                  );
                  setSelected(dayKey(new Date()));
                  setRecent(false);
                }}
              >
                Today
              </button>
              <button
                aria-label="Next month"
                onClick={() => changeMonth(1)}
                disabled={
                  month.getTime() >=
                  new Date(
                    new Date().getFullYear(),
                    new Date().getMonth(),
                    1,
                  ).getTime()
                }
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
          <div className="journey-view">
            <button aria-pressed={recent} onClick={() => setRecent(true)}>
              Last 30 days
            </button>
            <button aria-pressed={!recent} onClick={() => setRecent(false)}>
              Calendar month
            </button>
            <span>
              {startDate.toLocaleDateString("en-AU", {
                day: "numeric",
                month: "short",
              })}{" "}
              onward
            </span>
          </div>
          <div className="calendar-weekdays">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-days">
            {Array.from({ length: offset }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const date = new Date(
                startDate.getFullYear(),
                startDate.getMonth(),
                startDate.getDate() + i,
              );
              const key = dayKey(date);
              const c = map.get(key);
              const hasSession = data.sessions.some(
                (s) => (includeDemo || !s.demo) && dayKey(s.timestamp) === key,
              );
              return (
                <button
                  key={key}
                  className={`calendar-day ${selected === key ? "selected" : ""} ${key === dayKey(new Date()) ? "today" : ""}`}
                  aria-label={`${date.toLocaleDateString("en-AU", { day: "numeric", month: "long" })}: ${c ? stateLabels[c.state] : "No check-in"}${c?.demo ? ", demo" : ""}${hasSession ? ", perspective saved" : ""}${influences.some((e) => dayKey(e.timestamp) === key) ? ", influences logged" : ""}`}
                  aria-pressed={selected === key}
                  onClick={() => setSelected(key)}
                >
                  <span className="day-number">
                    {date.getDate()}
                    {c?.demo && <small>demo</small>}
                  </span>
                  {c ? (
                    <Material mini state={c.state} />
                  ) : (
                    <span className="unlogged">
                      {hasSession
                        ? "◈"
                        : influences.some((e) => dayKey(e.timestamp) === key)
                          ? "◦"
                          : "·"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            {stateLabels.map((s, i) => (
              <span key={s}>
                <i style={{ opacity: 0.3 + i * 0.2 }} />
                {s.replace(" translucent", "")}
              </span>
            ))}
          </div>
          <p className="small">
            Unrecorded days are simply days lived. The last check-in represents
            each day; open it to see all entries.
          </p>
          {data.checkIns.some((c) => c.demo) && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={includeDemo}
                onChange={(e) => setIncludeDemo(e.target.checked)}
              />
              Show labelled demo entries
            </label>
          )}
        </section>
        <aside className="day-detail">
          <p className="eyebrow">
            {new Date(`${selected}T12:00:00`).toLocaleDateString("en-AU", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          {!selectedEntries.length &&
          !sessions.length &&
          !selectedInfluences.length ? (
            <>
              <h2>A day with room.</h2>
              <p>No entry here. You don’t need to fill it.</p>
              <div className="empty-material">◌</div>
            </>
          ) : (
            <>
              {selectedEntries.map((c) => (
                <article className="day-entry" key={c.id}>
                  <div className="section-top">
                    <span className="small">
                      {new Date(c.timestamp).toLocaleTimeString("en-AU", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {c.demo && <span className="demo-tag">Demo entry</span>}
                  </div>
                  <Material state={c.state} mini />
                  <h2>{stateLabels[c.state]}</h2>
                  {c.signals.length > 0 && (
                    <details>
                      <summary>Signals noticed</summary>
                      <p>{c.signals.join(" · ")}</p>
                    </details>
                  )}
                  {c.roleId && (
                    <p>
                      <strong>Perspective:</strong>{" "}
                      {roles.find((r) => r.id === c.roleId)?.name ||
                        "Personal role"}
                      {c.helpfulness
                        ? ` · ${c.helpfulness.replaceAll("_", " ")}`
                        : ""}
                    </p>
                  )}
                  {c.note && <blockquote>{c.note}</blockquote>}
                </article>
              ))}
              {sessions.map((s) => (
                <SessionReflection
                  key={s.id}
                  session={s}
                  roleName={
                    roles.find((r) => r.id === s.roleId)?.name ||
                    "Personal role"
                  }
                  commit={commit}
                />
              ))}
              <div className="day-influences">
                {!selectedEntries.length && (
                  <p className="small">
                    Moments recorded. No felt state selected for this day.
                  </p>
                )}
                {(["water", "drying"] as const).map((type) => (
                  <section key={type}>
                    <p className="eyebrow">
                      {type === "water" ? "WATER ADDED" : "DRYING"}
                    </p>
                    <InfluenceEntries
                      events={selectedInfluences}
                      type={type}
                      detail
                      onOpen={(e, el) => editor.open(type, e, el)}
                    />
                  </section>
                ))}
                <DailyInfluences
                  events={selectedInfluences}
                  date={selected}
                  title="This day’s influences"
                />
              </div>
            </>
          )}
        </aside>
      </div>
      {editor.editor}
    </>
  );
}
function SessionReflection({
  session,
  roleName,
  commit,
}: {
  session: RoleSession;
  roleName: string;
  commit: ScreenProps["commit"];
}) {
  const [help, setHelp] = useState<Helpfulness | "">(session.helpfulness || "");
  const [note, setNote] = useState(session.reflection || "");
  const [busy, setBusy] = useState(false);
  return (
    <details className="saved-session">
      <summary>
        {roleName} · {session.demo ? "demo perspective" : "saved perspective"}
      </summary>
      <p className="eyebrow">CONCERN</p>
      <p>{session.context}</p>
      <p className="eyebrow">ANXIETY’S INTERPRETATION</p>
      <p>{session.anxiousAppraisal}</p>
      <p className="eyebrow">ANOTHER PERSPECTIVE</p>
      <p>{session.reappraisal}</p>
      <blockquote>“{session.carry}”</blockquote>
      {session.observe && (
        <div className="notice">
          No new decision required unless something meaningfully changes.
        </div>
      )}
      <label>
        Did this perspective help?
        <select
          value={help}
          onChange={(e) => setHelp(e.target.value as Helpfulness | "")}
        >
          <option value="">Reflect later</option>
          <option value="not_really">Not really</option>
          <option value="a_little">A little</option>
          <option value="a_lot">A lot</option>
        </select>
      </label>
      <label>
        What changed? <span>(optional)</span>
        <textarea
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <Button
        secondary
        disabled={!help || busy}
        onClick={async () => {
          setBusy(true);
          await commit(
            (d) => ({
              ...d,
              sessions: d.sessions.map((s) =>
                s.id === session.id
                  ? {
                      ...s,
                      helpfulness: help || undefined,
                      reflection: note.trim(),
                    }
                  : s,
              ),
            }),
            "Reflection saved.",
          );
          setBusy(false);
        }}
      >
        Save reflection
      </Button>
    </details>
  );
}
export function InsightsScreen({ data, roles, go }: ScreenProps) {
  const [demo, setDemo] = useState(true);
  const entries = data.checkIns.filter((c) => demo || !c.demo);
  const sessions = [
    ...data.sessions.filter((s) => demo || !s.demo),
    ...entries
      .filter((c) => c.roleId && c.helpfulness)
      .map((c) => ({
        id: c.id,
        timestamp: c.timestamp,
        roleId: c.roleId!,
        context: "Check-in",
        anxiousAppraisal: "",
        reappraisal: "",
        carry: "",
        observe: false,
        helpfulness: c.helpfulness,
      })),
  ];
  const influences = data.influences.filter((e) => demo || !e.demo);
  const cards = insights(entries, sessions, roles, influences);
  return (
    <>
      <Heading
        eyebrow="CONTEXT, WITH A WIDER VIEW"
        title="Patterns worth noticing."
        description="A few observations from your logs. Associations, not explanations or predictions."
      />
      {data.checkIns.some((c) => c.demo) && (
        <div className="demo-notice">
          <span className="demo-tag">Sample history available</span>
          <p>
            {demo
              ? "These observations include labelled demo entries. They are not conclusions about you."
              : "Showing only your own entries."}
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={demo}
              onChange={(e) => setDemo(e.target.checked)}
            />
            Include demo data
          </label>
        </div>
      )}
      {cards.length ? (
        <div className="insight-grid">
          {cards.map((card, i) => {
            const Icon = {
              water: Droplets,
              drying: Leaf,
              role: Feather,
              history: Sparkles,
            }[card.kind];
            return (
              <article
                key={card.title}
                className={`insight-card ${card.kind}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <Icon size={24} />
                <p className="eyebrow">
                  {
                    {
                      water: "WHAT ADDS LOAD",
                      drying: "WHAT MAKES ROOM",
                      role: "BORROWED PERSPECTIVE",
                      history: "YOUR MATERIAL CAN CHANGE",
                    }[card.kind]
                  }
                </p>
                <h2>{card.title}</h2>
                <p>{card.body}</p>
                {card.kind === "history" && (
                  <div className="insight-materials">
                    {([3, 2, 1, 0] as const).map((s) => (
                      <Material key={s} state={s} mini />
                    ))}
                  </div>
                )}
                <TextLink
                  onClick={() => go(card.kind === "role" ? "roles" : "journey")}
                >
                  {card.kind === "role"
                    ? "Explore perspectives"
                    : "See the context"}
                </TextLink>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="empty-state">
          <Sparkles size={32} />
          <h2>Let the picture emerge.</h2>
          <p>
            There isn’t enough history for a useful pattern yet. No need to log
            more often — return when a check-in helps.
          </p>
          <Button secondary onClick={() => go("journey")}>
            View your journey
          </Button>
        </section>
      )}
      <div className="insight-method">
        <h3>A note on these observations</h3>
        <p>
          Frequency counts individual moments, including repeated categories.
          Average impact uses only explicitly rated moments; older unrated
          entries are excluded. Water context uses each day’s last self-reported
          state. Drying observations look for an earlier check-in, then an
          event, then a lower state on the same or next day. Past returns to
          opaque describe recorded states, not a promise.
        </p>
        {influences.length > 0 && (
          <details>
            <summary>View frequency and average logged impact</summary>
            <div className="influence-statistics">
              {getAverageImpactByCategory(influences).map((s) => (
                <div className="manage-row" key={s.categoryId}>
                  <span>
                    {s.label}
                    <small>
                      {s.count} moments · {s.ratedCount} rated
                    </small>
                  </span>
                  <span>
                    {s.average === null
                      ? "Not recorded"
                      : `${s.average > 0 ? "+" : ""}${s.average.toFixed(1)}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="small">
              These are perceived impacts, not measurements of your nervous
              system.
            </p>
          </details>
        )}
        <p>
          Role observations use your optional helpfulness ratings. Nothing here
          diagnoses a condition or establishes a cause.
        </p>
      </div>
    </>
  );
}
export function SettingsScreen({
  data,
  commit,
  go,
  privacy,
}: ScreenProps & { privacy: boolean }) {
  const [name, setName] = useState(data.profile.name);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translucency-${dayKey(new Date())}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <Heading
        eyebrow="YOUR SPACE, YOUR CHOICES"
        title={privacy ? "Private by design." : "Make yourself at home."}
        description="No advertising. Choose device-only use, or sign in to sync your private workspace."
      />
      <div className="settings-grid">
        <div className="form-stack">
          {!privacy && (
            <>
              <section className="form-section">
                <h2>The everyday</h2>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await commit(
                      (d) => ({
                        ...d,
                        profile: { ...d.profile, name: name.trim() },
                      }),
                      "Preferences saved.",
                    );
                  }}
                >
                  <label>
                    Your name
                    <input
                      maxLength={40}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <Button secondary type="submit">
                    Save name
                  </Button>
                </form>
                <label>
                  Gentle check-in preference
                  <select
                    value={data.profile.reminders}
                    onChange={(e) => {
                      const reminders = e.target
                        .value as typeof data.profile.reminders;
                      commit(
                        (d) => ({
                          ...d,
                          profile: {
                            ...d.profile,
                            reminders,
                          },
                        }),
                        "Check-in preference saved.",
                      );
                    }}
                  >
                    <option value="off">No reminders</option>
                    <option value="morning">Morning</option>
                    <option value="evening">Evening</option>
                    <option value="both">Morning and evening</option>
                  </select>
                </label>
                <p className="small">
                  A gentle invitation appears on Home during your selected
                  morning (6am–noon) or evening (6pm–11pm) window, unless you’ve
                  already checked in. Dismiss it for the day. V1 does not send
                  background notifications.
                </p>
              </section>
              <section className="form-section">
                <h2>Familiar things, within reach</h2>
                {(["water", "drying", "signals"] as const).map((k) => (
                  <div className="manage-row" key={k}>
                    <span>
                      {k === "water"
                        ? "Water Sources"
                        : k === "drying"
                          ? "Drying Sources"
                          : "Optional Signals"}
                    </span>
                    <TextLink onClick={() => go(k)}>Manage</TextLink>
                  </div>
                ))}
                <div className="manage-row">
                  <span>Your perspectives</span>
                  <TextLink onClick={() => go("roles")}>Manage</TextLink>
                </div>
              </section>
            </>
          )}
          <section className="form-section">
            <LockKeyhole size={23} />
            <h2>Your Translucency data</h2>
            <p>
              Guest check-ins, roles, and reflections stay in this browser. When
              signed in, account records sync to Supabase and are also cached in
              IndexedDB for offline use. Neither copy is an end-to-end encrypted
              vault: someone using your browser profile may be able to access it.
            </p>
            <p>
              Guest histories are separate on each browser. Signing in opens your
              account history; guest data is uploaded only through an explicit
              import. Clearing browser data removes local copies and any unsynced
              changes, not records already synced to your account. Export backups.
            </p>
            <Button secondary onClick={exportData}>
              <Download size={16} />
              Export my data
            </Button>
            <div className="manage-row">
              <div>
                <h3>Clear sample history</h3>
                <p className="small">
                  Remove demo check-ins and sessions. Keep your own data.
                </p>
              </div>
              <Button
                secondary
                disabled={busy || !data.checkIns.some((c) => c.demo)}
                onClick={() =>
                  commit(
                    (d) => ({
                      ...d,
                      checkIns: d.checkIns.filter((c) => !c.demo),
                      sessions: d.sessions.filter((s) => !s.demo),
                      influences: d.influences.filter((e) => !e.demo),
                    }),
                    "Demo data cleared.",
                  )
                }
              >
                Clear demo data
              </Button>
            </div>
            <div className="manage-row">
              <div>
                <h3>Reset sample history</h3>
                <p className="small">
                  Restore four weeks of labelled examples. Keep your own
                  entries.
                </p>
              </div>
              <Button
                secondary
                onClick={() =>
                  commit((d) => seedData(d), "Demo history reset.")
                }
              >
                Reset demo data
              </Button>
            </div>
            <details className="delete-controls">
              <summary>Delete all Translucency data</summary>
              <p>
                This removes your profile, check-ins, influence moments, custom
                sources, custom roles, and sessions from the active workspace.
                If signed in, this deletion also syncs to your account and other
                devices. Export first if you want a copy. Rhythm planning data is managed separately below.
              </p>
              <label>
                Type DELETE to confirm
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                />
              </label>
              <Button
                disabled={confirm !== "DELETE" || busy}
                onClick={async () => {
                  setBusy(true);
                  if (
                    await commit(
                      () => emptyData(),
                      "All Translucency data deleted.",
                    )
                  ) {
                    try {
                      for (const key of Object.keys(localStorage))
                        if (key.startsWith("translucency-"))
                          localStorage.removeItem(key);
                    } catch {
                      /* User data was already removed from IndexedDB. */
                    }
                    setConfirm("");
                    go("home");
                  }
                  setBusy(false);
                }}
              >
                Delete Translucency data
              </Button>
            </details>
          </section>
          <section className="form-section">
            <h2>Install your space</h2>
            <p>
              In Chrome or Edge on desktop, use the install icon in the address
              bar or the browser menu. On iPhone, open in Safari, then Share →
              Add to Home Screen.
            </p>
            <p className="small">
              Installation and offline access require HTTPS, or localhost on
              your PC. The app becomes available offline after a successful
              online load of the production build.
            </p>
          </section>
        </div>
        <aside className="quiet-card">
          <span className="large-symbol">◌</span>
          <h2>
            Understand yourself.
            <br />
            Then return to your life.
          </h2>
          <p>
            The app should help you understand yourself without teaching you to
            monitor yourself more.
          </p>
          <details open={privacy}>
            <summary>Safety & appropriate care</summary>
            <p>
              Translucency helps you reflect on stress, sensitivity, and coping
              patterns. It does not diagnose medical conditions. If you
              experience a concerning, severe, or worsening physical or
              mental-health problem, seek appropriate professional care.
            </p>
            <p>
              It is not a medical triage system or a replacement for a
              therapist. Your material state is your felt impression, never a
              health-risk assessment.
            </p>
          </details>
          {!privacy && (
            <TextLink onClick={() => go("privacy")}>Privacy & safety</TextLink>
          )}
        </aside>
      </div>
    </>
  );
}

import { useState } from "react";
import { sources, suggestRole } from "@/lib/catalog";
import { stateLabels, uid, type Kind, type State } from "@/lib/types";
import type { ScreenProps } from "./app";
import { Material } from "./material";
import { Button, Chips, Heading } from "./ui";
import {
  AddInfluenceButton,
  InfluenceEntries,
  useInfluenceEditor,
  type MaterialResponse,
} from "./influences";
import { getDailyInfluences } from "@/lib/influences";
export function CheckInScreen({ data, commit, go, roles }: ScreenProps) {
  const [state, setState] = useState<State>();
  const [response, setResponse] = useState<MaterialResponse>();
  const editor = useInfluenceEditor(data, commit, setResponse);
  const events = getDailyInfluences(
    data.influences.filter((e) => !e.demo),
    new Date(),
  );
  const [signals, setSignals] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [roleId, setRoleId] = useState("");
  const [help, setHelp] = useState("");
  const [busy, setBusy] = useState(false);
  const recent = data.checkIns.some(
    (c) =>
      !c.demo && Date.now() - new Date(c.timestamp).getTime() < 4 * 3600000,
  );
  const list = (kind: Kind) => [
    ...new Set([
      ...data.profile.favourites[kind],
      ...sources[kind],
      ...data.profile.customSources[kind],
    ]),
  ];
  const suggested = roles.find(
    (r) =>
      r.id ===
      suggestRole(
        events.filter((e) => e.type === "water").map((e) => e.categoryLabel),
        data.profile.selectedRoleIds,
      ),
  );
  return (
    <>
      <Heading
        eyebrow="NOTICE → UNDERSTAND → RETURN"
        title="A moment to check in."
        description="A broad impression is enough. This can take 30–90 seconds."
      />
      {recent && (
        <div className="notice">
          You have already checked in recently. Unless something meaningful has
          changed, consider returning to your day and checking in later.{" "}
          <button className="text-link" onClick={() => go("home")}>
            Return to my day →
          </button>
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (state === undefined || busy) return;
          setBusy(true);
          const checkInId = uid();
          const unlinked = new Set(
            events.filter((e) => !e.checkInId).map((e) => e.id),
          );
          const ok = await commit(
            (d) => ({
              ...d,
              influences: d.influences.map((e) =>
                unlinked.has(e.id) && !e.checkInId ? { ...e, checkInId } : e,
              ),
              checkIns: [
                ...d.checkIns,
                {
                  id: checkInId,
                  timestamp: new Date().toISOString(),
                  state,
                  water: [],
                  drying: [],
                  signals,
                  note: note.trim(),
                  roleId: roleId || undefined,
                  helpfulness: help
                    ? (help as "a_lot" | "a_little" | "not_really")
                    : undefined,
                },
              ],
            }),
            "Check-in saved. Understand yourself. Then return to your life.",
          );
          setBusy(false);
          if (ok) go("home");
        }}
      >
        <div className="checkin-grid">
          <div className="form-stack">
            <section className="form-section">
              <p className="eyebrow">NOTICE</p>
              <h2>How does your panel feel?</h2>
              <p>Your own impression, not a calculated score.</p>
              <div className="state-options">
                {stateLabels.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    aria-pressed={state === i}
                    onClick={() => setState(i as State)}
                    className={`state-option ${state === i ? "selected" : ""}`}
                  >
                    <Material state={i as State} mini />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </section>
            {(["water", "drying"] as const).map((kind) => (
              <section className={`form-section ${kind}`} key={kind}>
                <p className="eyebrow">UNDERSTAND</p>
                <h2>
                  {kind === "water"
                    ? "What added water?"
                    : "What helped you dry?"}
                </h2>
                <p>
                  Moments are saved individually. There is no need to find
                  something to log.
                </p>
                <InfluenceEntries
                  events={events}
                  type={kind}
                  highlightId={response?.instance.id}
                  onOpen={(e, el) => editor.open(kind, e, el)}
                />
                <AddInfluenceButton
                  type={kind}
                  onClick={(el) => editor.open(kind, undefined, el)}
                />
              </section>
            ))}
            <section className="form-section">
              <details>
                <summary>
                  Signals noticed today{" "}
                  <span className="small"> · optional</span>
                </summary>
                <p>
                  If something already stood out, you can name it briefly. No
                  need to scan for anything. Choose up to three.
                </p>
                <Chips
                  items={list("signals")}
                  selected={signals}
                  onChange={setSignals}
                  max={3}
                />
              </details>
              <label>
                A short reflection <span>(optional)</span>
                <textarea
                  rows={3}
                  maxLength={700}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything you’d like to remember about the day?"
                />
              </label>
              <label>
                Did you use a perspective? <span>(optional)</span>
                <select
                  value={roleId}
                  onChange={(e) => {
                    setRoleId(e.target.value);
                    setHelp("");
                  }}
                >
                  <option value="">Not this time</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              {roleId && (
                <label>
                  Did it help?
                  <select
                    value={help}
                    onChange={(e) => setHelp(e.target.value)}
                  >
                    <option value="">Reflect later</option>
                    <option value="not_really">Not really</option>
                    <option value="a_little">A little</option>
                    <option value="a_lot">A lot</option>
                  </select>
                </label>
              )}
            </section>
            <div className="form-actions">
              <Button secondary onClick={() => go("home")}>
                Cancel
              </Button>
              <Button type="submit" disabled={state === undefined || busy}>
                {busy ? "Saving…" : "Save & return to my day"}
              </Button>
            </div>
          </div>
          <aside className="checkin-aside">
            <Material state={state ?? 1} response={response} />
            <h3>
              {state === undefined
                ? "Your material, still whole."
                : stateLabels[state]}
            </h3>
            <p>Translucent does not mean damaged.</p>
            <div className="aside-perspective">
              <p className="eyebrow">A PERSPECTIVE FOR THIS CONTEXT</p>
              <h3>{suggested?.name}</h3>
              <p>“{suggested?.corePhrase}”</p>
            </div>
            <p className="small">
              One or two check-ins a day can be enough. There is no need to get
              this exactly right.
            </p>
          </aside>
        </div>
      </form>
      <p className="small">
        Water and drying moments save independently; cancelling a check-in keeps
        them. You can edit or remove any moment.
      </p>
      {editor.editor}
    </>
  );
}
export function SourceScreen({
  data,
  commit,
  go,
  kind,
}: ScreenProps & { kind: Kind }) {
  const [value, setValue] = useState("");
  const items = [
    ...new Set([...sources[kind], ...data.profile.customSources[kind]]),
  ];
  const selected = data.profile.favourites[kind];
  return (
    <>
      <Heading
        eyebrow={kind === "signals" ? "OPTIONAL, ALWAYS" : "THE EVERYDAY"}
        title={
          kind === "water"
            ? "Water Sources"
            : kind === "drying"
              ? "Drying Sources"
              : "Signals noticed today"
        }
        description={
          kind === "water"
            ? "Name what adds load. Understanding the context can be enough."
            : kind === "drying"
              ? "Make room for what restores you. Small things belong here."
              : "A brief name for something you already noticed. No scanning, scoring, or investigating."
        }
      />
      <div className="library-layout">
        <section className={`form-section ${kind}`}>
          <h2>
            {kind === "signals"
              ? "Keep it lightweight."
              : "Keep familiar sources close."}
          </h2>
          <p>
            Choose favourites to show first in your check-in. These selections
            are preferences, not a log of today.
          </p>
          <Chips
            items={items}
            selected={selected}
            onChange={(next) => {
              void commit((d) => ({
                ...d,
                profile: {
                  ...d.profile,
                  favourites: { ...d.profile.favourites, [kind]: next },
                },
              }));
            }}
          />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const trimmed = value.trim();
              if (
                !trimmed ||
                items.some((s) => s.toLowerCase() === trimmed.toLowerCase())
              )
                return;
              if (
                await commit(
                  (d) => ({
                    ...d,
                    profile: {
                      ...d.profile,
                      customSources: {
                        ...d.profile.customSources,
                        [kind]: [...d.profile.customSources[kind], trimmed],
                      },
                    },
                  }),
                  "Personal source added.",
                )
              )
                setValue("");
            }}
            className="add-source"
          >
            <label>
              Add your own
              <input
                required
                maxLength={60}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  kind === "drying"
                    ? "e.g. A slow breakfast"
                    : "A short, familiar name"
                }
              />
            </label>
            <Button
              type="submit"
              disabled={
                !value.trim() ||
                items.some(
                  (s) => s.toLowerCase() === value.trim().toLowerCase(),
                )
              }
            >
              Add source
            </Button>
          </form>
          {data.profile.customSources[kind].length > 0 && (
            <details>
              <summary>Manage personal sources</summary>
              {data.profile.customSources[kind].map((s) => (
                <div className="manage-row" key={s}>
                  <span>{s}</span>
                  <button
                    className="text-link"
                    onClick={() =>
                      commit(
                        (d) => ({
                          ...d,
                          profile: {
                            ...d.profile,
                            customSources: {
                              ...d.profile.customSources,
                              [kind]: d.profile.customSources[kind].filter(
                                (x) => x !== s,
                              ),
                            },
                            favourites: {
                              ...d.profile.favourites,
                              [kind]: d.profile.favourites[kind].filter(
                                (x) => x !== s,
                              ),
                            },
                          },
                        }),
                        "Source removed. Existing history is preserved.",
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </details>
          )}
        </section>
        <aside className="quiet-card">
          <span className="large-symbol">
            {kind === "water" ? "◡" : kind === "drying" ? "✳" : "◌"}
          </span>
          <h2>
            {kind === "signals"
              ? "Notice. Then move on."
              : "Context, not a calculation."}
          </h2>
          <p>
            {kind === "signals"
              ? "Signals are deliberately secondary. You don’t need to check whether a feeling has disappeared."
              : "Your sources don’t calculate your state. Only you choose how your material feels."}
          </p>
          <Button onClick={() => go("check-in")}>Go to check-in</Button>
        </aside>
      </div>
    </>
  );
}

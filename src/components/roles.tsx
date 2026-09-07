import { useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { uid, type Helpfulness, type Role } from "@/lib/types";
import type { ScreenProps } from "./app";
import { Button, Heading, TextLink } from "./ui";
export function RolesScreen({
  data,
  commit,
  go,
  roles,
  custom,
  useRole,
}: ScreenProps & { custom: boolean; useRole: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Heading
        eyebrow="THE WAY YOU MEET THE MOMENT"
        title={custom ? "A perspective of your own." : "Borrow a perspective."}
        description="Not a personality. A little of someone’s steadiness, curiosity, or wider view."
        action={
          !custom ? (
            <Button secondary onClick={() => go("custom-roles")}>
              <Plus size={17} />
              Create a role
            </Button>
          ) : (
            <Button secondary onClick={() => go("roles")}>
              All perspectives
            </Button>
          )
        }
      />
      {custom ? (
        <form
          className="custom-role-form form-section"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const f = new FormData(e.currentTarget);
            const name = String(f.get("name")).trim(),
              quality = String(f.get("quality")).trim(),
              phrase = String(f.get("phrase")).trim();
            if (!name || !quality || !phrase) return;
            setBusy(true);
            const role: Role = {
              id: uid(),
              name,
              icon: String(f.get("icon")).trim() || "◇",
              description: quality,
              borrowedQuality: quality,
              bestFor: String(f.get("contexts"))
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
              corePhrase: phrase,
              note: String(f.get("note")).trim(),
              custom: true,
              tone: "violet",
              reappraisal: `I can borrow this quality: ${quality}. I can hold more than one interpretation of this moment and choose one useful next action without requiring certainty.`,
            };
            if (
              await commit(
                (d) => ({ ...d, roles: [...d.roles, role] }),
                "Your perspective is saved.",
              )
            )
              go("roles");
            setBusy(false);
          }}
        >
          <h2>Who represents steadiness to you?</h2>
          <p>
            You do not have to become someone else. Sometimes it helps to borrow
            their perspective.
          </p>
          <div className="field-pair">
            <label>
              Role name
              <input
                name="name"
                required
                maxLength={50}
                placeholder="e.g. Calm Pilot"
              />
            </label>
            <label>
              Icon <span>(optional)</span>
              <input name="icon" maxLength={4} placeholder="◇" />
            </label>
          </div>
          <label>
            What do you borrow from them?
            <input
              name="quality"
              required
              maxLength={160}
              placeholder="They pause before drawing conclusions."
            />
          </label>
          <label>
            Best situations <span>(separate with commas)</span>
            <input
              name="contexts"
              maxLength={200}
              placeholder="Waiting, uncertainty, travel"
            />
          </label>
          <label>
            One core phrase
            <textarea
              name="phrase"
              required
              maxLength={250}
              rows={2}
              placeholder="Observe first. Respond second."
            />
          </label>
          <label>
            Personal note <span>(optional)</span>
            <textarea name="note" maxLength={500} rows={2} />
          </label>
          <Button type="submit" disabled={busy}>
            Save perspective
          </Button>
        </form>
      ) : (
        <>
          <div className="roles-intro">
            <span>↗</span>
            <p>
              The panel helps you understand your state.
              <br />
              <strong>A role helps you choose your response.</strong>
            </p>
          </div>
          <div className="role-grid">
            {roles.map((role) => (
              <article className={`role-card ${role.tone}`} key={role.id}>
                <div className="section-top">
                  <span className="role-symbol">{role.icon}</span>
                  {data.profile.selectedRoleIds.includes(role.id) && (
                    <span className="small-pill">Kept close</span>
                  )}
                  {role.custom && <span className="small-pill">Your role</span>}
                </div>
                <h2>{role.name}</h2>
                <p>{role.description}</p>
                <blockquote>“{role.corePhrase}”</blockquote>
                <details>
                  <summary>Explore this perspective</summary>
                  <p>
                    <strong>Borrowed quality:</strong> {role.borrowedQuality}
                  </p>
                  <p>
                    <strong>Best for:</strong>{" "}
                    {role.bestFor.join(" · ") ||
                      "The moments that fit for you."}
                  </p>
                  {role.note && <p>{role.note}</p>}
                  {role.id === "boxer" && (
                    <p>
                      Care can include rest, support, hydration, and following
                      your treatment plan and medication as directed. This role
                      never asks you to ignore pain.
                    </p>
                  )}
                  <button
                    className="text-link"
                    onClick={() =>
                      commit((d) => ({
                        ...d,
                        profile: {
                          ...d.profile,
                          selectedRoleIds: d.profile.selectedRoleIds.includes(
                            role.id,
                          )
                            ? d.profile.selectedRoleIds.filter(
                                (id) => id !== role.id,
                              )
                            : [...d.profile.selectedRoleIds, role.id],
                        },
                      }))
                    }
                  >
                    {data.profile.selectedRoleIds.includes(role.id)
                      ? "Remove from favourites"
                      : "Keep this role close"}
                  </button>
                </details>
                <TextLink onClick={() => useRole(role.id)}>
                  Use this perspective
                </TextLink>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}
export function SessionScreen({
  data,
  commit,
  go,
  role,
}: ScreenProps & { role: Role }) {
  const [context, setContext] = useState("");
  const [appraisal, setAppraisal] = useState("");
  const [stage, setStage] = useState(0);
  const [observe, setObserve] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [reflection, setReflection] = useState("");
  const [help, setHelp] = useState<Helpfulness>();
  const anxious =
    appraisal.trim() ||
    "My mind is asking me to resolve this uncertainty immediately.";
  return (
    <>
      <Heading
        eyebrow="A REAPPRAISAL SESSION"
        title={
          stage === 2
            ? "Carry this into your day."
            : "A different way to hold this."
        }
        description="Change the meaning you give to something, without pretending it isn’t happening."
      />
      <div className="session-grid">
        <aside className={`session-role ${role.tone}`}>
          <span className="role-symbol">{role.icon}</span>
          <p className="eyebrow">YOUR BORROWED PERSPECTIVE</p>
          <h2>{role.name}</h2>
          <p>{role.borrowedQuality}</p>
          <blockquote>“{role.corePhrase}”</blockquote>
          <Button secondary onClick={() => go("roles")}>
            Choose another role
          </Button>
        </aside>
        <section className="session-content">
          {stage === 0 ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (context.trim()) setStage(1);
              }}
            >
              <label>
                What’s on your mind?
                <textarea
                  autoFocus
                  required
                  maxLength={700}
                  rows={4}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="A short concern or a little context is enough."
                />
              </label>
              <label>
                What is anxiety’s interpretation? <span>(optional)</span>
                <textarea
                  maxLength={500}
                  rows={3}
                  value={appraisal}
                  onChange={(e) => setAppraisal(e.target.value)}
                  placeholder="What story is your mind telling about this?"
                />
              </label>
              <Button type="submit" disabled={!context.trim()}>
                See another perspective <ArrowUpRight size={16} />
              </Button>
            </form>
          ) : (
            <>
              <div className="reappraisal-block">
                <p className="eyebrow">YOUR CONCERN</p>
                <p>{context}</p>
              </div>
              <div className="reappraisal-block anxious">
                <p className="eyebrow">
                  {appraisal.trim()
                    ? "ANXIETY’S INTERPRETATION"
                    : "ONE POSSIBLE ANXIOUS INTERPRETATION"}
                </p>
                <p>“{anxious}”</p>
              </div>
              <div className={`reappraisal-block reframed ${role.tone}`}>
                <p className="eyebrow">THROUGH {role.name.toUpperCase()}</p>
                <h2>{role.reappraisal}</h2>
              </div>
              <div className="carry-statement">
                <span>↳</span>
                <p>“{role.corePhrase}”</p>
              </div>
              {stage === 1 ? (
                <>
                  <details>
                    <summary>Optional: place this in Observe mode</summary>
                    <p>
                      This is your own choice for something already assessed,
                      not a medical assessment by the app.
                    </p>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={observe}
                        onChange={(e) => setObserve(e.target.checked)}
                      />
                      Already assessed. No new decision required unless
                      something meaningfully changes.
                    </label>
                    <p className="small">
                      This app does not determine whether a symptom is medically
                      serious. If you have a concerning or worsening health
                      issue, seek professional care.
                    </p>
                  </details>
                  <div className="form-actions">
                    <Button secondary onClick={() => setStage(0)}>
                      Back
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const id = uid();
                        if (
                          await commit(
                            (d) => ({
                              ...d,
                              sessions: [
                                ...d.sessions,
                                {
                                  id,
                                  timestamp: new Date().toISOString(),
                                  roleId: role.id,
                                  context: context.trim(),
                                  anxiousAppraisal: anxious,
                                  reappraisal: role.reappraisal,
                                  carry: role.corePhrase,
                                  observe,
                                },
                              ],
                            }),
                            "Perspective saved.",
                          )
                        ) {
                          setSessionId(id);
                          setStage(2);
                        }
                        setBusy(false);
                      }}
                    >
                      Carry this perspective
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="notice">
                    {observe
                      ? "No new decision required unless something meaningfully changes."
                      : "Choose one ordinary thing to return to. You do not need to check whether the feeling has gone."}
                  </div>
                  <Button onClick={() => go("home")}>Return to my day</Button>
                  <details>
                    <summary>Reflect when you’re ready</summary>
                    <p>You can also return to this session in Journey later.</p>
                    <label>
                      Did this perspective help?
                      <select
                        value={help || ""}
                        onChange={(e) => setHelp(e.target.value as Helpfulness)}
                      >
                        <option value="">Choose if useful</option>
                        <option value="not_really">Not really</option>
                        <option value="a_little">A little</option>
                        <option value="a_lot">A lot</option>
                      </select>
                    </label>
                    <label>
                      What changed? <span>(optional)</span>
                      <textarea
                        value={reflection}
                        onChange={(e) => setReflection(e.target.value)}
                        maxLength={500}
                      />
                    </label>
                    <Button
                      secondary
                      disabled={!help || busy}
                      onClick={async () => {
                        setBusy(true);
                        if (
                          await commit(
                            (d) => ({
                              ...d,
                              sessions: d.sessions.map((s) =>
                                s.id === sessionId
                                  ? { ...s, helpfulness: help, reflection }
                                  : s,
                              ),
                            }),
                            "Reflection saved.",
                          )
                        )
                          go("journey");
                        setBusy(false);
                      }}
                    >
                      Save reflection
                    </Button>
                  </details>
                </>
              )}
            </>
          )}
          <p className="session-boundary small">
            This perspective does not determine what a health concern means. If
            something feels genuinely concerning or changes meaningfully, seek
            appropriate professional care.
          </p>
        </section>
      </div>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, X } from "lucide-react";
import { sources } from "@/lib/catalog";
import {
  categoryId,
  getDailyDryingTotal,
  getDailyNetInfluence,
  getDailyWaterTotal,
  signedImpact,
  validImpact,
  validateInfluence,
} from "@/lib/influences";
import {
  uid,
  type AppData,
  type InfluenceInstance,
  type InfluenceType,
} from "@/lib/types";
import type { Commit } from "./app";
import { Button } from "./ui";
export interface MaterialResponse {
  instance: InfluenceInstance;
  origin?: { x: number; y: number };
  token: string;
}
interface EditorRequest {
  type: InfluenceType;
  event?: InfluenceInstance;
  origin?: { x: number; y: number };
}
export function useInfluenceEditor(
  data: AppData,
  commit: Commit,
  onAdded?: (response: MaterialResponse) => void,
) {
  const [request, setRequest] = useState<EditorRequest>();
  const open = (
    type: InfluenceType,
    event?: InfluenceInstance,
    element?: HTMLElement,
  ) => {
    const rect = element?.getBoundingClientRect();
    setRequest({
      type,
      event,
      origin: rect
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : undefined,
    });
  };
  return {
    open,
    editor: request ? (
      <InfluenceEditor
        key={request.event?.id || request.type}
        data={data}
        request={request}
        onClose={() => setRequest(undefined)}
        onSave={async (event) => {
          validateInfluence(event);
          const ok = await commit(
            (d) => {
              if (request.event && !d.influences.some((e) => e.id === event.id))
                throw new Error("This instance was removed in another tab.");
              return {
                ...d,
                influences: request.event
                  ? d.influences.map((e) => (e.id === event.id ? event : e))
                  : [...d.influences, event],
              };
            },
            request.event ? "Moment updated." : "Moment saved.",
          );
          if (ok) {
            setRequest(undefined);
            if (!request.event)
              onAdded?.({
                instance: event,
                origin: request.origin,
                token: uid(),
              });
          }
          return ok;
        }}
        onDelete={
          request.event
            ? async () => {
                const ok = await commit(
                  (d) => ({
                    ...d,
                    influences: d.influences.filter(
                      (e) => e.id !== request.event!.id,
                    ),
                  }),
                  "Moment deleted.",
                );
                if (ok) setRequest(undefined);
                return ok;
              }
            : undefined
        }
      />
    ) : null,
  };
}
function InfluenceEditor({
  data,
  request,
  onClose,
  onSave,
  onDelete,
}: {
  data: AppData;
  request: EditorRequest;
  onClose: () => void;
  onSave: (e: InfluenceInstance) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [type] = useState(request.type);
  const [category, setCategory] = useState(request.event?.categoryLabel || "");
  const [note, setNote] = useState(request.event?.note || "");
  const [impact, setImpact] = useState<number | null>(
    request.event?.impact ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    const el = dialog.current;
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    el?.showModal();
    return () => {
      el?.close();
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true });
    };
  }, []);
  const categories = [
    ...new Set([
      ...data.profile.favourites[type],
      ...sources[type],
      ...(type === "drying" ? ["Gym"] : []),
      ...data.profile.customSources[type],
      ...(category ? [category] : []),
      "Other",
    ]),
  ];
  const value = impact === null ? 5 : Math.abs(impact);
  const signed = (n: number) => (type === "water" ? n : -n);
  return createPortal(
    <dialog
      ref={dialog}
      className={`influence-dialog ${type}`}
      aria-labelledby="influence-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="influence-dialog-header">
        <div>
          <p className="eyebrow">A MOMENT, IN CONTEXT</p>
          <h2 id="influence-title">
            {request.event
              ? "Edit this moment"
              : type === "water"
                ? "Add water"
                : "Add drying"}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close moment"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !category || !validImpact(type, impact)) return;
          setBusy(true);
          setError("");
          try {
            const saved = await onSave({
              ...request.event,
              id: request.event?.id || uid(),
              userId: request.event?.userId || "local",
              type,
              categoryId: categoryId(type, category),
              categoryLabel: category,
              note: note.trim() || undefined,
              impact,
              timestamp: request.event?.timestamp || new Date().toISOString(),
              legacyIntensity: undefined,
            });
            if (!saved)
              setError("This moment was not saved. Please try again.");
          } catch {
            setError(
              "This moment was not saved. Check your choices and try again.",
            );
          }
          setBusy(false);
        }}
      >
        <fieldset disabled={busy}>
          <legend className="sr-only">Moment details</legend>
          <label className="event-category-label">
            {type === "water" ? "Choose what happened" : "Choose what helped"}
            <select
              autoFocus
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Choose a category</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            {type === "water" ? "What happened?" : "What helped?"}{" "}
            <span>(optional)</span>
            <textarea
              rows={2}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                type === "water"
                  ? "e.g. Woke several times overnight."
                  : "e.g. 45 minute workout after work."
              }
            />
          </label>
          <div className="impact-picker">
            <div className="impact-heading">
              <label htmlFor="event-impact">
                {type === "water"
                  ? "How much water did this add?"
                  : "How much did this help you dry?"}
              </label>
              <output htmlFor="event-impact" className="impact-value">
                {signedImpact(impact)}
              </output>
            </div>
            <input
              id="event-impact"
              type="range"
              min={1}
              max={10}
              step={1}
              value={value}
              aria-valuetext={
                impact === null
                  ? "Choose a perceived impact"
                  : `${signedImpact(impact)} ${type}`
              }
              aria-describedby="impact-explanation"
              onChange={(e) => setImpact(signed(Number(e.target.value)))}
              onPointerUp={(e) =>
                setImpact(signed(Number(e.currentTarget.value)))
              }
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  setImpact(signed(value));
                }
              }}
            />
            <div className="impact-ends">
              <span>{signedImpact(signed(1))} · A little</span>
              <span>{signedImpact(signed(10))} · A lot</span>
            </div>
            <p id="impact-explanation">
              {impact === null
                ? "Move the rail, use arrow keys, or press Space to choose."
                : "A broad impression is enough. There is no need to get it exact."}
            </p>
          </div>
          <p className="impact-boundary">
            These values describe how the event felt to you. They are not
            measurements of your nervous system. There is no need to balance
            water with drying.
          </p>
          {request.event && (
            <p className="small">
              Recorded{" "}
              {new Date(request.event.timestamp).toLocaleString("en-AU", {
                day: "numeric",
                month: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
              {request.event.demo ? " · Demo moment" : ""}
              {request.event.legacyIntensity
                ? ` · Original rating: ${request.event.legacyIntensity}`
                : ""}
            </p>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button secondary disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={busy || !category || !validImpact(type, impact)}
          >
            {busy ? "Saving…" : request.event ? "Save changes" : "Save moment"}
          </Button>
        </div>
      </form>
      {onDelete && (
        <div className="event-delete">
          {confirmDelete ? (
            <>
              <p>Delete this individual moment? This cannot be undone.</p>
              <Button
                secondary
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                Keep moment
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  if (!(await onDelete()))
                    setError("Could not delete this moment. Please try again.");
                  setBusy(false);
                }}
              >
                Delete moment
              </Button>
            </>
          ) : (
            <button
              className="text-link"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
            >
              Delete this moment
            </button>
          )}
        </div>
      )}
    </dialog>,
    document.body,
  );
}
export function InfluenceEntries({
  events,
  type,
  onOpen,
  highlightId,
  detail = false,
  limit,
}: {
  events: InfluenceInstance[];
  type: InfluenceType;
  onOpen: (e: InfluenceInstance, element: HTMLElement) => void;
  highlightId?: string;
  detail?: boolean;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [highlight, setHighlight] = useState<string>();
  useEffect(() => {
    setHighlight(highlightId);
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlight(undefined), 3200);
    return () => clearTimeout(timer);
  }, [highlightId]);
  const filtered = events.filter((e) => e.type === type);
  const visible = limit && !expanded ? filtered.slice(-limit) : filtered;
  return (
    <div className="influence-entries">
      {visible.length ? (
        visible.map((event) => (
          <button
            key={event.id}
            type="button"
            className={`influence-entry ${highlight === event.id ? "just-logged" : ""}`}
            data-event-id={event.id}
            aria-label={`Open ${event.categoryLabel}, ${event.impact === null ? "impact not recorded" : signedImpact(event.impact)}${event.note ? `, ${event.note}` : ""}`}
            onClick={(e) => onOpen(event, e.currentTarget)}
          >
            <span className={`event-impact ${type}`}>
              {signedImpact(event.impact)}
            </span>
            <span className="event-copy">
              <span className="event-category">
                {event.categoryLabel}
                {event.demo && <small>demo</small>}
              </span>
              {event.note && <span className="event-note">{event.note}</span>}
              {event.impact === null && (
                <span className="event-note">
                  Impact not recorded
                  {event.legacyIntensity
                    ? ` · originally ${event.legacyIntensity}`
                    : ""}
                </span>
              )}
              {detail && (
                <time dateTime={event.timestamp}>
                  {new Date(event.timestamp).toLocaleTimeString("en-AU", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              )}
            </span>
            <span className="event-open" aria-hidden>
              ↗
            </span>
          </button>
        ))
      ) : (
        <p className="empty-inline">
          {type === "water"
            ? detail
              ? "No water logged for this day."
              : "No water logged today."
            : detail
              ? "No drying moments logged for this day."
              : "No drying moments logged yet."}
        </p>
      )}
      {limit && filtered.length > limit && (
        <button
          type="button"
          className="text-link"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded
            ? "Show fewer moments"
            : `See all ${filtered.length} moments`}
        </button>
      )}
    </div>
  );
}
export function AddInfluenceButton({
  type,
  onClick,
}: {
  type: InfluenceType;
  onClick: (element: HTMLElement) => void;
}) {
  return (
    <button
      type="button"
      className="text-link add-influence"
      onClick={(e) => onClick(e.currentTarget)}
    >
      <Plus size={14} />
      {type === "water" ? "Add water" : "Add drying"}
    </button>
  );
}
export function DailyInfluences({
  events,
  date,
  title = "Today’s influences",
}: {
  events: InfluenceInstance[];
  date: string | Date;
  title?: string;
}) {
  const water = getDailyWaterTotal(events, date),
    drying = getDailyDryingTotal(events, date),
    net = getDailyNetInfluence(events, date);
  return (
    <section className="daily-influences" aria-label={title}>
      <p className="eyebrow">{title}</p>
      <dl>
        <div>
          <dt>Water</dt>
          <dd>{water ? `+${water}` : "0"}</dd>
        </div>
        <div>
          <dt>Drying</dt>
          <dd>{drying}</dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{signedImpact(net)}</dd>
        </div>
      </dl>
      <p>
        Perceived influences, not a score or a target.
        {events.some((e) => e.impact === null)
          ? " Unrated older moments are excluded."
          : ""}
      </p>
    </section>
  );
}

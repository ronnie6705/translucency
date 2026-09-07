import { useEffect, useState } from "react";
import type { AppData } from "@/lib/types";
import { dayKey } from "@/lib/types";
export function GentleReminder({
  data,
  onCheckIn,
}: {
  data: AppData;
  onCheckIn: () => void;
}) {
  const [dismissed, setDismissed] = useState(true);
  const hour = new Date().getHours();
  const period =
    hour >= 6 && hour < 12
      ? "morning"
      : hour >= 18 && hour < 23
        ? "evening"
        : null;
  const key = `translucency-reminder-${dayKey(new Date())}-${period}`;
  const wanted =
    period &&
    (data.profile.reminders === period || data.profile.reminders === "both");
  const alreadyChecked = data.checkIns.some(
    (c) =>
      !c.demo &&
      dayKey(c.timestamp) === dayKey(new Date()) &&
      (period === "morning"
        ? new Date(c.timestamp).getHours() < 12
        : new Date(c.timestamp).getHours() >= 18),
  );
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(key) === "dismissed");
    } catch {
      setDismissed(false);
    }
  }, [key]);
  if (!wanted || alreadyChecked || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(key, "dismissed");
    } catch {
      /* This lightweight preference can remain in memory. */
    }
  };
  return (
    <div className="gentle-reminder">
      <p>
        {period === "morning"
          ? "How does your panel feel today?"
          : "What added water today? What helped you dry?"}{" "}
        <span>Only if a moment of reflection would help.</span>
      </p>
      <button
        className="text-link"
        onClick={() => {
          dismiss();
          onCheckIn();
        }}
      >
        Check in →
      </button>
      <button className="text-link" onClick={dismiss}>
        Not now
      </button>
    </div>
  );
}

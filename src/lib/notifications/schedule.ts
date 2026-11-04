import { validLiveTimer } from '../../modules/rhythm/live-timer';

/** One alert per task per launch, even when a task is split or rescheduled. */
export function taskStartNotification(payload: unknown, enabledAt: string, now = Date.now()) {
  const timer = (payload as { liveTimer?: unknown } | null)?.liveTimer;
  if (!validLiveTimer(timer)) return null;
  const block = timer.blocks.find(b => !b.isBreak && Date.parse(b.start) <= now && now < Date.parse(b.end));
  if (!block || timer.completedTaskIds?.includes(block.taskId) || timer.skippedTaskIds?.includes(block.taskId)) return null;
  const start = Date.parse(block.start);
  // Do not replay old tasks after an outage or when enabling mid-task.
  if (start < Date.parse(enabledAt) || now - start > 90_000) return null;
  if (timer.endsAt && now >= Date.parse(timer.endsAt)) return null;
  const run = timer.runId || `${timer.id}:${timer.startedAt || timer.blocks[0]?.start}`;
  return {
    key: JSON.stringify([run, block.taskId]),
    title: `Starting now: ${block.taskName.slice(0, 120)}`,
    body: `${Math.max(1, Math.round((Date.parse(block.end) - start) / 60000))} minutes · Rhythm`,
    expiresAt: Math.min(Date.parse(block.end), start + 90_000),
  };
}

/** Only send to known browser push services, never arbitrary user-supplied URLs. */
export function validPushSubscription(value: unknown): value is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!value || typeof value !== 'object') return false;
  const s = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof s.endpoint !== 'string' || s.endpoint.length > 2048) return false;
  try {
    const url = new URL(s.endpoint);
    const allowed = url.hostname === 'fcm.googleapis.com' || url.hostname === 'updates.push.services.mozilla.com'
      // Chromium's alternative FCM endpoint, also returned by Arc on Windows.
      || (url.hostname === 'jmt17.google.com' && url.pathname.startsWith('/fcm/send/'))
      || url.hostname.endsWith('.push.apple.com') || url.hostname.endsWith('.notify.windows.com');
    return allowed && url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.hash
      && typeof s.keys?.p256dh === 'string' && /^[A-Za-z0-9_-]{87}$/.test(s.keys.p256dh)
      && typeof s.keys?.auth === 'string' && /^[A-Za-z0-9_-]{22}$/.test(s.keys.auth);
  } catch { return false; }
}

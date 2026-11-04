import { json, pushConfigured, pushDatabase } from '@/lib/notifications/server';
import { validPushSubscription } from '@/lib/notifications/schedule';

export const runtime = 'nodejs';

export async function GET() {
  return json({ configured: pushConfigured(), publicKey: pushConfigured() ? process.env.WEB_PUSH_PUBLIC_KEY : null });
}

async function manage(request: Request, remove: boolean) {
  if (!pushConfigured()) return json({ error: 'Task notifications are not configured on this server yet.' }, 503);
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return json({ error: 'Sign in to manage notifications.' }, 401);
  const db = pushDatabase();
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return json({ error: 'Sign in again to manage notifications.' }, 401);
  const raw = await request.text();
  if (raw.length > 4096) return json({ error: 'Invalid subscription.' }, 400);
  let subscription: unknown;
  try { subscription = JSON.parse(raw); } catch { return json({ error: 'Invalid subscription.' }, 400); }
  if (!validPushSubscription(subscription)) return json({ error: 'This browser push service is not supported.' }, 400);
  if (remove) {
    const result = await db.from('rhythm_push_subscriptions').delete().eq('endpoint', subscription.endpoint).eq('user_id', user.id);
    return result.error ? json({ error: 'Could not disable notifications. Please retry.' }, 503) : json({ enabled: false });
  }
  // The endpoint is an unguessable browser capability; a new account takes ownership
  // only after an explicit enable action on the device. Preserve enabled_at on refresh.
  const existing = await db.from('rhythm_push_subscriptions').select('user_id,enabled_at').eq('endpoint', subscription.endpoint).maybeSingle();
  if (existing.error) return json({ error: 'Notification storage is not ready.' }, 503);
  const result = await db.from('rhythm_push_subscriptions').upsert({
    endpoint: subscription.endpoint, user_id: user.id, subscription,
    enabled_at: existing.data?.user_id === user.id ? existing.data.enabled_at : new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  return result.error ? json({ error: 'Could not enable notifications. Please retry.' }, 503) : json({ enabled: true });
}

export async function POST(request: Request) { return manage(request, false); }
export async function DELETE(request: Request) { return manage(request, true); }

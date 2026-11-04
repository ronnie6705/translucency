import { createHash, timingSafeEqual } from 'node:crypto';
import webpush from 'web-push';
import { json, pushConfigured, pushDatabase } from '@/lib/notifications/server';
import { taskStartNotification, validPushSubscription } from '@/lib/notifications/schedule';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const secret = process.env.RHYTHM_PUSH_CRON_SECRET;
  const supplied = request.headers.get('authorization') || '';
  if (!secret || !timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(`Bearer ${secret}`).digest())) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!pushConfigured()) return json({ error: 'Push is not configured.' }, 503);
  const db = pushDatabase();
  let sent = 0, failed = 0, after = '';
  // Keyset pagination avoids silently missing devices beyond PostgREST's row cap.
  for (;;) {
    const query = db.from('rhythm_push_subscriptions').select('id,user_id,subscription,enabled_at').order('id').limit(100);
    const devices = await (after ? query.gt('id', after) : query);
    if (devices.error) return json({ error: 'Could not read subscriptions.' }, 503);
    if (!devices.data.length) break;
    const documents = await db.from('workspace_documents').select('user_id,payload,revision').eq('module', 'rhythm').in('user_id', [...new Set(devices.data.map(d => d.user_id))]);
    if (documents.error) return json({ error: 'Could not read live schedules.' }, 503);
    const schedules = new Map(documents.data.map(d => [d.user_id, d]));
    for (let i = 0; i < devices.data.length; i += 10) await Promise.all(devices.data.slice(i, i + 10).map(async device => {
      const doc = schedules.get(device.user_id);
      const notification = doc && taskStartNotification(doc.payload, device.enabled_at);
      if (!notification || !validPushSubscription(device.subscription)) return;
      const claim = await db.rpc('claim_rhythm_push', { device_id: device.id, owner_id: device.user_id, document_revision: doc.revision, notification_key: notification.key });
      if (claim.error) { failed++; return; }
      if (!claim.data) return;
      try {
        await webpush.sendNotification(device.subscription, JSON.stringify({ ...notification, tag: createHash('sha256').update(notification.key).digest('hex'), url: '/#rhythm-timeblocks' }), {
          vapidDetails: { subject: process.env.WEB_PUSH_SUBJECT!, publicKey: process.env.WEB_PUSH_PUBLIC_KEY!, privateKey: process.env.WEB_PUSH_PRIVATE_KEY! },
          TTL: Math.max(0, Math.floor((notification.expiresAt - Date.now()) / 1000)), urgency: 'high', timeout: 8000,
        });
        sent++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from('rhythm_push_subscriptions').delete().eq('id', device.id);
        // Retry definite rejections, but not ambiguous timeouts: the provider may
        // already have accepted those. The unique claim prevents duplicate alerts.
        if (status === 429 || (status && status >= 500)) await db.from('rhythm_push_deliveries').delete().eq('subscription_id', device.id).eq('event_key', notification.key);
      }
    }));
    after = devices.data.at(-1)!.id;
  }
  return json({ sent, failed }, failed ? 503 : 200);
}

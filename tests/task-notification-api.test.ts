import test from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { POST as subscribe } from '../src/app/api/notifications/route';
import { POST as dispatch } from '../src/app/api/notifications/dispatch/route';

test('authenticated subscription and scheduled dispatch use the real API flow without duplicate pushes', async () => {
  const oldFetch = globalThis.fetch, oldSend = webpush.sendNotification;
  const env = { ...process.env };
  const user = '00000000-0000-4000-8000-000000000001';
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
  const now = Date.now();
  const timer = { id: 'timer', runId: 'run', name: 'Today', timezone: 'UTC', blocks: [
    { id: 'block', taskId: 'task', taskName: 'Focus', start: new Date(now - 1000).toISOString(), end: new Date(now + 600000).toISOString(), isBreak: false },
  ] };
  let saved: any, claimed = false, sent = 0, providerStatus = 201, removed = false;
  try {
    Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
      WEB_PUSH_PUBLIC_KEY: 'public', WEB_PUSH_PRIVATE_KEY: 'private', WEB_PUSH_SUBJECT: 'mailto:test@example.test', RHYTHM_PUSH_CRON_SECRET: 'test-secret' });
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const method = init?.method || 'GET';
      const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.pathname === '/auth/v1/user') return reply({ id: user, aud: 'authenticated' });
      if (url.pathname.endsWith('/rhythm_push_subscriptions')) {
        if (method === 'POST') { saved = JSON.parse(init!.body as string); return reply(null); }
        if (method === 'DELETE') { removed = true; return reply(null); }
        if (url.searchParams.has('endpoint')) return reply(null);
        return reply(url.searchParams.has('id') ? [] : [{ id: 'device', user_id: user, subscription, enabled_at: new Date(now - 5000).toISOString() }]);
      }
      if (url.pathname.endsWith('/workspace_documents')) return reply([{ user_id: user, revision: 4, payload: { liveTimer: timer } }]);
      if (url.pathname.endsWith('/claim_rhythm_push')) {
        const args = JSON.parse(init!.body as string);
        assert.equal(args.owner_id, user);
        assert.equal(args.document_revision, 4);
        const first = !claimed; claimed = true; return reply(first);
      }
      throw new Error(`Unexpected mock request ${url.pathname}`);
    };
    webpush.sendNotification = async (_subscription, payload, options) => {
      assert.equal(JSON.parse(payload as string).title, 'Starting now: Focus');
      assert.ok(options!.TTL! <= 90);
      if (providerStatus !== 201) throw { statusCode: providerStatus };
      sent++;
      return { statusCode: 201, body: '', headers: {} };
    };
    assert.equal((await subscribe(new Request('https://rhythm.test/api/notifications', { method: 'POST' }))).status, 401);
    assert.equal((await subscribe(new Request('https://rhythm.test/api/notifications', {
      method: 'POST', headers: { Authorization: 'Bearer synthetic-user-token' }, body: JSON.stringify({ ...subscription, user_id: 'attacker' }),
    }))).status, 200);
    assert.equal(saved.user_id, user);
    assert.equal((await dispatch(new Request('https://rhythm.test/api/notifications/dispatch', { method: 'POST' }))).status, 401);
    const request = () => new Request('https://rhythm.test/api/notifications/dispatch', { method: 'POST', headers: { Authorization: 'Bearer test-secret' } });
    assert.equal((await dispatch(request())).status, 200);
    assert.equal((await dispatch(request())).status, 200);
    assert.equal(sent, 1);
    claimed = false; providerStatus = 410;
    assert.equal((await dispatch(request())).status, 503);
    assert.equal(removed, true);
  } finally {
    globalThis.fetch = oldFetch; webpush.sendNotification = oldSend;
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
  }
});

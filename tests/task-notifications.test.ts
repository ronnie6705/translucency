import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { taskStartNotification, validPushSubscription } from '../src/lib/notifications/schedule';

const start = Date.parse('2026-11-04T01:00:00Z');
const iso = (offset: number) => new Date(start + offset).toISOString();
const block = { id: 'block', taskId: 'task', taskName: 'Write proposal', start: iso(0), end: iso(600000), isBreak: false };
const timer = { id: 'plan', runId: 'run-1', name: 'Today', timezone: 'Australia/Sydney', blocks: [block] };
const alert = (liveTimer: unknown = timer, now = start) => taskStartNotification({ liveTimer }, iso(-1000), now);

test('task alerts follow the current schedule and expire instead of replaying', () => {
  assert.equal(alert()?.title, 'Starting now: Write proposal');
  assert.equal(alert(timer, start - 1), null);
  assert.equal(alert(timer, start + 90001), null);
  assert.equal(alert({ ...timer, blocks: [{ ...block, isBreak: true }] }), null);
  assert.equal(alert({ ...timer, completedTaskIds: ['task'] }), null);
  assert.equal(alert({ ...timer, skippedTaskIds: ['task'] }), null);
  assert.equal(alert({ ...timer, blocks: [{ ...block, start: iso(300000) }] }), null);
  assert.equal(alert(undefined, start + 600000), null);
  assert.equal(taskStartNotification({ liveTimer: timer }, iso(1), start + 10), null);
  assert.equal(taskStartNotification({}, iso(-1000), start), null);
  assert.equal(taskStartNotification({ liveTimer: { blocks: 'bad' } }, iso(-1000), start), null);
});

test('deduplication survives reflow and task splits but allows a new launch', () => {
  const original = alert()!;
  assert.equal(alert({ ...timer, blocks: [{ ...block, id: 'new-part', start: iso(1000) }] }, start + 1000)?.key, original.key);
  assert.notEqual(alert({ ...timer, runId: 'run-2' })?.key, original.key);
});

test('subscriptions cannot target local, arbitrary, or spoofed push endpoints', () => {
  const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/capability', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
  assert.equal(validPushSubscription(subscription), true);
  assert.equal(validPushSubscription({ ...subscription, endpoint: 'https://jmt17.google.com/fcm/send/capability' }), true);
  for (const endpoint of ['https://jmt17.google.com.evil.test/fcm/send/a', 'https://jmt17.google.com/other', 'https://other.google.com/fcm/send/a', 'http://jmt17.google.com/fcm/send/a', 'https://jmt17.google.com:444/fcm/send/a', 'https://user@jmt17.google.com/fcm/send/a']) {
    assert.equal(validPushSubscription({ ...subscription, endpoint }), false);
  }
  for (const endpoint of ['http://fcm.googleapis.com/a', 'https://localhost/a', 'https://fcm.googleapis.com.evil.test/a', 'https://fcm.googleapis.com:444/a', 'https://user@fcm.googleapis.com/a']) {
    assert.equal(validPushSubscription({ ...subscription, endpoint }), false);
  }
  assert.equal(validPushSubscription({ ...subscription, keys: { auth: 'bad' } }), false);
});

test('database claims isolate accounts, reject changed schedules, and deduplicate concurrent dispatches', async () => {
  const pg = new PGlite();
  const alice = '00000000-0000-4000-8000-000000000001';
  const bob = '00000000-0000-4000-8000-000000000002';
  const device = '00000000-0000-4000-8000-000000000003';
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as 'select null::uuid';
      insert into auth.users values ('${alice}'), ('${bob}');`);
    for (const file of ['202609080001_account_sync.sql', '202611040001_task_notifications.sql']) {
      await pg.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    await pg.query('insert into public.workspace_documents(user_id,module,payload) values ($1,$2,$3)', [alice, 'rhythm', JSON.stringify({ liveTimer: timer })]);
    await pg.query('insert into public.rhythm_push_subscriptions(id,user_id,endpoint,subscription) values ($1,$2,$3,$4)', [device, alice, 'https://example.test', '{}']);
    const claim = (owner = alice, revision = 1, key = 'run/task') => pg.query<{ claimed: boolean }>('select public.claim_rhythm_push($1,$2,$3,$4) as claimed', [device, owner, revision, key]);
    await pg.exec('set role authenticated');
    await assert.rejects(pg.query('select * from public.rhythm_push_subscriptions'), /permission denied/);
    await assert.rejects(claim(), /permission denied/);
    await pg.exec('reset role; set role service_role');
    assert.equal((await claim(bob)).rows[0].claimed, false);
    assert.equal((await claim(alice, 2)).rows[0].claimed, false);
    const results = await Promise.all([claim(), claim()]);
    assert.equal(results.filter(r => r.rows[0].claimed).length, 1);
    assert.equal((await claim(alice, 1, 'new-run/task')).rows[0].claimed, true);
    await pg.exec(`reset role; delete from auth.users where id='${alice}'`);
    assert.equal((await pg.query('select * from public.rhythm_push_deliveries')).rows.length, 0);
    assert.equal((await claim()).rows[0].claimed, false);
  } finally { await pg.close(); }
});

test('service worker shows valid alerts and opens the live timeblocks page', async () => {
  const handlers = new Map<string, (event: any) => void>();
  const shown: any[] = [], opened: string[] = [];
  runInNewContext(await readFile(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL, Date,
    self: { addEventListener: (name: string, fn: (event: any) => void) => handlers.set(name, fn),
      location: { origin: 'https://rhythm.test' }, registration: { showNotification: async (...args: any[]) => shown.push(args) },
      clients: { matchAll: async () => [], openWindow: async (url: string) => opened.push(url) } },
  });
  let pending: Promise<unknown> = Promise.resolve();
  const waitUntil = (promise: Promise<unknown>) => { pending = promise; };
  handlers.get('push')!({ data: { json: () => ({ title: 'Task', tag: 'unique', expiresAt: Date.now() + 10000 }) }, waitUntil });
  await pending;
  assert.equal(shown.length, 1);
  assert.equal(shown[0][1].renotify, false);
  handlers.get('push')!({ data: { json: () => ({ title: 'Old', tag: 'old', expiresAt: 1 }) }, waitUntil });
  await pending;
  assert.equal(shown.length, 1);
  handlers.get('notificationclick')!({ notification: { close() {} }, waitUntil });
  await pending;
  assert.deepEqual(opened, ['https://rhythm.test/#rhythm-timeblocks']);
});

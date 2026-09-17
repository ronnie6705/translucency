// Synthetic Supabase responses only: this suite never touches real accounts or records.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:3002";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  timezoneId: "Australia/Sydney",
  acceptDownloads: true,
});
const user = {
  id: "00000000-0000-4000-8000-000000000091",
  email: "timer@example.test",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const task = (id, name) => ({
  id,
  name,
  durationMinutes: 390,
  energyRequired: 5,
  priority: 2,
});
const space = (id, name, icon) => ({
  id,
  name,
  icon,
  color: "#ffffff",
  createdAt: "2026-09-10T00:00:00Z",
  tasks: [],
});
const docs = new Map([
  [
    "rhythm",
    {
      payload: {
        version: 1,
        spaces: [
          {
            ...space("home", "Home", "home"),
            tasks: [
              task("a", "Task Name"),
              task("b", "Second Task"),
              task("c", "Third Task"),
            ],
          },
          space("work", "Work", "work"),
        ],
        taskLists: [1, 2, 3].map((n) => ({
          id: "l" + n,
          name: "Task List " + n,
          spaceId: "home",
          createdAt: "2026-09-10T00:00:00Z",
          tasks: [],
        })),
        timeblocks: [],
      },
      revision: 1,
    },
  ],
]);
const errors = [];
await context.route(/https?:\/\/[^/]+\/(auth|rest)\/v1\//, async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const path = url.pathname;
  const reply = (json) => route.fulfill({ json });
  if (request.method() === "OPTIONS")
    return route.fulfill({
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
      },
    });
  const token = [
    Buffer.from("{}").toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + 36000,
      }),
    ).toString("base64url"),
    "test",
  ].join(".");
  if (path.endsWith("/token"))
    return reply({
      access_token: token,
      refresh_token: "synthetic",
      expires_in: 864000,
      token_type: "bearer",
      user,
    });
  if (path.endsWith("/user")) return reply(user);
  if (path.endsWith("/logout")) return reply({});
  if (path.endsWith("/workspace_documents")) {
    const doc = docs.get(url.searchParams.get("module")?.replace("eq.", ""));
    return reply(doc ? [doc] : []);
  }
  if (path.endsWith("/rpc/save_workspace_document")) {
    const body = request.postDataJSON();
    const revision = body.expected_revision + 1;
    docs.set(body.document_module, {
      payload: body.document_payload,
      revision,
    });
    return reply(revision);
  }
  throw Error("Unexpected Supabase request " + path);
});
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });
async function cached() {
  return page.evaluate(
    (id) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open("rhythm-account-cache-v1", 1);
        r.onsuccess = () => {
          const db = r.result,
            q = db
              .transaction("documents")
              .objectStore("documents")
              .get(id + ":rhythm");
          q.onsuccess = () => {
            resolve(q.result.payload);
            db.close();
          };
          q.onerror = () => reject(q.error);
        };
        r.onerror = () => reject(r.error);
      }),
    user.id,
  );
}

const modal = page.getByRole('dialog', { name: 'Live timer', exact: true });
const block = id => modal.locator(`.live-timer-block[data-task-id="${id}"]`);
const complete = id => block(id).getByRole('button', { name: `Complete Task ${id}`, exact: true });
const skip = id => block(id).getByRole('button', { name: `Could not complete Task ${id}`, exact: true });
let serial = 0;
async function seed(withBreak = false) {
  if (await modal.count()) await button('Close live timer').click();
  const iso = minutes => new Date(Date.UTC(2026, 8, 14, 2, minutes)).toISOString();
  const entries = withBreak ? [['a', 0, 20], ['rest', 20, 30], ['b', 30, 50], ['c', 50, 60]] : [['a', 0, 30], ['b', 30, 50], ['c', 50, 60]];
  const blocks = entries.map(([id, start, end]) => ({ id: `block-${id}`, taskId: id, taskName: `Task ${id}`, start: iso(start), end: iso(end), isBreak: id === 'rest', energyRequired: 3 }));
  const timer = { id: `timer-${serial++}`, name: 'Completion test', timezone: 'Australia/Sydney', startedAt: iso(0), endsAt: iso(60), blocks };
  await page.evaluate(async ({ timer, userId }) => {
    const db = await new Promise(resolve => { const request = indexedDB.open('rhythm-account-cache-v1', 1); request.onsuccess = () => resolve(request.result); });
    await new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite'), store = tx.objectStore('documents'), key = userId + ':rhythm', request = store.get(key);
      request.onsuccess = () => {
        const value = request.result;
        value.payload.liveTimer = timer;
        value.payload.spaces = [{ id: 'home', name: 'Home', icon: 'home', color: '#ffffff', createdAt: timer.startedAt, tasks: timer.blocks.filter(b => !b.isBreak).map(b => ({ id: b.taskId, name: b.taskName, durationMinutes: (Date.parse(b.end) - Date.parse(b.start)) / 60000, energyRequired: 3, priority: 1 })) }];
        value.payload.taskLists = [];
        value.payload.timeblocks = [];
        value.dirty = true;
        store.put(value, key);
      };
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
    db.close();
    window.dispatchEvent(new Event('rhythm-library-updated'));
  }, { timer, userId: user.id });
  await page.getByRole('button', { name: 'Open live timer: Completion test', exact: true }).click();
  await expect(modal).toBeVisible();
  await expect(modal.locator('.live-timer-block')).toHaveCount(entries.length);
}
async function noEffects() {
  await expect(modal.locator('.block-pop-effects, .block-clear-wave, .block-fragment, .block-impact-ring')).toHaveCount(0);
  assert.equal(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
}
try {
  await page.clock.setFixedTime(new Date('2026-09-14T02:00:00Z'));
  await page.goto(base + '/#rhythm-timeblocks');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
  await button('Sign in').click();
  await expect(page.locator('#rhythm-timeblocks')).toBeVisible();
  fs.mkdirSync('test-results/live-completion', { recursive: true });
  await seed();
  await expect(complete('a').locator('img')).toHaveAttribute('src', '/rhythm/timer/check.svg');
  await expect(skip('a').locator('img')).toHaveAttribute('src', '/rhythm/timer/cross.svg');
  await expect.poll(() => complete('a').locator('img').evaluate(img => img.complete && img.naturalWidth === 24)).toBe(true);
  await expect.poll(() => skip('a').locator('img').evaluate(img => img.complete && img.naturalWidth === 24)).toBe(true);
  const titleBounds = await block('a').locator('h3').boundingBox();
  const actionBounds = await skip('a').boundingBox();
  assert.ok(actionBounds.x > titleBounds.x + titleBounds.width);
  assert.ok(Math.abs(actionBounds.y + actionBounds.height / 2 - (titleBounds.y + titleBounds.height / 2)) < 8);
  await block('a').locator('h3').click();
  await expect(complete('a')).toHaveAttribute('aria-pressed', 'false');
  const before = await block('b').boundingBox();
  await complete('a').hover();
  await expect.poll(() => block('a').evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
  await complete('a').click();
  await expect(block('a')).toHaveAttribute('data-clear-phase', 'clearing');
  await expect(complete('a')).toHaveAttribute('aria-pressed', 'true');
  await expect(block('a')).toHaveAttribute('data-clear-phase', 'popping');
  await expect(modal.locator('.block-fragment')).toHaveCount(10);
  await page.evaluate(() => document.getAnimations().forEach(a => a.pause()));
  await page.screenshot({ path: 'test-results/live-completion/desktop-pop.png' });
  await page.evaluate(() => document.getAnimations().forEach(a => a.play()));
  await expect(block('a')).toHaveCount(0);
  await expect(complete('b')).toBeFocused();
  await expect.poll(async () => (await block('b').boundingBox()).height).toBeGreaterThan(before.height + 30);
  await expect(block('b').locator('.live-timer-badges')).toContainText('40 mins');
  await expect(block('c').locator('.live-timer-badges')).toContainText('20 mins');
  assert.equal((await cached()).spaces[0].tasks[0].completed, true);
  await noEffects();
  await page.screenshot({ path: 'test-results/live-completion/desktop-expanded.png' });

  await button('Close live timer').click();
  await page.reload();
  await page.getByRole('button', { name: 'Open live timer: Completion test', exact: true }).click();
  await expect(block('a')).toHaveCount(0);
  await expect(block('b').locator('.live-timer-badges')).toContainText('40 mins');

  await seed();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    window.timerWrites = 0;
    IDBObjectStore.prototype.put = function(value, ...args) { if (value?.dirty && value?.payload?.liveTimer) window.timerWrites++; return put.call(this, value, ...args); };
    for (const id of ['a', 'a', 'b']) document.querySelector(`dialog .live-timer-block[data-task-id="${id}"] button`).click();
  });
  await expect(modal.locator('.live-timer-complete')).toHaveCount(1);
  assert.equal(await page.evaluate(() => window.timerWrites), 2);
  await expect(block('c').locator('.live-timer-badges')).toContainText('1h');
  await complete('c').focus();
  await page.keyboard.press('Space');
  await expect(modal.locator('.live-timer-complete')).toHaveCount(0);
  await expect(modal.getByRole('status')).toHaveText('All tasks complete. Nicely done.');
  await expect(modal.locator('.live-timer-card')).toBeFocused();
  await noEffects();

  await seed(true);
  const rest = (await cached()).liveTimer.blocks.find(b => b.isBreak);
  await complete('a').click();
  await expect(block('a')).toHaveCount(0);
  await expect(block('b')).toHaveCount(2);
  await complete('b').first().click();
  await expect(block('b')).toHaveCount(0);
  assert.deepEqual((await cached()).liveTimer.blocks.find(b => b.isBreak), rest);
  await expect(block('rest').getByRole('button')).toHaveCount(0);
  await noEffects();

  await seed();
  await page.evaluate(() => {
    const request = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = () => { navigator.locks.request = request; return new Promise((_, reject) => setTimeout(() => reject(new Error('Synthetic timer failure')), 850)); };
  });
  await complete('a').click();
  await expect(modal.getByRole('alert')).toContainText('Your change was not saved');
  await expect(complete('a')).toHaveAttribute('aria-pressed', 'false');
  await expect(block('b').locator('.live-timer-badges')).toContainText('20 mins');
  assert.equal((await cached()).liveTimer.blocks.length, 3);
  await noEffects();

  await seed();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await complete('a').focus();
  await page.keyboard.press('Enter');
  await expect(modal.locator('.block-fragment')).toHaveCount(0);
  await expect(block('a')).toHaveCount(0);
  await expect(complete('b')).toBeFocused();
  await noEffects();
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.setViewportSize({ width: 390, height: 844 });
  await seed();
  assert.ok((await skip('a').boundingBox()).width >= 44);
  await page.screenshot({ path: 'test-results/live-completion/mobile-tick-cross.png' });
  await complete('b').click();
  await expect(block('b')).toHaveCount(0);
  await expect(block('a').locator('.live-timer-badges')).toContainText('45 mins');
  await expect.poll(async () => (await block('a').boundingBox()).height).toBeGreaterThan(150);
  await page.screenshot({ path: 'test-results/live-completion/mobile-expanded.png' });
  await noEffects();
  await complete('a').click();
  await button('Close live timer').click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: 'Open live timer: Completion test', exact: true }).click();
  await expect(block('a')).toHaveCount(0);
  await noEffects();
  // Tick and cross are distinct atomic choices; the first input wins.
  await seed();
  await page.evaluate(() => {
    const row = document.querySelector('dialog .live-timer-block[data-task-id="a"]');
    row.querySelector('.live-timer-skip').click();
    row.querySelector('.live-timer-complete').click();
    row.querySelector('.live-timer-skip').click();
  });
  await expect(block('a')).toHaveCount(0);
  await expect(block('b').locator('.live-timer-badges')).toContainText('40 mins');
  const crossed = await cached();
  assert.deepEqual(crossed.liveTimer.skippedTaskIds, ['a']);
  assert.deepEqual(crossed.liveTimer.completedTaskIds ?? [], []);
  assert.equal(!!crossed.spaces[0].tasks[0].completed, false);
  await noEffects();
  await skip('b').focus();
  await page.keyboard.press('Space');
  await expect(block('b')).toHaveCount(0);
  await complete('c').focus();
  await page.keyboard.press('Enter');
  await expect(modal.getByRole('status')).toHaveText('Timeblock finished. 1 completed · 2 not done.');
  await button('Close live timer').click();
  await page.reload();
  await page.getByRole('button', { name: 'Open live timer: Completion test', exact: true }).click();
  await expect(modal.getByRole('status')).toHaveText('Timeblock finished. 1 completed · 2 not done.');

  await seed();
  await page.evaluate(() => {
    const request = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = () => { navigator.locks.request = request; return new Promise((_, reject) => setTimeout(() => reject(new Error('Synthetic skip failure')), 500)); };
  });
  await skip('a').click();
  await expect(modal.getByRole('alert')).toContainText('Your change was not saved');
  await expect(skip('a')).toHaveAttribute('aria-pressed', 'false');
  assert.deepEqual((await cached()).liveTimer.skippedTaskIds ?? [], []);
  await noEffects();
  // Regress the reported jump: current task is already partially elapsed.
  for (const [minutes, taskId, action, width] of [[15, 'c', 'complete', 1440], [15, 'a', 'complete', 390], [35, 'a', 'complete', 1440], [15, 'c', 'skip', 390]]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.setFixedTime(new Date('2026-09-14T02:00:00Z'));
    await seed();
    await page.clock.setFixedTime(new Date(Date.UTC(2026, 8, 14, 2, minutes)));
    await expect(modal.locator('.live-timer-blocks > .live-timer-now > span')).toHaveText(`12:${minutes} PM`);
    await page.evaluate(() => document.getAnimations().forEach(animation => { if (animation.effect?.target?.classList?.contains('live-timer-now')) animation.finish(); }));
    const beforeLine = await modal.locator('.live-timer-blocks > .live-timer-now').evaluate(el => el.getBoundingClientRect().top);
    const beforeGlow = beforeLine;
    const runningBefore = await modal.locator('.live-timer-block.active').getAttribute('data-task-id');
    const startBefore = await modal.locator('.live-timer-block.active time').getAttribute('datetime');
    const samples = await page.evaluate(async ({ taskId, action }) => {
      const list = document.querySelector('dialog .live-timer-blocks');
      const values = [];
      list.querySelector(`[data-task-id="${taskId}"] .live-timer-${action}`).click();
      const started = performance.now();
      while (performance.now() - started < 1000) {
        const top = list.querySelector(':scope > .live-timer-now')?.getBoundingClientRect().top;
        values.push([top, top]);
        await new Promise(requestAnimationFrame);
      }
      return values;
    }, { taskId, action });
    await expect(block(taskId)).toHaveCount(0);
    assert.ok(samples.every(([y, glow]) => Number.isFinite(y) && Math.abs(y - beforeLine) < 2 && Math.abs(glow - beforeGlow) < 2), `The now marker moved during ${action} of ${taskId}: ${JSON.stringify(samples)}`);
    if (runningBefore !== taskId) await expect(block(runningBefore).locator('time')).toHaveAttribute('datetime', startBefore);
    await page.screenshot({ path: `test-results/live-completion/anchored-${minutes}-${taskId}-${action}.png` });
    await page.clock.setFixedTime(new Date(Date.UTC(2026, 8, 14, 2, minutes + 2)));
    await expect(modal.locator('.live-timer-blocks > .live-timer-now > span')).toHaveText(`12:${minutes + 2} PM`);
    await expect.poll(() => modal.locator('.live-timer-blocks > .live-timer-now').evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThan(beforeLine + 1);
    await noEffects();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: timer hover, block clear, proportional time and height expansion, atomic persistence, reload, rapid duplicate clicks, final task, keyboard focus, split tasks, fixed breaks, rollback, reduced motion, mobile and close during animation.');
} finally { await browser.close(); }

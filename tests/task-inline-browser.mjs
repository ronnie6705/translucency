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
  hasTouch: true,
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
  color: id === "home" ? "#69d6cf" : "#eea176",
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
page.on("console", (msg) => console.log("[BROWSER]", msg.text()));
fs.mkdirSync("test-results/tasks", { recursive: true });
const button = (name) => page.getByRole("button", { name, exact: true });
const dialog = (name) => page.getByRole("dialog", { name, exact: true });
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
try {
  await page.goto(base + '/#rhythm-tasks');
  await page.getByLabel('Email', {exact:true}).fill(user.email);
  await page.getByLabel('Password', {exact:true}).fill('synthetic-password');
  await button('Sign in').click();
  await expect(page.locator('#rhythm-tasks')).toBeVisible();
  const home=page.getByRole('region',{name:'Home',exact:true});
  const composer=home.locator(':scope > .inline-create');
  await composer.locator('.lane-task').hover();
  await expect(composer).toHaveAttribute('data-mode','task');
  assert.match(await composer.locator('.inline-create-lanes').evaluate(e=>getComputedStyle(e).transitionDuration),/0.6s/);
  await page.getByRole('searchbox').hover();
  await expect(composer).toHaveAttribute('data-mode','idle');
  await composer.locator('.lane-task').hover();
  const name=composer.getByRole('textbox',{name:'Task name',exact:true});
  await name.fill('Inline standalone');
  await expect(composer.locator('.lane-task')).toHaveCSS('background-color','rgba(255, 255, 255, 0.1)');
  assert.equal(await name.evaluate(e=>getComputedStyle(e).outlineStyle),'none');
  assert.equal(await name.evaluate(e=>getComputedStyle(e).boxShadow),'none');
  await expect.poll(()=>composer.locator('.lane-task').evaluate(e=>getComputedStyle(e,'::after').borderTopColor)).toBe('rgba(255, 255, 255, 0.5)');
  assert.equal(await composer.locator('.lane-task').evaluate(e=>getComputedStyle(e,'::after').borderTopStyle),'dashed');
  await composer.screenshot({path:'test-results/tasks/focus-task.png'});
  await page.getByRole('searchbox').click();
  await expect(composer).toHaveAttribute('data-mode','task');
  await composer.getByRole('button',{name:'Task energy',exact:true}).click();
  await composer.getByRole('button',{name:'2',exact:true}).click();
  await composer.getByRole('button',{name:'Task duration',exact:true}).click();
  await composer.getByLabel('Hours',{exact:true}).fill('0');
  await composer.getByLabel('Minutes',{exact:true}).fill('25');
  await composer.getByRole('button',{name:'Apply',exact:true}).click();
  await name.press('Enter');
  await expect(home.getByText('Inline standalone',{exact:true})).toBeVisible();
  const saved=(await cached()).spaces.find(s=>s.id==='home').tasks.find(t=>t.name==='Inline standalone');
  assert.equal(saved.energyRequired,2); assert.equal(saved.durationMinutes,25);
  await page.getByRole('searchbox').click();
  await expect(composer).toHaveAttribute('data-mode','idle');
  await composer.locator('.lane-list').hover();
  await composer.getByRole('textbox',{name:'Task list name',exact:true}).fill('New inline list');
  await expect(composer.locator('.lane-list')).toHaveCSS('background-color','rgba(255, 255, 255, 0.1)');
  await composer.screenshot({path:'test-results/tasks/focus-list.png'});
  await composer.getByRole('button',{name:'Save',exact:true}).click();
  const list=home.locator('.tasks-list-group').filter({has:page.locator('summary strong').filter({hasText:'New inline list'})});
  await expect(list).toBeVisible();
  await list.getByRole('button',{name:'Add Task to New inline list',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await list.getByRole('textbox',{name:'Task name',exact:true}).fill('Task inside list');
  await expect(list.locator('.inline-create-lane')).toHaveCSS('background-color','rgba(255, 255, 255, 0.1)');
  await expect.poll(()=>list.locator('.inline-create-lane').evaluate(e=>getComputedStyle(e,'::after').borderTopColor)).toBe('rgba(255, 255, 255, 0.5)');
  await list.screenshot({path:'test-results/tasks/focus-list-task.png'});
  await list.getByRole('button',{name:'Task energy',exact:true}).click();
  await list.getByRole('button',{name:'4',exact:true}).click();
  await list.getByRole('textbox',{name:'Task name',exact:true}).press('Enter');
  await expect(list.getByRole('checkbox',{name:'Complete Task inside list',exact:true})).toBeVisible();
  assert.equal((await cached()).taskLists.find(l=>l.name==='New inline list').tasks[0].energyRequired,4);
  assert.ok(await home.locator(':scope > .tasks-row-stack').evaluate(e=>!!(e.compareDocumentPosition(e.parentElement.querySelector('.tasks-list-group')) & Node.DOCUMENT_POSITION_FOLLOWING)));
  assert.match(await list.evaluate(e=>getComputedStyle(e).backgroundImage),/0.411765 0.839216 0.811765 \/ 0.2/);
  await list.locator('summary').click();
  await expect(list.getByRole('checkbox',{name:'Complete Task inside list',exact:true})).toBeHidden();
  await list.locator('summary').click();
  await page.reload();
  await expect(home.getByText('Inline standalone',{exact:true})).toBeVisible();
  await expect(list.getByRole('checkbox',{name:'Complete Task inside list',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/tasks/inline-desktop.png',fullPage:true});
  // Failed writes retain the draft; retry creates exactly one task.
  await composer.locator('.lane-task').hover();
  await name.fill('Retry draft');
  await page.evaluate(() => {
    const original = navigator.locks.request.bind(navigator.locks);
    navigator.locks.request = (...args) => {
      navigator.locks.request = original;
      return Promise.reject(new Error('Simulated inline save failure'));
    };
  });
  await name.press('Enter');
  await expect(composer.getByRole('alert')).toBeVisible();
  await expect(name).toHaveValue('Retry draft');
  await name.press('Enter');
  await expect(home.getByText('Retry draft',{exact:true})).toBeVisible();
  assert.equal((await cached()).spaces.find(s=>s.id==='home').tasks.filter(t=>t.name==='Retry draft').length,1);
  await name.press('Escape');
  await expect(composer.getByRole('button',{name:'Add Task',exact:true})).toBeFocused();
  await composer.getByRole('button',{name:'Add Task List',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(composer.getByRole('textbox',{name:'Task list name',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('searchbox').fill('No matching entry 789');
  await expect(home.getByText('No matching tasks.',{exact:true})).toBeVisible();
  await page.getByRole('searchbox').fill('');
  await page.setViewportSize({width:390,height:844});
  await composer.getByRole('button',{name:'Add Task',exact:true}).tap();
  await name.fill('Mobile draft');
  await composer.getByRole('button',{name:'Task duration',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
  await expect(composer.locator('.lane-list')).toHaveCSS('opacity','0');
  await page.screenshot({path:'test-results/tasks/inline-mobile.png',fullPage:true});
  await page.keyboard.press('Escape');
  await expect(name).toHaveValue('Mobile draft');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.ok(await composer.locator('.inline-create-lanes').evaluate(e=>parseFloat(getComputedStyle(e).transitionDuration)<0.001));
  assert.deepEqual(errors,[]);
  console.log('PASS: hover, 600ms motion, draft retention, task/list creation, pickers, persistence, ordering, Space gradient, collapse, mobile, reduced motion');
} finally { await browser.close(); }

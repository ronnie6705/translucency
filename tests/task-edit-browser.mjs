// Synthetic Supabase responses only: this suite never touches real accounts or records.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const base = process.env.BASE_URL || "http://127.0.0.1:3002";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1800 },
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
async function add(name) {
  await page.keyboard.press("Control+Space");
  await dialog("Add Task")
    .getByRole("textbox", { name: "Task name" })
    .fill(name);
}
async function drag(source, target, { center = true, hold = true } = {}) {
  await page.locator(`[data-task-id="${source}"]`).scrollIntoViewIfNeeded();
  const a = await page.locator(`[data-task-id="${source}"]`).boundingBox(),
    b = await target.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 15, a.y + a.height / 2 + 2, {
    steps: 5,
  });
  await page.mouse.move(
    b.x + b.width / 2,
    b.y + b.height * (center ? 0.5 : 0.05),
    { steps: 15 },
  );
  if (hold) await page.waitForTimeout(600);
  await page.mouse.up();
}
async function move(source,target,top=false) {
 await source.scrollIntoViewIfNeeded();
 await page.waitForTimeout(200);
 const a=await source.boundingBox(), b=await target.boundingBox();
 await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
 await page.mouse.down();
 await page.mouse.move(a.x+a.width/2+15,a.y+a.height/2,{steps:5});
 await page.mouse.move(b.x+100,b.y+(top?5:b.height/2),{steps:15});
 await page.mouse.move(b.x+101,b.y+(top?5:b.height/2));
 await page.mouse.up();
}
try {
 await page.goto(base + '/#rhythm-tasks');
 await page.getByLabel('Email',{exact:true}).fill(user.email);
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
 await button('Sign in').click();
 await expect(page.locator('.tasks-row')).toHaveCount(3);
 await button('Edit Space').click();
 await expect(page.getByRole('button',{name:'Rearrange Task Name',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Rearrange Task Name',exact:true}).press('ArrowDown');
 await expect.poll(()=>docs.get('rhythm').payload.spaces[0].tasks.map(t=>t.id).join(',')).toBe('b,a,c');
 await page.getByRole('button',{name:'Rearrange Task List 1',exact:true}).press('ArrowDown');
 await expect.poll(()=>docs.get('rhythm').payload.taskLists.map(t=>t.id).join(',')).toBe('l2,l1,l3');
 // Drag a task into an empty list.
 const handle=page.getByRole('button',{name:'Rearrange Task Name',exact:true});
 await move(handle, page.locator('[data-list-id="l1"] summary')); 
 await expect.poll(()=>docs.get('rhythm').payload.taskLists.find(l=>l.id==='l1').tasks.map(t=>t.id).join(',')).toBe('a');
 // Drag tasks to an exact position, without the normal grouping hold behavior.
 await move(page.getByRole('button',{name:'Rearrange Third Task',exact:true}),page.locator('[data-task-id="b"]'),true);
 await expect.poll(()=>docs.get('rhythm').payload.spaces[0].tasks.map(t=>t.id).join(',')).toBe('c,b');
 await move(page.getByRole('button',{name:'Rearrange Task List 3',exact:true}),page.locator('[data-list-id="l2"] summary'),true);
 await expect.poll(()=>docs.get('rhythm').payload.taskLists.map(t=>t.id).join(',')).toBe('l3,l2,l1');
 await page.locator('.tasks-header-actions').getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.locator('.task-reorder-handle')).toHaveCount(0);
 await page.reload();
 await expect(page.locator('[data-task-id="c"]')).toBeVisible();
 assert.deepEqual((await cached()).spaces[0].tasks.map(t=>t.id),['c','b']);
 assert.deepEqual((await cached()).taskLists.map(l=>l.id),['l3','l2','l1']);
 await page.locator('[data-list-id="l1"]').getByRole('button',{name:'Edit List',exact:true}).click();
 await expect(page.locator('.task-reorder-handle')).toHaveCount(1);
 await button('Settings for Task Name').click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('dialog').getByLabel('Task name',{exact:true}).fill('Renamed task');
 await page.getByRole('dialog').getByRole('button',{name:'Save changes',exact:true}).click();
 await expect.poll(()=>docs.get('rhythm').payload.taskLists.find(l=>l.id==='l1').tasks[0].name).toBe('Renamed task');
 await button('Edit Space').click();
 await page.locator('.tasks-header-actions').getByRole('button',{name:'Done',exact:true}).blur();
 await page.waitForFunction(()=>[...document.querySelectorAll('#rhythm-tasks img')].every(img=>img.complete && img.naturalWidth>0));
 await page.waitForTimeout(300);
 const assetSizes = await page.locator('.task-reorder-handle img').evaluateAll(els=>els.map(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})));
 assert.ok(assetSizes.every(s=>Math.abs(s.width-10)<.1 || Math.abs(s.width-12.7859)<.1));
 await page.screenshot({path:'test-results/tasks/task-edit-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(300);
 await page.locator('[data-task-id="a"]').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/tasks/task-edit-mobile.png',fullPage:true});
 assert.ok(await page.locator('#rhythm-tasks').evaluate(el=>el.scrollWidth<=el.clientWidth),'mobile overflow');
 await button('Delete Renamed task').click();
 await expect.poll(()=>docs.get('rhythm').payload.taskLists.find(l=>l.id==='l1').tasks.length).toBe(0);
 assert.deepEqual(errors,[]);
 console.log('Edit mode, task/list keyboard and drag ordering, cross-list move, rename, reload persistence, deletion and mobile layout passed.');
} finally { await browser.close(); }

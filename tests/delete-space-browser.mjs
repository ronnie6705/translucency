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

const page = await context.newPage();page.on('pageerror',e=>errors.push(e.message));
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

const snapshot=cached;
try {
 await page.goto(base+'/#rhythm-tasks');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const open=async name=>{await page.getByRole('button',{name:`Edit ${name} Space`,exact:true}).click();await page.getByRole('button',{name:'Delete Space',exact:true}).click();};
 const modal=page.getByRole('dialog',{name:'Delete Space',exact:true});
 await expect(page.getByRole('button',{name:'Edit Home Space',exact:true})).toBeVisible();
 const before=await snapshot();await open('Home');await expect(modal.getByRole('radio',{name:'Keep tasks and lists',exact:true})).toBeChecked();
 await modal.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(await snapshot(),before);
 await open('Home');await expect(modal).toContainText('3 tasks and 3 lists');
 fs.mkdirSync('test-results',{recursive:true});await modal.screenshot({path:'test-results/delete-space.png'});
 await modal.getByRole('button',{name:'Move contents & delete space',exact:true}).click();await expect(modal).toHaveCount(0);
 assert.equal((await snapshot()).spaces.length,1);assert.equal((await snapshot()).spaces[0].id,'work');assert.equal((await snapshot()).spaces[0].tasks.length,3);assert.ok((await snapshot()).taskLists.every(l=>l.spaceId==='work'));
 await page.reload();await expect(page.getByRole('button',{name:'Edit Home Space',exact:true})).toHaveCount(0);await open('Work');await expect(modal).toContainText('new General space');
 await modal.getByRole('button',{name:'Move contents & delete space',exact:true}).click();await expect(modal).toHaveCount(0);assert.equal((await snapshot()).spaces[0].name,'General');assert.equal((await snapshot()).spaces[0].tasks.length,3);
 await open('General');await modal.getByRole('radio',{name:'Delete tasks and lists too',exact:true}).check();await expect(modal).toContainText('cannot be undone');
 await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='documents')throw new DOMException('Test storage failure','QuotaExceededError');return window.originalPut.apply(this,args);};});await modal.getByRole('button',{name:'Delete space',exact:true}).click();await expect(modal.getByRole('alert')).toBeVisible();assert.equal((await snapshot()).spaces.length,1);
 await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});await modal.getByRole('button',{name:'Delete space',exact:true}).click();await expect(modal).toHaveCount(0);assert.deepEqual((await snapshot()).spaces,[]);assert.deepEqual((await snapshot()).taskLists,[]);
 await page.reload();await expect(page.getByRole('button',{name:'Edit General Space',exact:true})).toHaveCount(0);assert.deepEqual(errors,[]);
 console.log('Space deletion UI passed: cancel, keep/move, reload, last-space fallback, explicit deletion and failed-save retry.');
} finally {await browser.close();}

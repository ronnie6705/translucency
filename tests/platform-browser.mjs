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
const requestedModules = [];
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
    requestedModules.push(url.searchParams.get("module"));
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
 await page.goto(base + '/');
 await page.getByLabel('Email',{exact:true}).fill(user.email);
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
 await button('Sign in').click();
 await expect(page).toHaveURL(/#rhythm$/);
 await expect(page.getByRole('heading',{name:'Find your rhythm.'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Translucency',exact:true})).toHaveCount(0);
 for (const route of ['home','check-in','journey','insights']) {
   await page.evaluate(hash=>{location.hash=hash},route);
   await expect(page).toHaveURL(/#rhythm$/);
 }
 await page.evaluate(()=>{location.hash='rhythm-tasks'});
 await expect(page.locator('.tasks-row')).toHaveCount(3);
 await page.evaluate(()=>{location.hash='settings'});
 await expect(page.getByRole('heading',{name:'Settings & privacy'})).toBeVisible();
 await expect(button('Export Rhythm data')).toBeVisible();
 await expect(page.getByText('Delete all Translucency data',{exact:true})).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 await button('Open navigation').click();
 await expect(page.getByRole('navigation',{name:'Rhythm navigation'})).toBeVisible();
 await expect(page.getByRole('link',{name:'Translucency',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Tasks',exact:true}).click();
 await expect(page.locator('.tasks-row')).toHaveCount(3);
 assert.ok(requestedModules.length>0);
 assert.ok(requestedModules.every(module=>module==='eq.rhythm'),JSON.stringify(requestedModules));
 assert.deepEqual(errors,[]);
 console.log('Rhythm-only desktop/mobile navigation, legacy-link redirects, settings and isolated sync passed.');
} finally { await browser.close(); }

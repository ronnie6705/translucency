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
// Independent synthetic fixture, adapted from task-spaces-browser.mjs.
const row = (id) => page.locator(`[data-task-id="${id}"]`);
const check = (id) => row(id).getByRole("checkbox");
async function seed(ids, { listed = false, long = false } = {}) {
  await page.getByRole("searchbox").fill("");
  await page.evaluate(async ({ ids, listed, long, userId }) => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open("rhythm-account-cache-v1", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("documents", "readwrite");
      const store = tx.objectStore("documents");
      const key = userId + ":rhythm";
      const request = store.get(key);
      request.onsuccess = () => {
        const value = request.result;
        const tasks = ids.map((id) => ({ id, name: long ? `${id} — A long task title with several pieces of important context that wraps across multiple lines on mobile` : `Task ${id}`, durationMinutes: 390, energyRequired: 5, priority: 2 }));
        value.payload.spaces = [{ id: "home", name: "Home", icon: "home", color: "#ffffff", createdAt: "2026-09-10T00:00:00Z", tasks: listed ? [] : tasks }];
        value.payload.taskLists = listed ? [{ id: "list", name: "Test List", spaceId: "home", createdAt: "2026-09-10T00:00:00Z", tasks }] : [];
        value.dirty = true;
        store.put(value, key);
      };
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    window.dispatchEvent(new Event("rhythm-library-updated"));
  }, { ids, listed, long, userId: user.id });
  await expect(page.locator(".tasks-row")).toHaveCount(ids.length);
  await expect(check(ids[0])).not.toBeChecked();
}
async function clean() {
  await expect(page.locator(".block-fragment, .block-clear-wave, .block-pop-effects, .block-impact-ring, .block-shockwave")).toHaveCount(0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
}
try {
  await page.goto(base + "/#rhythm-tasks");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await button("Sign in").click();
  await expect(page.locator(".tasks-row")).toHaveCount(3);
  fs.mkdirSync("test-results/block-clear", { recursive: true });

  await seed(["a", "b", "c"]);
  const position = await check("a").boundingBox();
  await page.mouse.move(position.x + 14, position.y + 14);
  await page.mouse.down();
  await expect(row("a")).toHaveAttribute("data-clear-phase", "pressed");
  await page.mouse.up();
  await expect(check("a")).toBeChecked();
  await expect(row("a")).toHaveAttribute("data-clear-phase", "clearing");
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  await page.screenshot({ path: "test-results/block-clear/desktop-wave.png" });
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await expect(row("a")).toHaveAttribute("data-clear-phase", "popping");
  await expect(page.locator(".block-fragment")).toHaveCount(10);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  await page.screenshot({ path: "test-results/block-clear/desktop-pop.png" });
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await expect(row("a")).toHaveCount(0);
  await expect(check("b")).toBeFocused();
  assert.equal((await cached()).spaces[0].tasks[0].completed, true);
  await clean();

  // Middle, last, only task, and Space keyboard activation.
  for (const ids of [["a", "b", "c"], ["a", "b"], ["b"]]) {
    await seed(ids);
    await check("b").focus();
    await page.keyboard.press("Space");
    await expect(row("b")).toHaveCount(0);
    if (ids.includes("c")) await expect(check("c")).toBeFocused();
    else if (ids.includes("a")) await expect(check("a")).toBeFocused();
    else await expect(page.locator("#rhythm-tasks")).toBeFocused();
    await clean();
  }

  // Three independent reactions, including duplicate input in the same event turn.
  await seed(["a", "b", "c", "d"]);
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    window.completionWrites = 0;
    IDBObjectStore.prototype.put = function(value, ...args) {
      if (value?.dirty && value?.payload?.spaces) window.completionWrites++;
      return put.call(this, value, ...args);
    };
    for (const id of ["a", "a", "b", "c"]) document.querySelector(`[data-task-id="${id}"] input`).click();
  });
  await expect(page.locator(".tasks-row")).toHaveCount(1);
  assert.equal(await page.evaluate(() => window.completionWrites), 3);
  assert.deepEqual((await cached()).spaces[0].tasks.map((t) => [t.id, !!t.completed]), [["a", true], ["b", true], ["c", true], ["d", false]]);
  await clean();

  await seed(["a", "b", "c"]);
  await page.evaluate(() => document.querySelectorAll('.tasks-row input[type="checkbox"]').forEach((input) => input.click()));
  await expect(page.locator(".tasks-row")).toHaveCount(0);
  await clean();

  // Fail before and after the pop; a neighbouring successful save must survive.
  for (const delay of [0, 800]) {
    await seed(["a", "b"]);
    await page.evaluate((delay) => {
      const request = navigator.locks.request.bind(navigator.locks);
      navigator.locks.request = () => {
        navigator.locks.request = request;
        return new Promise((_, reject) => setTimeout(() => reject(new Error("Synthetic save failure")), delay));
      };
    }, delay);
    await check("a").click();
    if (delay) await check("b").click();
    await expect(page.locator("#rhythm-tasks").getByRole("alert")).toContainText("Your change was not saved");
    await expect(check("a")).not.toBeChecked();
    await expect(row("a")).toBeVisible();
    assert.equal(await row("a").evaluate((node) => node.inert), false);
    assert.ok((await row("a").boundingBox()).height >= 58);
    await clean();
    await check("a").click();
    await expect(row("a")).toHaveCount(0);
  }

  // Filtering a card out during its animation must cancel all local effects.
  await seed(["a", "b"]);
  await check("a").click();
  await page.getByRole("searchbox").fill("Task b");
  await expect(row("a")).toHaveCount(0);
  await clean();
  assert.equal((await cached()).spaces[0].tasks[0].completed, true);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(["a", "b"]);
  await check("a").focus();
  await page.keyboard.press("Space");
  await expect(check("a")).toBeChecked();
  assert.equal(await row("a").evaluate((node) => getComputedStyle(node).transform), "none");
  await expect(page.locator(".block-fragment, .block-clear-wave")).toHaveCount(0);
  await expect(row("a")).toHaveCount(0);
  await expect(check("b")).toBeFocused();
  await clean();
  await page.emulateMedia({ reducedMotion: "no-preference" });

  // Mobile, wrapping metadata, filtered list, and many partly visible cards.
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(Array.from({ length: 40 }, (_, i) => `mobile-${i}`), { listed: true, long: true });
  await page.getByRole("searchbox").fill("mobile-1");
  await expect(page.locator(".tasks-row")).toHaveCount(11);
  await check("mobile-1").scrollIntoViewIfNeeded();
  await check("mobile-1").click();
  await expect(row("mobile-1")).toHaveAttribute("data-clear-phase", "clearing");
  await page.evaluate(() => document.getAnimations().forEach((a) => a.pause()));
  await page.screenshot({ path: "test-results/block-clear/mobile-wave.png" });
  await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
  await page.mouse.wheel(0, 100);
  await expect(row("mobile-1")).toHaveCount(0);
  await expect(page.locator(".tasks-row")).toHaveCount(10);
  await clean();
  await page.getByRole("searchbox").fill("");
  await expect(page.locator(".tasks-row")).toHaveCount(39);
  assert.equal((await cached()).taskLists[0].tasks[1].completed, true);
  assert.deepEqual(errors, []);
  console.log("Verified Block Clear phases, particles, cleanup, keyboard/focus, first/middle/last/only tasks, rapid duplicate input, late save rollback, reduced motion, mobile, filtering, long titles, scrolling and 40-task lists.");
} finally {
  await browser.close();
}

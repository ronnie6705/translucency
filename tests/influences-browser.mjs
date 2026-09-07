import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
fs.mkdirSync("test-results", { recursive: true });
const profile = `test-results/influences-profile-${Date.now()}`;
let context = await chromium.launchPersistentContext(profile, {
  channel: "msedge",
  headless: true,
  viewport: { width: 1440, height: 1050 },
});
let page = await context.newPage();
const errors = [];
const listen = () => page.on("pageerror", (e) => errors.push(e.message));
listen();
const button = (name) => page.getByRole("button", { name, exact: true });
const read = () =>
  page.evaluate(
    () =>
      new Promise((res, rej) => {
        const r = indexedDB.open("translucency-v1", 2);
        r.onerror = () => rej(r.error);
        r.onsuccess = () => {
          const db = r.result;
          const t = db.transaction("app");
          const q = t.objectStore("app").get("data");
          t.oncomplete = () => {
            db.close();
            res(q.result);
          };
        };
      }),
  );
async function go(route = "home") {
  await page.goto(`http://localhost:3000/#${route}`);
  await page.locator("#main").waitFor();
}
async function add(type, category, note, impact) {
  await button(type === "water" ? "Add water" : "Add drying").click();
  await page
    .getByLabel(
      type === "water" ? "Choose what happened" : "Choose what helped",
    )
    .selectOption(category);
  if (note)
    await page
      .getByLabel(type === "water" ? "What happened?" : "What helped?", {
        exact: false,
      })
      .fill(note);
  const rail = page.getByRole("slider");
  await rail.focus();
  await rail.press("Home");
  for (let i = 1; i < Math.abs(impact); i++) await rail.press("ArrowRight");
  await expect(page.locator(".impact-value")).toHaveText(
    impact > 0 ? `+${impact}` : String(impact),
  );
  if (category === "Poor sleep" && impact === 6)
    await page.screenshot({ path: "test-results/influence-editor.png" });
  await button("Save moment").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
try {
  // Genuine v1 IndexedDB fixture, before any new application code runs.
  await page.route("http://localhost:3000/", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Migration fixture</body></html>",
    }),
  );
  await page.goto("http://localhost:3000/");
  await page.evaluate(async () => {
    const now = new Date();
    now.setHours(7, 0, 0, 0);
    const original = {
      version: 1,
      profile: {
        name: "Morgan",
        onboarded: true,
        selectedRoleIds: ["observer", "explorer"],
        favourites: { water: ["Poor sleep"], drying: ["Walk"], signals: [] },
        customSources: {
          water: ["Work pressure"],
          drying: ["Gym"],
          signals: [],
        },
        reminders: "off",
      },
      checkIns: [
        {
          id: "existing-checkin",
          timestamp: now.toISOString(),
          state: 2,
          water: [{ label: "Work pressure", intensity: "heavy" }],
          drying: [{ label: "Walk", intensity: "light" }],
          signals: ["Body feels loud"],
          note: "Keep this older reflection.",
        },
      ],
      roles: [],
      sessions: [],
    };
    await new Promise((res, rej) => {
      const r = indexedDB.open("translucency-v1", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("app");
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("app", "readwrite");
        tx.objectStore("app").put(original, "data");
        tx.oncomplete = () => {
          db.close();
          res();
        };
        tx.onerror = () => rej(tx.error);
      };
    });
  });
  await page.unroute("http://localhost:3000/");
  await page.reload();
  await go();
  let data = await read();
  assert.equal(data.version, 2);
  assert.equal(data.influences.length, 2);
  assert.ok(data.influences.every((e) => e.impact === null));
  assert.equal(data.checkIns[0].note, "Keep this older reflection.");
  await expect(page.locator(".daily-influences dd")).toHaveText([
    "0",
    "0",
    "0",
  ]);
  await add("water", "Poor sleep", "Woke several times overnight", 6);
  await page.locator('[data-response="water"]').waitFor();
  assert.equal((await read()).checkIns[0].state, 2);
  assert.equal(await page.locator(".travelling-moisture").count(), 1);
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/water-absorption.png" });
  await page.reload();
  await page.locator("#main").waitFor();
  await expect(page.locator(".source-card.water")).toContainText(
    "Woke several times overnight",
  );
  await expect(page.locator(".daily-influences dd")).toHaveText([
    "+6",
    "0",
    "+6",
  ]);
  await add("drying", "Gym", "45 minute strength session", -5);
  await page.locator('[data-response="drying"]').waitFor();
  assert.equal(await page.locator(".material-clearing").count(), 1);
  assert.equal(await page.locator(".travelling-moisture").count(), 0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/drying-release.png" });
  await expect(page.locator(".daily-influences dd")).toHaveText([
    "+6",
    "-5",
    "+1",
  ]);
  await add("water", "Poor sleep", "Another distinct moment", 4);
  data = await read();
  assert.equal(
    data.influences.filter((e) => e.categoryLabel === "Poor sleep").length,
    2,
  );
  await expect(page.locator(".daily-influences dd")).toHaveText([
    "+10",
    "-5",
    "+5",
  ]);
  await go("journey");
  await page.getByRole("button", { name: /Open Poor sleep, \+6/ }).click();
  await page
    .getByLabel("What happened?")
    .fill("Woke several times; edited reflection");
  await page
    .getByLabel("Choose what happened")
    .selectOption("Health uncertainty");
  await page.getByRole("slider").press("ArrowRight");
  await button("Save changes").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page.locator("#main").waitFor();
  await expect(page.locator(".day-influences")).toContainText(
    "edited reflection",
  );
  await expect(page.locator(".daily-influences dd")).toHaveText([
    "+11",
    "-5",
    "+6",
  ]);
  await page.getByRole("button", { name: /Open Gym, -5/ }).click();
  await button("Delete this moment").click();
  await button("Delete moment").click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.reload();
  await page.locator("#main").waitFor();
  assert.equal(
    (await read()).influences.some((e) => e.categoryLabel === "Gym"),
    false,
  );
  await expect(page.locator(".daily-influences dd")).toHaveText([
    "+11",
    "0",
    "+11",
  ]);
  await go("insights");
  await page
    .getByText("View frequency and average logged impact", { exact: true })
    .click();
  await expect(page.locator(".influence-statistics")).toContainText("+7.0");
  await expect(page.locator(".influence-statistics")).toContainText(
    "Health uncertainty",
  );
  // Close and reopen the browser on the same local profile, as an installed app does.
  const expected = (await read()).influences;
  await context.close();
  context = await chromium.launchPersistentContext(profile, {
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1050 },
  });
  page = await context.newPage();
  listen();
  await go();
  assert.deepEqual((await read()).influences, expected);
  for (const width of [1440, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 960 });
    await go();
    await button("Add water").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    assert.equal(
      await page.evaluate(() => {
        const d = document.querySelector("dialog");
        const r = d.getBoundingClientRect();
        return (
          r.left < 0 ||
          r.right > innerWidth + 1 ||
          r.top < 0 ||
          r.bottom > innerHeight + 1
        );
      }),
      false,
      `Dialog overflow at ${width}`,
    );
    await page.keyboard.press("Escape");
    for (const route of ["home", "journey", "insights", "check-in"]) {
      await go(route);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `Overflow ${route} ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await go();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await add("drying", "Gym", "Reduced-motion release", -5);
  await page.locator('[data-response="drying"]').waitFor();
  assert.equal(await page.locator(".travelling-moisture").count(), 0);
  assert.equal(
    await page
      .locator(".material-clearing")
      .evaluate((el) => getComputedStyle(el).display),
    "none",
  );
  assert.equal(
    await page
      .locator(".just-logged")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await expect(page.locator(".daily-influences dd")).toHaveText([
    "+11",
    "-5",
    "+6",
  ]);
  await page.screenshot({ path: "test-results/influences-mobile-reduced.png" });
  await expect(page.locator(".just-logged")).toHaveCount(0, { timeout: 5000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await add("water", "Poor sleep", "Mobile absorption", 2);
  await page.locator('[data-response="water"]').waitFor();
  await page.screenshot({ path: "test-results/influences-mobile-water.png" });
  assert.equal((await read()).checkIns[0].state, 2);
  // Saving offline remains independent from self-reported check-ins.
  await page.evaluate(async () => navigator.serviceWorker.ready);
  await page.reload();
  await page.locator("#main").waitFor();
  await context.setOffline(true);
  await add("drying", "Walk", "Offline afternoon walk", -3);
  await page.reload();
  await page.locator("#main").waitFor();
  assert.ok(
    (await read()).influences.some((e) => e.note === "Offline afternoon walk"),
  );
  await context.setOffline(false);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await go();
  await page.waitForTimeout(3400);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "test-results/influences-home-desktop.png",
    fullPage: true,
  });
  await go("journey");
  await page.screenshot({
    path: "test-results/influences-journey.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        checks: [
          "real v1 schema upgrade",
          "old data preserved without numeric invention",
          "water +6 and absorption",
          "distinct drying -5 clearing",
          "duplicate categories",
          "refresh persistence",
          "daily derived totals",
          "edit category/note/impact",
          "delete and recalculation",
          "insights average impact",
          "close/reopen persistence",
          "desktop/tablet/phone layouts",
          "keyboard slider and Escape",
          "reduced motion",
          "mobile water response",
          "offline saving",
          "canonical state unchanged",
        ],
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
}

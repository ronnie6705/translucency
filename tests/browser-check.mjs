const baseURL = process.env.BASE_URL || "http://127.0.0.1:3001";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
const context = await chromium.launchPersistentContext(
  `test-results/profile-${Date.now()}`,
  {
    channel: process.env.BROWSER_CHANNEL || (process.platform === "darwin" ? "chrome" : "msedge"),
    headless: true,
    viewport: { width: 1440, height: 1100 },
  },
);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
fs.mkdirSync("test-results", { recursive: true });
const button = (name) => page.getByRole("button", { name, exact: true });
async function go(hash) {
  await page.goto(`${baseURL}/#${hash}`);
  await page.locator("#main").waitFor();
}
async function db() {
  return page.evaluate(
    () =>
      new Promise((res, rej) => {
        const r = indexedDB.open("translucency-v1", 2);
        r.onsuccess = () => {
          const database = r.result;
          const q = database.transaction("app").objectStore("app").get("data");
          q.onsuccess = () => {
            res(q.result);
            database.close();
          };
          q.onerror = () => rej(q.error);
        };
      }),
  );
}
try {
  await page.goto(`${baseURL}`);
  await page
    .getByRole("heading", {
      name: "Understand yourself. Then return to your life.",
      level: 1,
    })
    .waitFor();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/onboarding-desktop.png",
    fullPage: true,
  });
  await page.getByLabel("Your name").fill("Alex");
  await button("Continue").click();
  await button("Continue").click();
  await button("Enter your space").click();
  await page.getByRole("heading", { name: /Good .*Alex/ }).waitFor();
  assert.equal((await db()).profile.onboarded, true);
  await page.reload();
  await page.getByRole("heading", { name: /Good .*Alex/ }).waitFor();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  await go("water");
  await page.getByLabel("Add your own").fill("An unfinished project");
  await button("Add source").click();
  await button("An unfinished project").click();
  await page.reload();
  await page
    .getByRole("heading", { name: "Water Sources", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelector("button[aria-pressed=true]") !== null,
  );
  assert.ok(
    (await db()).profile.customSources.water.includes("An unfinished project"),
  );
  await go("drying");
  await page.getByLabel("Add your own").fill("A slow breakfast");
  await button("Add source").click();
  await button("A slow breakfast").waitFor();
  assert.ok(
    (await db()).profile.customSources.drying.includes("A slow breakfast"),
  );
  await go("check-in");
  await button("Moderately translucent").click();
  for (const [type, category] of [
    ["water", "Poor sleep"],
    ["water", "An unfinished project"],
    ["drying", "Walk"],
    ["drying", "A slow breakfast"],
  ]) {
    await button(type === "water" ? "Add water" : "Add drying").click();
    await page
      .getByLabel(
        type === "water" ? "Choose what happened" : "Choose what helped",
      )
      .selectOption(category);
    await page.getByRole("slider").focus();
    await page.getByRole("slider").press("ArrowRight");
    await button("Save moment").click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  await page
    .getByText("Signals noticed today", { exact: false })
    .first()
    .click();
  await button("Body feels loud").click();
  await page
    .getByLabel("A short reflection")
    .fill("A little space after a walk.");
  await button("Save & return to my day").click();
  await page.getByRole("heading", { name: /Good .*Alex/ }).waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "Moderately translucent", exact: true })
    .waitFor();
  assert.equal((await db()).checkIns.filter((c) => !c.demo).length, 1);
  await go("check-in");
  await page
    .getByText("You have already checked in recently.", { exact: false })
    .waitFor();
  await go("custom-roles");
  await page.getByLabel("Role name").fill("Calm Pilot");
  await page
    .getByLabel("What do you borrow from them?")
    .fill("Steadiness in uncertainty");
  await page.getByLabel("Best situations").fill("Waiting, travel");
  await page
    .getByLabel("One core phrase")
    .fill("Observe first. Respond second.");
  await button("Save perspective").click();
  await page
    .getByRole("heading", { name: "Calm Pilot", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", { name: "Calm Pilot", exact: true })
    .waitFor();
  await page
    .getByRole("article")
    .filter({
      has: page.getByRole("heading", { name: "Calm Pilot", exact: true }),
    })
    .getByRole("button", { name: "Use this perspective" })
    .click();
  await page
    .getByLabel("What’s on your mind?")
    .fill("Waiting for an upcoming trip.");
  await page
    .getByLabel("What is anxiety’s interpretation?")
    .fill("I need to control every detail.");
  await button("See another perspective").click();
  await page
    .getByText("Optional: place this in Observe mode", { exact: true })
    .click();
  await page.getByLabel("Already assessed.").check();
  await button("Carry this perspective").click();
  await page
    .getByRole("heading", { name: "Carry this into your day." })
    .waitFor();
  await button("Return to my day").click();
  await go("journey");
  await page
    .getByText("Calm Pilot · saved perspective", { exact: true })
    .click();
  await page.getByLabel("Did this perspective help?").selectOption("a_lot");
  await page.getByLabel("What changed?").fill("I returned to packing.");
  await button("Save reflection").click();
  await page.waitForTimeout(250);
  assert.equal((await db()).sessions.find((s) => !s.demo).helpfulness, "a_lot");
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/journey-desktop.png",
    fullPage: true,
  });
  await go("insights");
  await page
    .getByRole("heading", { name: "Patterns worth noticing." })
    .waitFor();
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: "test-results/insights-desktop.png",
    fullPage: true,
  });
  for (const width of [1440, 1280, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "home",
      "roles",
      "journey",
      "insights",
      "settings",
      "check-in",
    ]) {
      await go(route);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false, `overflow at ${width} ${route}`);
      if (width === 390 && ["home", "roles", "journey"].includes(route)) {
        await page.locator(".translucency-module h1").click();
        await page.evaluate(() => {
          document.activeElement?.blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: `test-results/${route}-mobile.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await go("signals");
  await page
    .getByRole("heading", { name: "Signals noticed today", exact: true })
    .waitFor();
  await go("settings");
  await page.getByLabel("Gentle check-in preference").selectOption("both");
  await page
    .getByRole("status")
    .filter({ hasText: "Check-in preference saved." })
    .waitFor();
  await page.reload();
  await page.getByLabel("Gentle check-in preference").waitFor();
  assert.equal((await db()).profile.reminders, "both");
  await go("privacy");
  const downloadPromise = page.waitForEvent("download");
  await button("Export my data").click();
  const download = await downloadPromise;
  await download.saveAs("test-results/export.json");
  assert.equal(
    JSON.parse(fs.readFileSync("test-results/export.json", "utf8")).profile
      .name,
    "Alex",
  );
  await button("Clear demo data").click();
  await page.waitForTimeout(250);
  let saved = await db();
  assert.equal(saved.checkIns.filter((c) => c.demo).length, 0);
  assert.equal(saved.checkIns.filter((c) => !c.demo).length, 1);
  await button("Reset demo data").click();
  await page.waitForTimeout(250);
  assert.equal((await db()).checkIns.filter((c) => c.demo).length, 28);
  await go("home");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cdp = await context.newCDPSession(page);
  const install = await cdp.send("Page.getInstallabilityErrors");
  assert.deepEqual(install.installabilityErrors, []);
  const manifest = await cdp.send("Page.getAppManifest");
  assert.equal(manifest.errors.length, 0);
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: /Good .*Alex/ }).waitFor();
  await page.locator('a[href="#journey"]').first().click();
  await page
    .getByRole("heading", { name: "Your material has a history." })
    .waitFor();
  await page.goto(`${baseURL}/#check-in`);
  await button("Opaque").click();
  await button("Save & return to my day").click();
  await page.getByRole("heading", { name: /Good .*Alex/ }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: "Opaque", exact: true }).waitFor();
  assert.equal((await db()).checkIns.filter((c) => !c.demo).length, 2);
  await context.setOffline(false);
  await go("privacy");
  await page.getByText("Delete all Translucency data", { exact: true }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await button("Delete Translucency data").click();
  await page
    .getByRole("heading", {
      name: "Understand yourself. Then return to your life.",
      level: 1,
    })
    .waitFor();
  await page.reload();
  await page
    .getByRole("heading", {
      name: "Understand yourself. Then return to your life.",
      level: 1,
    })
    .waitFor();
  saved = await db();
  assert.equal(saved.checkIns.length, 0);
  assert.equal(saved.sessions.length, 0);
  assert.equal(saved.roles.length, 0);
  assert.equal(saved.influences.length, 0);
  assert.equal(saved.profile.name, "");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        flows: [
          "onboarding",
          "refresh persistence",
          "custom water/drying sources",
          "check-in",
          "recent-check-in guardrail",
          "custom role",
          "reappraisal",
          "later helpfulness",
          "journey",
          "insights",
          "six responsive widths",
          "demo clear/reset",
          "PWA installability",
          "offline reload/navigation",
          "offline check-in and refresh",
          "JSON export and reminder preference",
          "full deletion and refresh",
        ],
        consoleErrors: errors,
        installabilityErrors: install.installabilityErrors,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
}

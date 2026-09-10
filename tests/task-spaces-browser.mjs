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
  await button("Add Task").click();
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
try {
  await page.goto(base + "/#rhythm-tasks");
  await page.getByLabel("Email", { exact: true }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await button("Sign in").click();
  await expect(page.locator("#rhythm-tasks")).toBeVisible();
  await expect(page.locator(".tasks-row")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/tasks/page-desktop.png",
    fullPage: true,
  });
  const rowBox = await page.locator('[data-task-id="a"]').boundingBox();
  const panelBox = await page.locator('.tasks-panel').boundingBox();
  const dashboardBox = await page.locator('.dashboard-shell.single-panel').boundingBox();
  assert.equal(panelBox.width, dashboardBox.width);
  assert.equal(dashboardBox.width, 1186);
  assert.equal(rowBox.width, panelBox.width);
  assert.equal(rowBox.height, 58);
  await page.locator('[data-task-id="a"]').screenshot({path:'test-results/tasks/task-row.png'});
  await button("Add Task").click();
  await expect(dialog("Add Task")).toBeVisible();
  await expect(page.locator(".task-destination-drawer")).toHaveAttribute(
    "inert",
    "",
  );
  const box = await page.locator(".task-composer-input").boundingBox();
  assert.equal(box.width, 847);
  assert.equal(box.height, 99);
  await page.screenshot({ path: "test-results/tasks/add-collapsed.png" });
  await dialog("Add Task")
    .getByRole("textbox", { name: "Task name" })
    .fill("New task");
  await dialog("Add Task")
    .getByRole("button", { name: "Expand Home", exact: true })
    .click();
  await expect(page.locator(".task-destination-list")).toHaveCount(4);
  await page.waitForTimeout(850);
  await page.screenshot({ path: "test-results/tasks/add-expanded.png" });
  const motion = await page
    .locator(".task-destination-drawer")
    .evaluate((e) => ({
      duration: getComputedStyle(e).transitionDuration,
      easing: getComputedStyle(e).transitionTimingFunction,
    }));
  assert.match(motion.duration, /0.75s/);
  assert.match(motion.easing, /ease/);
  await dialog("Add Task")
    .getByRole("button", { name: "Home", exact: true })
    .click();
  await dialog("Add Task")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(dialog("Add Task")).toHaveCount(0);
  await expect(page.getByText("New task", { exact: true })).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Complete Task Name", exact: true })
    .check();
  await expect
    .poll(async () => (await cached()).spaces[0].tasks[0].completed)
    .toBe(true);
  await button("Edit energy for Task Name").click();
  await page
    .locator(".task-quick-editor")
    .getByRole("button", { name: "2", exact: true })
    .click();
  await expect
    .poll(async () => (await cached()).spaces[0].tasks[0].energyRequired)
    .toBe(2);
  await button("Edit duration for Task Name").click();
  await page.locator(".task-quick-editor").getByLabel("Hours").fill("2");
  await page.locator(".task-quick-editor").getByLabel("Minutes").fill("15");
  await page
    .locator(".task-quick-editor")
    .getByRole("button", { name: "Apply" })
    .click();
  await expect
    .poll(async () => (await cached()).spaces[0].tasks[0].durationMinutes)
    .toBe(135);
  await button("Settings for Task Name").click();
  await expect(dialog("Task Details")).toBeVisible();
  await dialog("Task Details")
    .getByLabel("Start", { exact: true })
    .fill("14:00");
  await dialog("Task Details").getByLabel("End", { exact: true }).fill("13:00");
  await expect(
    dialog("Task Details").getByText("End time must be after start time"),
  ).toBeVisible();
  await expect(
    dialog("Task Details").getByRole("button", { name: "Save changes" }),
  ).toBeDisabled();
  await dialog("Task Details").getByLabel("End", { exact: true }).fill("15:00");
  await page.waitForTimeout(850);
  await page.screenshot({ path: "test-results/tasks/details.png" });
  await dialog("Task Details")
    .getByRole("button", { name: "Save changes" })
    .click();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Complete Task Name" }),
  ).toBeChecked();
  assert.equal((await cached()).spaces[0].tasks[0].fixedStart, "14:00");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await add("Scoped task");
  await expect(
    dialog("Add Task").getByRole("button", { name: "Work", exact: true }),
  ).toHaveCount(0);
  await dialog("Add Task")
    .getByRole("button", { name: "+ Add New Task List", exact: true })
    .click();
  await dialog("Add New Task List").getByLabel("Task List name").fill("Sprint");
  await dialog("Add New Task List")
    .getByRole("button", { name: "Save Task List" })
    .click();
  await dialog("Add Task")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await cached()).taskLists.find((l) => l.name === "Sprint")?.tasks[0]
          ?.name,
    )
    .toBe("Scoped task");
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  await page.keyboard.press("Control+Space");
  await expect(dialog("Add Task")).toBeVisible();
  await dialog("Add Task")
    .getByRole("textbox", { name: "Task name" })
    .fill("Study task");
  await dialog("Add Task")
    .getByRole("button", { name: "+ Add New Space", exact: true })
    .click();
  await dialog("Add New Space").getByLabel("Space name").fill("University");
  await button("Choose Space icon and colour").click();
  await dialog("Add New Space")
    .getByRole("button", { name: "Study", exact: true })
    .click();
  await dialog("Add New Space")
    .getByRole("button", { name: "Purple", exact: true })
    .click();
  await page.screenshot({ path: "test-results/tasks/space-picker.png" });
  await dialog("Add New Space")
    .getByRole("button", { name: "Create Space", exact: true })
    .click();
  await expect(dialog("Add Task")).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await cached()).spaces.find((s) => s.name === "University")?.tasks[0]
          ?.name,
    )
    .toBe("Study task");
  await page.reload();
  await expect(
    page.getByRole("link", { name: "University", exact: true }),
  ).toBeVisible();
  const university = (await cached()).spaces.find(
    (s) => s.name === "University",
  );
  assert.equal(university.icon, "study");
  assert.equal(university.color, "#b4a4ff");
  await drag("a", page.locator('[data-task-id="b"]'), { center: false });
  await expect(dialog("Add New Task List")).toHaveCount(0);
  await drag("a", page.locator('[data-task-id="b"]'), { hold: false });
  await expect(dialog("Add New Task List")).toHaveCount(0);
  await drag("a", page.locator('[data-task-id="b"]'));
  await expect(dialog("Add New Task List")).toBeVisible();
  await dialog("Add New Task List")
    .getByLabel("Task List name")
    .fill("Grouped tasks");
  await dialog("Add New Task List")
    .getByRole("button", { name: "Save Task List" })
    .click();
  await expect
    .poll(
      async () =>
        (await cached()).taskLists.find((l) => l.name === "Grouped tasks")
          ?.tasks.length,
    )
    .toBe(2);
  const group = page
    .locator(".tasks-list-group")
    .filter({ has: page.getByText("Grouped tasks", { exact: true }) });
  await drag("c", group.locator("summary"));
  await expect
    .poll(
      async () =>
        (await cached()).taskLists.find((l) => l.name === "Grouped tasks")
          ?.tasks.length,
    )
    .toBe(3);
  await group.getByRole("button", { name: "Rename", exact: true }).click();
  await dialog("Rename Task List").getByLabel("Task List name").fill("Chores");
  await dialog("Rename Task List")
    .getByRole("button", { name: "Save Task List" })
    .click();
  await expect(page.getByText("Chores", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Timeblocks", exact: true }).click();
  await page.keyboard.press("Meta+Space");
  await expect(dialog("Add Task")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog("Add Task")).toHaveCount(0);
  await page.getByRole("link", { name: "Tasks", exact: true }).click();
  // Sidebar creation uses the same picker; nested modal cleanup releases scroll locking.
  await button('Add New Space').click();
  await dialog('Add New Space').getByLabel('Space name').fill('Travel');
  await button('Choose Space icon and colour').click();
  await dialog('Add New Space').getByRole('button',{name:'Travel',exact:true}).click();
  await dialog('Add New Space').getByRole('button',{name:'Teal',exact:true}).click();
  await dialog('Add New Space').getByRole('button',{name:'Create Space',exact:true}).click();
  await expect(page.getByRole('link',{name:'Travel',exact:true})).toBeVisible();
  assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await button('Edit Travel Space').click();
  await dialog('Edit Space').getByLabel('Space name').fill('Adventures');
  await dialog('Edit Space').getByRole('button',{name:'Save Space',exact:true}).click();
  await expect.poll(async()=>(await cached()).spaces.find(s=>s.name==='Adventures')?.color).toBe('#69d6cf');
  // Existing list editing and timeblocking remain available, and keep the list's Space.
  const chores=page.locator('.tasks-list-group').filter({has:page.getByText('Chores',{exact:true})});
  await chores.getByRole('button',{name:'Edit list',exact:true}).click();
  page.once('dialog',d=>d.accept('Chores'));
  await page.getByRole('dialog',{name:'Build a task list'}).getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Build a task list'})).toHaveCount(0);
  assert.equal((await cached()).taskLists.find(l=>l.name==='Chores').spaceId,'home');
  await chores.getByRole('button',{name:'Timeblock',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Create a timeblock'})).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('link',{name:'Settings & privacy',exact:true}).click();
  const downloading=page.waitForEvent('download');
  await button('Export Rhythm data').click();
  const download=await downloading;await download.saveAs('test-results/tasks/backup.json');
  const backup=JSON.parse(fs.readFileSync('test-results/tasks/backup.json','utf8'));
  assert.equal(backup.spaces.find(s=>s.name==='University').tasks[0].name,'Study task');
  assert.equal(backup.taskLists.find(l=>l.name==='Chores').tasks.length,3);
  await page.getByLabel('Import Rhythm backup').setInputFiles('test-results/tasks/backup.json');
  await expect(page.getByText('Rhythm backup imported. Your existing records were preserved.')).toBeVisible();
  assert.equal((await cached()).taskLists.find(l=>l.name==='Chores').tasks.length,3);
  await page.getByRole('link',{name:'Rhythm',exact:true}).click();
  await page.getByRole('link',{name:'Tasks',exact:true}).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await button("Add Task").click();
  await dialog("Add Task")
    .getByRole("textbox", { name: "Task name" })
    .fill("Mobile task");
  await page.waitForTimeout(850);
  await page.screenshot({ path: "test-results/tasks/add-mobile.png" });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    "Verified task flows, persistence, drawer motion, desktop/mobile layout, shortcuts, grouping and rename.",
  );
} catch (e) {
  await page.screenshot({
    path: "test-results/tasks/failure.png",
    fullPage: true,
  });
  console.error(await page.locator("body").innerText());
  throw e;
} finally {
  await browser.close();
}

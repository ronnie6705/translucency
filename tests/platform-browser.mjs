import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL || (process.platform === 'darwin' ? 'chrome' : 'msedge'),headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Australia/Melbourne',acceptDownloads:true});
const page = await context.newPage();
const errors=[];
page.on('pageerror',e => errors.push(e.message));
fs.mkdirSync('test-results',{recursive:true});
const legacyList={id:'legacy-list',name:'Existing Rhythm tasks',createdAt:'2026-09-08T00:00:00Z',tasks:[{id:'legacy-task',name:'Focused writing',durationMinutes:60,energyRequired:5,priority:1}]};
await context.addInitScript(list => {
  if (!sessionStorage.getItem('fixture-seeded')) { localStorage.setItem('rhythm:saved-task-lists',JSON.stringify([list])); sessionStorage.setItem('fixture-seeded','yes'); }
},legacyList);
const button = name => page.getByRole('button',{name,exact:true});
async function readRhythm() { return page.evaluate(() => new Promise((resolve,reject) => { const r=indexedDB.open('rhythm-library-v1',1); r.onsuccess=()=>{const db=r.result;const q=db.transaction('library').objectStore('library').get('data');q.onsuccess=()=>{resolve(q.result);db.close();};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);})); }
try {
  await page.goto(`${base}/#rhythm`);
  await expect(page.getByText('Existing Rhythm tasks',{exact:true})).toBeVisible();
  assert.equal((await readRhythm()).taskLists[0].tasks[0].energyRequired,5);
  await page.reload();
  await expect(page.getByText('Existing Rhythm tasks',{exact:true})).toBeVisible();
  assert.equal((await readRhythm()).taskLists.length,1);
  const rail=page.locator('.product-rail');
  await page.mouse.move(600,80);
  await expect(rail).not.toHaveClass(/expanded/);
  await rail.hover();
  await expect(rail).toHaveClass(/expanded/);
  await page.mouse.move(600,80);
  await expect(rail).not.toHaveClass(/expanded/);
  await page.getByRole('link',{name:'Rhythm',exact:true}).focus();
  await expect(rail).toHaveClass(/expanded/);
  await button('Pin sidebar open').click();
  await page.mouse.move(600,80);
  await expect(page.locator('.platform-shell')).toHaveClass(/rail-pinned/);
  await button('Unpin sidebar').click();
  await button('Add Task List').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByPlaceholder('What is your task?').fill('Integration review');
  await button('Save task').click();
  page.once('dialog',dialog => dialog.accept('My platform tasks'));
  await button('Save').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('My platform tasks',{exact:true})).toBeVisible();
  assert.equal((await readRhythm()).taskLists.length,2);
  await page.getByText('My platform tasks',{exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Timeblock',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Choose your Rhythm'})).toBeVisible();
  await button('Bear').click();
  await button('Next').click();
  await button('Next').click();
  await expect(page.getByRole('heading',{name:'Set your Time Range'})).toBeVisible();
  await page.locator('.time-column').nth(0).getByRole('button',{name:'9 AM',exact:true}).click();
  await page.locator('.time-column').nth(1).getByRole('button',{name:'12 PM',exact:true}).click();
  await button('Next').click();
  await expect(page.getByRole('heading',{name:'Edit your Time Block'})).toBeVisible();
  await button('Next').click();
  const downloadPromise=page.waitForEvent('download');
  await button('Export to ICS').click();
  const download=await downloadPromise;
  await download.saveAs('test-results/rhythm-schedule.ics');
  const ics=fs.readFileSync('test-results/rhythm-schedule.ics','utf8');
  assert.match(ics,/SUMMARY:Integration review/);
  page.once('dialog',dialog => dialog.accept('My daily timeblock'));
  await button('Save').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByText('My daily timeblock',{exact:true})).toBeVisible();
  assert.equal((await readRhythm()).timeblocks.length,1);
  await page.reload();
  await expect(page.getByText('My daily timeblock',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/platform-rhythm-desktop.png',fullPage:true});
  await page.getByRole('link',{name:'Translucency',exact:true}).click();
  await page.getByLabel('Your name').fill('Platform test');
  await button('Continue').click(); await button('Continue').click(); await button('Enter your space').click();
  await expect(page.getByRole('heading',{name:/Good .*Platform test/})).toBeVisible();
  await page.goto(`${base}/#check-in`);
  await button('Moderately translucent').click();
  await page.getByRole('link',{name:'Rhythm',exact:true}).click();
  await page.goBack();
  await expect(button('Moderately translucent')).toHaveAttribute('aria-pressed','true');
  await button('Save & return to my day').click();
  await expect(page.getByRole('heading',{name:/Good .*Platform test/})).toBeVisible();
  await page.mouse.move(600,80);
  await page.screenshot({path:'test-results/platform-translucency-desktop.png',fullPage:true});
  for (const width of [360,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    for (const route of ['home','rhythm','settings']) {
      await page.goto(`${base}/#${route}`);
      await expect(page.locator('.platform-topbar')).toBeVisible();
      const fits = await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);
      if (!fits) {
        console.log(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>{const r=el.getBoundingClientRect();return r.width && r.right>innerWidth+1;}).map(el=>({tag:el.tagName,class:el.className,right:el.getBoundingClientRect().right})).slice(0,25)));
        await page.screenshot({path:'test-results/platform-overflow.png',fullPage:true});
      }
      assert.ok(fits,`${route} overflow at ${width}`);
    }
    if(width===390) {
      await button('Open navigation').click();
      await expect(rail).toHaveClass(/mobile-open/);
      await page.getByRole('link',{name:'Rhythm',exact:true}).click();
      await expect(rail).not.toHaveClass(/mobile-open/);
      await button('Add Task List').click();
      assert.ok(await page.getByRole('dialog').evaluate(el=>el.getBoundingClientRect().width<=innerWidth));
      await page.getByPlaceholder('What is your task?').fill('Mobile draft');
      assert.ok(await page.locator('.flow-modal').evaluate(el => el.scrollWidth <= el.clientWidth+1),'Mobile task modal clips content');
      for (const label of ['Close','Save task']) {
        const bounds = await button(label).boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x+bounds.width<=390,`${label} outside mobile viewport`);
      }
      await page.screenshot({path:'test-results/platform-rhythm-mobile.png',fullPage:true});
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await button('Add Timeblock').click();
      await expect(page.getByRole('heading',{name:'Choose your Rhythm'})).toBeVisible();
      assert.ok(await page.locator('.flow-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Chronotype modal overflow');
      await page.screenshot({path:'test-results/platform-chronotype-mobile.png',fullPage:true});
      await button('Cancel').click();
      await page.getByText('My daily timeblock',{exact:true}).click();
      await button('Next').click();
      await button('Next').click();
      await expect(page.getByRole('heading',{name:'Set your Time Range'})).toBeVisible();
      await button('Next').click();
      await button('Next').click();
      await expect(button('Export to ICS')).toBeVisible();
      assert.ok(await page.locator('.flow-modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Calendar handoff modal overflow');
      await page.screenshot({path:'test-results/platform-calendar-mobile.png',fullPage:true});
      await button('Cancel').click();
    }
  }
  await page.goto(`${base}/#rhythm`);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('My daily timeblock',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Translucency',exact:true}).click();
  await expect(page.getByRole('heading',{name:/Good .*Platform test/})).toBeVisible();
  await context.setOffline(false);
  assert.deepEqual(errors,[]);
  console.log('PASS: legacy migration, reload, sidebar hover/focus/pin/mobile, task save, chronotype/timeblock/ICS, check-in draft switching, responsive layouts, offline product switching.');
} finally { await browser.close(); }

// Synthetic Supabase responses only: this suite never touches real accounts or records.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1728,height:1240},timezoneId:'Australia/Sydney',acceptDownloads:true,hasTouch:true});
const user={id:'00000000-0000-4000-8000-000000000091',email:'timer@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
const tasks=Array.from({length:8},(_,i)=>({id:String.fromCharCode(97+i),name:`Task ${i+1}`,durationMinutes:60,energyRequired:5,priority:2}));
const completedListTask={...tasks[0],id:'done-list',name:'Finished list task',completed:true};
const completedDirectTask={...tasks[0],id:'done-direct',name:'Finished direct task',completed:true};
const docs=new Map([['rhythm',{payload:{version:1,spaces:[{id:'home',name:'Home',icon:'home',color:'#ffffff',createdAt:'2026-09-09T00:00:00Z',tasks:[completedDirectTask]},{id:'personal',name:'Personal',icon:'personal',color:'#81b8ff',createdAt:'2026-09-09T00:00:00Z',tasks:[{id:'personal-task',name:'Read a chapter',durationMinutes:30,energyRequired:2,priority:2}]}],taskLists:[{id:'list',spaceId:'home',name:'Sprint',createdAt:'2026-09-09T00:00:00Z',tasks:[...tasks,completedListTask]}],timeblocks:[]},revision:1}]]);
const errors=[];
await context.route('https://*.supabase.co/**',async route=>{
 const request=route.request(); const url=new URL(request.url()); const path=url.pathname;
 const reply=(json)=>route.fulfill({json});
 if(request.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS'}});
 const token=[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+864000})).toString('base64url'),'test'].join('.');
 if(path.endsWith('/token')) return reply({access_token:token,refresh_token:'synthetic',expires_in:864000,token_type:'bearer',user});
 if(path.endsWith('/user')) return reply(user);
 if(path.endsWith('/logout')) return reply({});
 if(path.endsWith('/workspace_documents')) {const doc=docs.get(url.searchParams.get('module')?.replace('eq.',''));return reply(doc?[doc]:[]);}
 if(path.endsWith('/rpc/save_workspace_document')) {const body=request.postDataJSON();const revision=body.expected_revision+1;docs.set(body.document_module,{payload:body.document_payload,revision});return reply(revision);}
 throw Error('Unexpected Supabase request '+path);
});
const config={date:'2026-10-23',startTime:'09:00',endTime:'17:00',timezone:'UTC',chronotype:'Bear'};
const stamp=n=>new Date(Date.parse('2026-10-23T09:00:00Z')+n*60000).toISOString();
const schedule=tasks.map((t,i)=>({id:t.id,taskId:t.id,taskName:t.name,start:stamp(i*60),end:stamp((i+1)*60),isBreak:false,energyRequired:5}));
const original={id:'original',name:'Original full day',createdAt:stamp(0),dayConfig:config,tasks:structuredClone(tasks),schedule:structuredClone(schedule),recoveryBaseSchedule:structuredClone(schedule),breakPreferences:{preset:'balanced',overrides:[]}};
docs.get('rhythm').payload.timeblocks=[structuredClone(original)];
try {
 fs.mkdirSync('test-results',{recursive:true});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#rhythm-timeblocks');await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const open=async()=>{await page.locator('.timeblock-settings').first().hover();await page.getByRole('button',{name:'Edit Original full day',exact:true}).first().click();};
 await open();
 const flow=page.getByRole('dialog',{name:'Create a timeblock',exact:true});
 const next=async()=>{await flow.getByRole('button',{name:'Next',exact:true}).click();await flow.getByRole('button',{name:'Next',exact:true}).click();};await next();
 const panel=flow.getByRole('region',{name:'Recovery',exact:true});const left=flow.getByRole('region',{name:'Schedule preview',exact:true});
 const timeline=()=>flow.locator('.tb-schedule-slot[data-motion-id] .live-timer-block').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.blockId,start:n.querySelector('time').dateTime})));
 const order=()=>flow.locator('.tb-schedule-slot[data-motion-id] .live-timer-block:not(.is-break)').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.taskId))]);
 const card=id=>flow.locator('.tb-schedule-slot[data-motion-id]').filter({has:page.locator(`.live-timer-block[data-task-id="${id}"]`)});
 // Reopening a legacy accepted schedule must not regenerate its recovery placement.
 const originalTimeline=await timeline();assert.equal(originalTimeline.length,8);
 await expect(panel.getByRole('progressbar')).toHaveCount(0);
 await expect(panel.getByRole('button',{name:'Apply Suggestions'})).toHaveCount(0);
 await expect(panel.getByRole('slider')).not.toBeVisible();
 assert.deepEqual((await timeline()).map(b=>b.start),schedule.map(b=>b.start));
 await expect(flow.locator('.tb-adjustment-toast')).toHaveCount(0);
 await panel.getByRole('radio',{name:/^Deep Focus/}).check();
 await panel.getByRole('radio',{name:/^Balanced/}).check();
 const balanced=await timeline();assert.ok(balanced.length>8);
 await expect(panel.getByText(/minutes of recommended recovery couldn’t fit/)).toHaveCount(0);
 await panel.getByText('Advanced Options',{exact:true}).click();const slider=panel.getByRole('slider',{name:'Adjustment flexibility',exact:false});
 await expect(slider).toHaveValue('10');
 const assets=await panel.locator('img').evaluateAll(images=>images.map(img=>({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height})));
 assert.equal(assets.length,8);assert.ok(assets.every(asset=>asset.loaded));
 assert.ok(assets.filter(asset=>/balanced|deep-focus|frequent|none/.test(asset.src)).every(asset=>asset.width===24&&asset.height===24));
 await panel.screenshot({path:'test-results/recovery-panel-figma.png'});
 const percent=async n=>{await slider.press('Home');for(let i=0;i<n;i++)await slider.press('ArrowRight');await page.waitForTimeout(400);};
 await percent(5);await expect(panel.getByText(/minutes of recommended recovery couldn’t fit/)).toBeVisible();
 const partial=await timeline();await percent(20);await expect(panel.getByText(/minutes of recommended recovery couldn’t fit/)).toHaveCount(0);
 await panel.getByRole('button',{name:'Undo last change',exact:true}).click();await expect(slider).toHaveValue('5');assert.deepEqual(await timeline(),partial);
 await panel.getByRole('radio',{name:/^No Auto Breaks/}).check();await expect(slider).toBeDisabled();assert.deepEqual(await timeline(),originalTimeline);
 // Rapid selections supersede earlier animations and notifications.
 for(const name of ['Balanced','Frequent Breaks','Deep Focus','Balanced'])await panel.getByRole('radio',{name:new RegExp('^'+name)}).check();
 await expect(slider).toHaveValue('10');assert.deepEqual(await timeline(),balanced);
 await expect(flow.locator('.tb-adjustment-toast')).toContainText('35 minutes of recovery scheduled');
 await flow.getByRole('button',{name:'Dismiss recovery notification'}).click();await expect(flow.locator('.tb-adjustment-toast')).toHaveCount(0);
 // Pointer movement changes the displayed percentage but not the schedule until release.
 const sliderBox=await slider.boundingBox();const beforeDrag=await timeline();
 await page.mouse.move(sliderBox.x+sliderBox.width/2,sliderBox.y+sliderBox.height/2);await page.mouse.down();await page.mouse.move(sliderBox.x+2,sliderBox.y+sliderBox.height/2);
 await expect(panel.locator('.tb-recovery-slider output')).toHaveText('0%');assert.deepEqual(await timeline(),beforeDrag);await page.mouse.up();await expect(slider).toHaveValue('0');assert.deepEqual(await timeline(),originalTimeline);
 await percent(20);
 // Manual order survives later preset changes.
 await flow.getByRole('button',{name:'Edit schedule order',exact:true}).click();await flow.getByRole('button',{name:'Move Task 8 up',exact:true}).click();const chosen=await order();
 for(const name of ['Deep Focus','Balanced']){await panel.getByRole('radio',{name:new RegExp('^'+name)}).check();assert.deepEqual(await order(),chosen);}
 // Adding protected work can fit under a cap, while restoring full estimates cannot.
 await panel.getByRole('radio',{name:/^Frequent Breaks/}).check();
 await flow.getByRole('button',{name:'Add break after Task 3',exact:true}).click();await flow.getByRole('button',{name:'15-minute break',exact:true}).click();
 await expect(flow.getByRole('button',{name:'Start & Export',exact:true})).toBeEnabled();const withBreak=await timeline();
 await panel.getByRole('radio',{name:/^No Auto Breaks/}).check();
 await expect(left.getByText('Changes pending — showing last valid schedule',{exact:true})).toBeVisible();assert.deepEqual(await timeline(),withBreak);
 await expect(flow.getByRole('button',{name:'Start & Export',exact:true})).toBeDisabled();await expect(flow.locator('.tb-adjustment-toast')).toHaveCount(0);
 await left.getByRole('button',{name:'Adjust schedule',exact:true}).click();const adjustment=flow.getByRole('region',{name:'Schedule adjustments',exact:true});
 await expect(adjustment).toContainText('Restoring task estimates would exceed');await adjustment.getByRole('button',{name:'Cancel pending adjustments',exact:true}).click();
 await expect(panel.getByRole('radio',{name:/^Frequent Breaks/})).toBeChecked();assert.deepEqual(await timeline(),withBreak);
 // An explicit estimate is protected during its own update; Undo cannot revert it.
 await card('b').getByLabel('Settings for Task 2',{exact:true}).click();await card('b').getByRole('combobox',{name:'Duration for Task 2',exact:true}).selectOption('45');
 await expect(card('b')).not.toContainText('Rhythm Adjustment');
 await panel.getByRole('button',{name:'Undo last change',exact:true}).click();assert.equal(await card('b').locator('select').first().inputValue(),'45');
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();assert.equal(await flow.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.screenshot({path:'test-results/unified-recovery-mobile.png',fullPage:true,animations:'disabled'});await page.setViewportSize({width:1728,height:1240});
 await page.screenshot({path:'test-results/unified-recovery-desktop.png',fullPage:true,animations:'disabled'});
 await percent(7);
 const accepted=await timeline();const downloadPromise=page.waitForEvent('download');await flow.getByRole('button',{name:'Start & Export',exact:true}).click();const download=await downloadPromise;const ics=fs.readFileSync(await download.path(),'utf8');
 await expect.poll(()=>docs.get('rhythm').payload.timeblocks.length).toBe(2);const library=docs.get('rhythm').payload;assert.deepEqual(library.timeblocks.find(t=>t.id==='original'),original);
 const saved=structuredClone(library.timeblocks.find(t=>t.id!=='original'));assert.ok(saved.timeAdjustments.recoveryHistory.length);assert.equal(saved.timeAdjustments.effectivePercent,7);assert.equal(saved.tasks.find(t=>t.id==='b').workingEstimateMinutes,45);
 assert.deepEqual(saved.schedule,library.liveTimer.blocks);assert.deepEqual(library.taskLists[0].tasks.slice(0,8),tasks);assert.match(ics,/SUMMARY:Recovery Break/);
 await page.reload();await expect(page.getByRole('button',{name:'Add Timeblock',exact:true})).toBeVisible();await open();await next();
 assert.deepEqual(await timeline(),accepted);await expect(flow.locator('.tb-adjustment-toast')).toHaveCount(0);
 await panel.getByText('Advanced Options',{exact:true}).click();await expect(slider).toHaveValue('7');
 await expect(panel.getByRole('button',{name:'Undo last change',exact:true})).toBeVisible();await panel.getByRole('button',{name:'Undo last change',exact:true}).click();
 assert.equal(await card('b').locator('select').first().inputValue(),'45');assert.deepEqual(docs.get('rhythm').payload.timeblocks.find(t=>t.id===saved.id),saved);
 // A genuinely new full-day plan reveals an already optimized Balanced result.
 await flow.getByRole('button',{name:'Close timeblock',exact:true}).click();await page.getByRole('button',{name:'Add Timeblock',exact:true}).click();
 for(let i=1;i<=8;i++)await flow.getByRole('button',{name:`Add Task ${i} to timeblock`,exact:true}).click();
 await flow.getByRole('button',{name:'Edit',exact:true}).click();const range=page.getByRole('dialog',{name:"Edit today's time window",exact:true});await range.getByRole('button',{name:/^Workday/}).click();await range.getByRole('button',{name:'Apply time window',exact:true}).click();
 await next();await expect(panel.getByRole('radio',{name:/^Balanced/})).toBeChecked();
 assert.ok((await timeline()).length>8);await expect(flow.locator('.tb-adjustment-toast')).toContainText('minutes of recovery scheduled');
 await expect(panel.getByRole('slider')).not.toBeVisible();
 assert.deepEqual(errors,[]);console.log('Unified recovery browser passed: exact reopen, automatic presets, keyboard/pointer slider, rapid switching, restoration, pending conflicts, Undo, manual estimates/order, saved history, ICS/launch parity and mobile.');
} finally {await browser.close();}

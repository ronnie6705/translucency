// Synthetic Supabase responses only: this suite never touches real accounts or records.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:1728,height:1117},timezoneId:'Australia/Sydney',acceptDownloads:true});
const user={id:'00000000-0000-4000-8000-000000000091',email:'timer@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
const tasks=[
 ['Start building portfolio','12:00',90,5,false],['Short Break','13:30',10,1,true],
 ['Summarize the main aim of the topic','13:40',15,4,false],['Short Break','13:55',10,1,true],
 ['Briefly describe research methods','14:35',120,4,false],['Break','16:35',60,1,true],
 ['Highlight the significance & potential impact','17:45',120,3,false],['Do the dishes','20:00',30,2,false]
].map(([name,fixedStart,durationMinutes,energyRequired,isBreak],i)=>({id:`task-${i}`,name,fixedStart,durationMinutes,energyRequired,isBreak,priority:1}));
const plan={id:'plan',name:"Today's Plan",createdAt:'2026-09-09T00:00:00Z',tasks,dayConfig:{date:'2026-09-09',startTime:'12:00',endTime:'20:30',timezone:'Australia/Sydney',chronotype:'Bear'}};
const docs=new Map([['rhythm',{payload:{version:1,taskLists:[],timeblocks:[plan]},revision:1}]]);
const errors=[];
await context.route('https://*.supabase.co/**',async route=>{
 const request=route.request(); const url=new URL(request.url()); const path=url.pathname;
 const reply=(json)=>route.fulfill({json});
 if(request.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS'}});
 const token=[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,exp:Date.parse('2026-10-01T00:00:00Z')/1000})).toString('base64url'),'test'].join('.');
 if(path.endsWith('/token')) return reply({access_token:token,refresh_token:'synthetic',expires_in:864000,token_type:'bearer',user});
 if(path.endsWith('/user')) return reply(user);
 if(path.endsWith('/logout')) return reply({});
 if(path.endsWith('/workspace_documents')) {const doc=docs.get(url.searchParams.get('module')?.replace('eq.',''));return reply(doc?[doc]:[]);}
 if(path.endsWith('/rpc/save_workspace_document')) {const body=request.postDataJSON();const revision=body.expected_revision+1;docs.set(body.document_module,{payload:body.document_payload,revision});return reply(revision);}
 throw Error('Unexpected Supabase request '+path);
});
try {
 const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-09-09T05:05:00Z')});
 await page.goto(base+'/#rhythm-timeblocks');
 await page.getByLabel('Email',{exact:true}).fill(user.email); await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.locator('#rhythm-timeblocks')).toBeVisible();
 const button=name=>page.getByRole('button',{name,exact:true});
 async function finalStep(){
  await page.locator('.timeblock-rail-card').getByRole('heading',{name:"Today's Plan",exact:true}).click();
  for(let i=0;i<4;i++) await button('Next').click();
  await expect(button('Start a Live Timer')).toBeVisible();
 }
 await finalStep();
 fs.mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/timer-final-step.png',fullPage:false});
 let downloads=0; page.on('download',()=>downloads++);
 await button('Start a Live Timer').click();
 const modal=page.getByRole('dialog',{name:'Live timer',exact:true});
 await expect(modal).toBeVisible();
 await expect(modal.locator('.live-timer-block.active')).toContainText('Briefly describe research methods');
 assert.equal(await modal.locator('.past').count(),4); assert.equal(await modal.locator('.upcoming').count(),3);
 await page.waitForTimeout(1200);
 await page.screenshot({path:'test-results/live-timer-desktop.png',fullPage:false});
 assert.equal(downloads,0);
 await button('Close live timer').click();
 await expect(modal).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Live Timer',exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:"Open live timer: Today's Plan",exact:true}).click();
 await expect(modal.locator('.active')).toContainText('Briefly describe research methods');
 await page.clock.setSystemTime(new Date('2026-09-09T06:35:00Z')); await page.clock.runFor(1100);
 await expect(modal.locator('.active')).toContainText('Break');
 assert.equal(await modal.locator('.past').count(),5);
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(1200);
 await page.screenshot({path:'test-results/live-timer-mobile.png',fullPage:false});
 assert.ok(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'mobile timer fits');
 await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0);
 await page.goto(base+'/#rhythm-tasks'); await expect(page.locator('.live-timer-section')).toHaveCount(0);
 await page.goto(base+'/#rhythm-timeblocks'); await page.setViewportSize({width:1728,height:1117});
 await finalStep(); const download=page.waitForEvent('download'); await button('Both Live Timer & ICS').click();
 const file=await download; await file.saveAs('test-results/live-timer.ics');
 const ics=fs.readFileSync('test-results/live-timer.ics','utf8'); assert.match(ics,/SUMMARY:Briefly describe research methods/); assert.match(ics,/DTSTART:20260909T043500Z/);
 await expect(modal).toBeVisible(); assert.equal(downloads,1);
 await page.clock.setSystemTime(new Date('2026-09-09T11:30:00Z')); await page.clock.runFor(1100);
 await expect(modal.getByRole('status')).toHaveText('Timeblock complete'); await expect(modal.locator('.active')).toHaveCount(0);
 await button('Close live timer').click();
 await finalStep(); const plainDownload=page.waitForEvent('download'); await button('Export to ICS').click(); await plainDownload;
 await expect(modal).toHaveCount(0); assert.equal(downloads,2);
 assert.deepEqual(errors,[]);
 console.log('PASS: final actions, schedule states, task-to-break transition, reload/reopen, mobile, completion, ICS-only and combined export.');
} finally {await browser.close();}


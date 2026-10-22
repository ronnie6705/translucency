// Synthetic Supabase responses only: this suite never touches real accounts or records.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1728,height:1240},timezoneId:'Australia/Sydney',acceptDownloads:true,hasTouch:true});
const user={id:'00000000-0000-4000-8000-000000000091',email:'timer@example.test',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{}};
const tasks=[{id:'a',name:'Write documentation',durationMinutes:45,energyRequired:2,priority:2},{id:'b',name:'Build feature',durationMinutes:60,energyRequired:5,priority:1}];
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
const start=Date.parse('2026-10-01T00:00:00Z');
const durations=[5,15,30,60,90]; let minute=0;
const blocks=durations.map((duration,i)=>{const block={id:'block-'+i,taskId:'task-'+i,taskName:'Duration '+duration,start:new Date(start+minute*60000).toISOString(),end:new Date(start+(minute+duration)*60000).toISOString(),isBreak:i===1,energyRequired:3};minute+=duration+(i===2?10:0);return block;});
docs.get('rhythm').payload.liveTimer={id:'timer',name:'Proportional test',timezone:'Australia/Sydney',blocks,startedAt:blocks[0].start,endsAt:blocks.at(-1).end};
try {
 const page=await context.newPage();await page.clock.setFixedTime(new Date(start));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#rhythm-timeblocks');
 await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(page.getByRole('article',{name:'Timeblock: Proportional test',exact:true})).toBeVisible();
 const expand=page.getByRole('button',{name:'Expand Proportional test',exact:true}); if(await expand.count()) await expand.first().click();
 await page.getByRole('button',{name:'Open live timer: Proportional test',exact:true}).click();
 const modal=page.getByRole('dialog',{name:'Live timer',exact:true});
 for(let i=0;i<blocks.length;i++){
  const card=modal.locator(`[data-block-id="block-${i}"]`);
  await expect(card).toHaveCount(1);
  const height=await card.evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(height >= (blocks[i].isBreak ? 64 : 82),`Readable height for ${durations[i]} minutes: ${height}`);
  await expect(card.locator('.live-timer-task-icon')).toBeVisible();
  await expect(card.locator('.live-timer-badges')).toBeVisible();
  await expect(card).not.toHaveClass(/is-compact|is-tiny/);
  assert.match(await card.locator('time').textContent(),/[AP]M – .*[AP]M/);
 }
 const gap=await modal.locator('.live-timer-blocks').evaluate(el=>parseFloat(getComputedStyle(el).gap));assert.ok(gap>0,'Original spacing between blocks');
 await page.screenshot({path:'test-results/restored-timeline.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await modal.evaluate(el=>el.scrollWidth<=el.clientWidth),true,'No horizontal overflow');
 await modal.locator('.live-timer-main').scrollIntoViewIfNeeded();
 await page.screenshot({path:'test-results/restored-timeline-mobile.png',fullPage:false});
 assert.deepEqual(errors,[]);console.log('Original block layout, visible details, spacing and time ranges passed.');
} finally {await browser.close();}




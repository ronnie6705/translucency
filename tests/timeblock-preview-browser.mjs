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

const dayConfig={date:'2026-09-01',startTime:'09:00',endTime:'13:00',timezone:'UTC',chronotype:'Bear'};
const makeBlock=(task,start,end)=>({id:'block-'+task.id,taskId:task.id,taskName:task.name,energyRequired:task.energyRequired,isBreak:false,start:'2026-09-01T'+start+':00.000Z',end:'2026-09-01T'+end+':00.000Z'});
const olderA={id:'old-a',name:"Today's Plan",createdAt:'2026-09-01T00:00:00Z',dayConfig,tasks,schedule:[makeBlock(tasks[1],'09:00','10:00'),makeBlock(tasks[0],'10:00','10:45')]};
const otherTasks=[{...tasks[0],id:'c',name:'Old planning task'}];
const olderB={id:'old-b',name:"Today's Plan",createdAt:'2026-09-01T00:00:00Z',dayConfig,tasks:otherTasks,schedule:[makeBlock(otherTasks[0],'11:00','11:45')]};
const active={id:'old-a',name:"Today's Plan",timezone:'UTC',blocks:[{...makeBlock(tasks[1],'09:00','10:00'),start:'2026-10-01T00:00:00Z',end:'2026-10-01T01:00:00Z'}],startedAt:'2026-10-01T00:00:00Z',endsAt:'2026-10-01T01:00:00Z'};
docs.get('rhythm').payload.timeblocks=[olderA,olderB];docs.get('rhythm').payload.liveTimer=active;
try {
 const page=await context.newPage();await page.clock.setFixedTime(new Date('2026-10-01T00:00:00Z'));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#rhythm-timeblocks');
 await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 const cards=page.locator('.timeblock-workspace-card');await expect(cards).toHaveCount(2);
 const preview=(i)=>cards.nth(i).locator('.timeblock-schedule-column .live-timer-block');
 const read=(i)=>preview(i).evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.taskId,start:n.querySelector('time').dateTime})));
 const expected=t=>t.schedule.map(b=>({id:b.taskId,start:b.start}));
 assert.deepEqual(await read(0),expected(olderA));assert.deepEqual(await read(1),expected(olderB));
 await expect(cards.nth(0).locator('.timeblock-live-badge')).toHaveCount(1);await expect(cards.nth(1).locator('.timeblock-live-badge')).toHaveCount(0);
 await expect(cards.nth(0).locator('.timeblock-tasks-column')).toContainText('Write documentation');
 await expect(cards.nth(1).locator('.timeblock-tasks-column')).toContainText('Old planning task');
 await page.screenshot({path:'test-results/saved-previews.png',fullPage:true});
 await cards.nth(0).getByRole('button',{name:"Open live timer: Today's Plan",exact:true}).click();
 const live=page.getByRole('dialog',{name:'Live timer',exact:true});await expect(live).toBeVisible();
 await expect(live.locator('.live-timer-block')).toHaveCount(1);
 await live.getByRole('button',{name:'Complete Build feature',exact:true}).click();
 await expect.poll(()=>docs.get('rhythm').payload.liveTimer.completedTaskIds).toEqual(['b']);
 await live.getByRole('button',{name:'Close live timer',exact:true}).click();
 assert.deepEqual(await read(0),expected(olderA));assert.deepEqual(await read(1),expected(olderB));
 await cards.nth(1).getByRole('button',{name:"Open live timer: Today's Plan",exact:true}).click();await expect(live).toBeVisible();
 await expect.poll(()=>docs.get('rhythm').payload.liveTimer.id).toBe('old-b');
 await expect(live.locator('.live-timer-block')).toContainText('Old planning task');
 await live.getByRole('button',{name:'Close live timer',exact:true}).click();
 assert.deepEqual(await read(0),expected(olderA));assert.deepEqual(await read(1),expected(olderB));
 assert.deepEqual(docs.get('rhythm').payload.timeblocks.map(t=>t.schedule),[olderA.schedule,olderB.schedule]);
 await cards.nth(0).getByRole('button',{name:"Open live timer: Today's Plan",exact:true}).click();
 await expect.poll(()=>docs.get('rhythm').payload.liveTimer.id).toBe('old-a');
 assert.deepEqual(docs.get('rhythm').payload.liveTimer.blocks.map(b=>b.taskId),['b','a']);
 assert.deepEqual(errors,[]);console.log('PASS: historical schedules stay isolated through resume, completion and new launch, including duplicate Timeblock names.');
} finally { await browser.close(); }

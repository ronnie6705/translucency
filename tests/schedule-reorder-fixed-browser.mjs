// Synthetic Supabase responses only: this suite never touches real accounts or records.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:3001';
const browser = await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'chrome',headless:true});
const context = await browser.newContext({viewport:{width:1728,height:1800},timezoneId:'Australia/Sydney',acceptDownloads:true,hasTouch:true});
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

const config={date:'2026-10-23',startTime:'11:00',endTime:'17:00',timezone:'UTC',chronotype:'Bear'};
const task=(id,name,durationMinutes,extra={})=>({id,name,durationMinutes,energyRequired:3,priority:2,...extra});
const work=[task('post','LinkedIn Post',45),task('site','Duplicate Blue IoT Site',45),task('bugs','Respond to Richard and Address Bugs',60),task('lunch','Lunch break',60,{isBreak:true,fixedStart:'13:00'}),task('meeting','Meeting with Joshua',60,{fixedStart:'14:00'}),task('home','Make Home Page',90)];
const block=(id,taskId,start,end,offset=0)=>{const t=work.find(t=>t.id===taskId);return {id,taskId,taskName:t.name,energyRequired:t.energyRequired,isBreak:!!t.isBreak,isFixed:!!t.fixedStart,start:`2026-10-23T${start}:00.000Z`,end:`2026-10-23T${end}:00.000Z`,workOffsetMinutes:offset};};
const schedule=[block('post','post','11:00','11:45'),block('site','site','11:45','12:30'),block('bugs','bugs','12:30','13:00'),block('lunch','lunch','13:00','14:00'),block('meeting','meeting','14:00','15:00'),block('bugs-tail','bugs','15:00','15:30',30),block('home','home','15:30','17:00')];
docs.get('rhythm').payload.timeblocks=[{id:'reorder',name:'Reorder regression',createdAt:schedule[0].start,dayConfig:config,tasks:work,schedule,recoveryBaseSchedule:schedule,breakPreferences:{preset:'none',overrides:[]}}];
try {
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#rhythm-timeblocks');
 await page.getByLabel('Email',{exact:true}).fill(user.email);
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.locator('.timeblock-settings').first().hover();
 await page.getByRole('button',{name:'Edit Reorder regression',exact:true}).click();
 const flow=page.getByRole('dialog',{name:'Create a timeblock',exact:true});
 await flow.getByRole('button',{name:'Next',exact:true}).click();
 await flow.getByRole('button',{name:'Next',exact:true}).click();
 const cards=flow.locator('.tb-schedule-slot');
 const site=cards.filter({has:page.locator('[data-task-id="site"]')});
 const source=await site.boundingBox(),target=await cards.last().boundingBox();
 await page.mouse.move(source.x+source.width/2,source.y+source.height/2);
 await page.mouse.down();
 await page.mouse.move(target.x+target.width/2,target.y+target.height-5,{steps:30});
 await page.mouse.up();
 await expect(cards.last().locator('.live-timer-block')).toHaveAttribute('data-task-id','site');
 await expect(cards.last().locator('time')).toHaveAttribute('datetime','2026-10-23T16:15:00.000Z');
 for(const [id,start] of [['lunch','13:00'],['meeting','14:00']])await expect(flow.locator(`[data-task-id="${id}"] time`)).toHaveAttribute('datetime',`2026-10-23T${start}:00.000Z`);
 await expect(flow.getByText(/This order cannot fit/)).toHaveCount(0);
 // The accepted order survives leaving and returning to the schedule stage.
 await flow.getByRole('button',{name:'Back',exact:true}).click();
 await flow.getByRole('button',{name:'Next',exact:true}).click();
 await expect(cards.last().locator('.live-timer-block')).toHaveAttribute('data-task-id','site');
 await expect(site).toHaveCount(1);
 // Cancel and returning to the source must both discard temporary placements.
 for(const cancel of [true,false]){
  await page.waitForTimeout(650); // Let the previous placement's spring settle before measuring.
  const end=await site.boundingBox(),first=await cards.first().boundingBox();
  await page.mouse.move(end.x+end.width/2,end.y+end.height/2);
  await page.mouse.down();
  await page.mouse.move(first.x+first.width/2,first.y+10,{steps:20});
  if(cancel)await page.keyboard.press('Escape');
  else await page.mouse.move(end.x+end.width/2,end.y+end.height/2,{steps:20});
  await page.mouse.up();
  await expect(cards.last().locator('.live-timer-block')).toHaveAttribute('data-task-id','site');
  await expect(site).toHaveCount(1);
 }
 fs.mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/schedule-reorder-fixed.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('PASS: pointer drag moves the task to the end, keeps fixed times, and retains the accepted order.');
} finally {await browser.close();}

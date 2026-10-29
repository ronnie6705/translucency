// Synthetic Supabase responses only: this suite never touches real accounts or records.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
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

try {
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#rhythm-timeblocks');
 await page.getByLabel('Email',{exact:true}).fill(user.email);
 await page.getByLabel('Password',{exact:true}).fill('synthetic-password');
 await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('button',{name:'Add Timeblock',exact:true}).click();
 const flow=page.getByRole('dialog',{name:'Create a timeblock',exact:true});
 const catalog=flow.getByRole('group',{name:'Tasks from all spaces'});
 await catalog.getByRole('button',{name:'Add Build feature to timeblock',exact:true}).click();
 await flow.getByRole('button',{name:'Next',exact:true}).click();
 await expect(flow.getByRole('heading',{name:"Assess Today's Workload"})).toBeVisible();
 const row=flow.locator('.tb-workload-row').first(), selector=row.locator('.task-element-selector');

 await page.clock.install();
 const workload=flow.getByRole('group',{name:'Workload tasks',exact:true});
 await workload.focus();
 await workload.press('ArrowRight');
 await expect(selector).toHaveAttribute('data-expanded','energy');
 await expect(row.getByRole('button',{name:'Set energy 5 for Build feature',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.clock.fastForward(2000);
 await workload.press('ArrowRight');
 await page.clock.fastForward(2999);
 await expect(selector).toHaveAttribute('data-expanded','energy');
 await page.clock.fastForward(1);
 await expect(selector).toHaveAttribute('data-expanded','none');
 await workload.press('ArrowLeft');
 await expect(selector).toHaveAttribute('data-expanded','energy');
 await expect(row.getByRole('button',{name:'Set energy 4 for Build feature',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.clock.fastForward(1000);
 await row.getByRole('button',{name:'Edit duration for Build feature',exact:true}).click();
 await page.clock.fastForward(4000);
 await expect(selector).toHaveAttribute('data-expanded','duration');
 await row.getByRole('button',{name:'Edit energy for Build feature',exact:true}).click();
 await page.clock.fastForward(4000);
 await expect(selector).toHaveAttribute('data-expanded','energy');
 await workload.focus();await workload.press('ArrowLeft');
 await expect(row.getByRole('button',{name:'Set energy 3 for Build feature',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.clock.fastForward(3000);
 await expect(selector).toHaveAttribute('data-expanded','none');
 assert.deepEqual(errors,[]);
 console.log('Workload shortcuts passed: expands on left/right, resets timeout at bounds, closes after exactly 3s, manual interaction cancels auto-close.');
} finally {await browser.close();}

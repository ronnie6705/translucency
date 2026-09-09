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
 fs.mkdirSync('test-results',{recursive:true});
 async function check(stage,width){
  const modal=page.locator('.flow-modal');
  await expect(modal).toBeVisible();
  const bounds=await modal.evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:el.scrollWidth,client:el.clientWidth};});
  assert.ok(bounds.left>=0&&bounds.right<=bounds.width+1&&bounds.top>=0&&bounds.bottom<=bounds.height+1,stage+' modal fits '+width+' '+JSON.stringify(bounds));
  assert.ok(bounds.scroll<=bounds.client+1,stage+' content fits '+width+' '+JSON.stringify(bounds));
  await page.waitForTimeout(stage==='chronotype'?1700:100);
  if(width===390||width===1440) await page.screenshot({path:`test-results/flow-${stage}-${width}.png`});
 }
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:width===1440?900:740});
  await button('Add Timeblock').click();
  await check('chronotype',width);
  await button('Wolf').click(); await expect(button('Wolf')).toHaveAttribute('aria-pressed','true');
  await button('Cancel').click();
  await page.locator('.timeblock-rail-card').getByRole('heading',{name:"Today's Plan",exact:true}).click();
  await check('tasks',width); await button('Next').click();
  await check('estimates',width);
  await page.getByLabel('Energy for Start building portfolio',{exact:true}).selectOption('2');
  await expect(page.getByLabel('Energy for Start building portfolio',{exact:true})).toHaveValue('2');
  await page.getByLabel('Duration for Start building portfolio',{exact:true}).selectOption('60');
  await button('Next').click(); await check('range',width);
  await page.locator('.time-column').nth(0).getByRole('button',{name:'12 PM',exact:true}).click();
  await page.locator('.time-column').nth(1).getByRole('button',{name:'8:30 PM',exact:true}).click();
  await button('Next').click(); await check('blocks',width);
  await button('Next').click(); await check('final',width);
  await button('Both Live Timer & ICS').scrollIntoViewIfNeeded();
  await button('Close timeblock').click();
 }
 await page.setViewportSize({width:844,height:390}); await button('Add Timeblock').click(); await check('landscape',844);
 assert.deepEqual(errors,[]);
 console.log('PASS: all steps fit 320, 390, 768, 1440px and short landscape; chronotype, duration, energy, range and final controls work.');
} finally {await browser.close();}


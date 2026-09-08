// Synthetic Supabase transport: no real emails, accounts or health data are used.
// SQL permissions are independently exercised in cloud-database.test.ts.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.BASE_URL || 'http://127.0.0.1:3002';
const browser = await chromium.launch({channel:process.platform === 'darwin' ? 'chrome' : 'msedge',headless:true});
const users = new Map();
const documents = new Map();
const errors = [];
const requests = [];
const password = 'Synthetic-only-pass-123!';
const jwt = id => [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test-signature'].join('.');
function user(email) {
  if (!users.has(email)) users.set(email,{id:email.startsWith('alice') ? '00000000-0000-4000-8000-000000000001' : '00000000-0000-4000-8000-000000000002',email,aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email'},user_metadata:{}});
  return users.get(email);
}
async function device() {
  let disconnected = false;
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(() => {
    if (!localStorage.getItem('rhythm:saved-task-lists')) localStorage.setItem('rhythm:saved-task-lists', JSON.stringify([{id:'guest-list',name:'Guest-only list',createdAt:'2026-09-08T00:00:00Z',tasks:[]} ]));
  });
  await context.route('http://127.0.0.1:54321/**', async route => {
    if (disconnected) return route.abort('internetdisconnected');
    const req = route.request();
    const url = new URL(req.url());
    const body = req.postDataJSON();
    requests.push({path:url.pathname,method:req.method(),body});
    const headers = {'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,OPTIONS'};
    const reply = (json, status=200) => route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(json)});
    if (req.method() === 'OPTIONS') return reply({});
    if (url.pathname.endsWith('/otp')) return reply({});
    if (url.pathname.endsWith('/signup')) return reply({user:user(body.email)});
    if (url.pathname.endsWith('/recover')) return body.email === 'limited@example.test' ? reply({code:'over_email_send_rate_limit',msg:'email rate limit exceeded'},429) : reply({});
    if (url.pathname.endsWith('/token')) {
      const passwordGrant = url.searchParams.get('grant_type') === 'password';
      if (passwordGrant ? body.password !== password : !body.auth_code?.startsWith('test-')) return reply({code:'invalid_credentials',msg:'Invalid login credentials'},400);
      const u = user(passwordGrant ? body.email : body.auth_code.slice(5));
      return reply({access_token:jwt(u.id),refresh_token:`refresh-${u.id}`,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:u});
    }
    if (url.pathname.endsWith('/logout')) return reply({});
    const token = (req.headers().authorization || '').replace('Bearer ','');
    const id = token.includes('.') ? JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub : null;
    if (url.pathname.endsWith('/user')) return reply([...users.values()].find(u => u.id === id));
    if (!id) return reply({message:'Unauthorized'},401);
    if (url.pathname.endsWith('/workspace_documents')) {
      const requested = url.searchParams.get('user_id')?.replace('eq.','');
      const module = url.searchParams.get('module')?.replace('eq.','');
      const saved = requested === id ? documents.get(`${id}:${module}`) : null;
      return reply(saved ? [saved] : []);
    }
    if (url.pathname.endsWith('/rpc/save_workspace_document')) {
      if (body.bound_user_id !== id) return reply({code:'42501',message:'Wrong account'},403);
      const key = `${id}:${body.document_module}`;
      const previous = documents.get(key);
      if ((previous?.revision ?? 0) !== body.expected_revision) return reply({code:'40001',message:'Sync conflict'},409);
      const revision = (previous?.revision ?? 0)+1;
      documents.set(key,{payload:body.document_payload,revision});
      return reply(revision);
    }
    return reply({message:'Unexpected request'},400);
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#rhythm`);
  await expect(page.getByRole('heading',{name:'Welcome to your space.'})).toBeVisible();
  await expect(page.locator('.platform-shell')).toHaveCount(0);
  return {context,page,setDisconnected:async value => { disconnected=value; await context.setOffline(value); }};
}
async function signin(page,email) {
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill(password);
  const before = requests.filter(r => /\/(otp|signup|recover)$/.test(r.path)).length;
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.locator('.account-panel > summary')).toContainText(email);
  await expect(page.getByRole('button',{name:'Add Task List'})).toBeVisible();
  assert.equal(requests.filter(r => /\/(otp|signup|recover)$/.test(r.path)).length,before,'password login must not send email');
}
async function addList(page,name) {
  await page.getByRole('button',{name:'Add Task List'}).click();
  await page.getByPlaceholder('What is your task?').fill(name+' task');
  await page.getByRole('button',{name:'Save task',exact:true}).click();
  page.once('dialog',dialog=>dialog.accept(name));
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByText(name,{exact:true})).toBeVisible();
}
async function openAccount(page) { if (!await page.locator('.account-panel').getAttribute('open').then(v=>v!==null)) await page.locator('.account-panel > summary').click(); }
try {
  const a = await device();
  await a.page.getByLabel('Email',{exact:true}).fill('alice@example.test');
  await a.page.getByLabel('Password',{exact:true}).fill('wrong-password');
  await a.page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(a.page.locator('.auth-error')).toContainText('email or password is incorrect');
  await expect(a.page.locator('.platform-shell')).toHaveCount(0);
  await signin(a.page,'alice@example.test');
  await expect(a.page.getByText('Guest-only list',{exact:true})).toHaveCount(0);
  assert.equal(documents.size,0,'sign-in must not upload guest data');
  await addList(a.page,'Cloud list');
  const aliceKey = `${user('alice@example.test').id}:rhythm`;
  await expect.poll(()=>documents.get(aliceKey)?.payload.taskLists.length).toBe(1);
  const b = await device();
  await signin(b.page,'alice@example.test');
  await b.page.reload();
  await expect(b.page.locator('.account-panel > summary')).toContainText('alice@example.test');
  await expect(b.page.getByText('Cloud list',{exact:true})).toBeVisible();
  await a.setDisconnected(true);
  await addList(a.page,'Offline list');
  await addList(b.page,'Second device list');
  await expect.poll(()=>documents.get(aliceKey)?.payload.taskLists.some(x=>x.name==='Second device list')).toBe(true);
  await a.setDisconnected(false);
  await openAccount(a.page);
  await a.page.getByRole('button',{name:'Sync now',exact:true}).click();
  await expect(a.page.getByRole('heading',{name:'Rhythm changed on another device'})).toBeVisible();
  await expect(a.page.getByText('Offline list',{exact:true})).toBeVisible();
  assert.equal(documents.get(aliceKey).payload.taskLists.some(x=>x.name==='Offline list'),false);
  const downloadPromise = a.page.waitForEvent('download');
  await a.page.getByRole('button',{name:'Export device account copy'}).click();
  const download = await downloadPromise;
  const exported = JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  assert.equal(exported.rhythm.payload.taskLists.some(x=>x.name==='Offline list'),true);
  a.page.once('dialog',dialog=>dialog.accept());
  await a.page.getByRole('button',{name:'Use cloud version'}).click();
  await expect(a.page.getByText('Second device list',{exact:true})).toBeVisible();
  await expect(a.page.getByText('Offline list',{exact:true})).toHaveCount(0);
  await a.page.getByRole('button',{name:'Sign out',exact:true}).click();
  await expect(a.page.getByRole('heading',{name:'Welcome to your space.'})).toBeVisible();
  await expect(a.page.getByText('Guest-only list',{exact:true})).toHaveCount(0);
  await expect(a.page.getByText('Cloud list',{exact:true})).toHaveCount(0);
  await signin(a.page,'bob@example.test');
  await expect(a.page.getByText('Cloud list',{exact:true})).toHaveCount(0);
  await expect(a.page.getByText('Guest-only list',{exact:true})).toHaveCount(0);
  await openAccount(a.page);
  await a.page.getByText('Import this browser’s device-only data',{exact:true}).click();
  a.page.once('dialog',dialog=>dialog.accept());
  await a.page.getByRole('button',{name:'Import guest data into my account'}).click();
  await expect(a.page.getByText('Guest-only list',{exact:true})).toBeVisible();
  await expect.poll(()=>documents.get(`${user('bob@example.test').id}:rhythm`)?.payload.taskLists.length).toBe(1);
  assert.equal(documents.get(aliceKey).payload.taskLists.length,2);
  fs.mkdirSync('test-results',{recursive:true});
  await a.page.screenshot({path:'test-results/account-desktop.png',fullPage:true});
  await a.page.setViewportSize({width:390,height:844});
  assert.equal(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await a.page.screenshot({path:'test-results/account-mobile.png',fullPage:true});
  const c = await device();
  await c.page.goto(`${base}/#check-in`);
  await expect(c.page.getByRole('heading',{name:'Welcome to your space.'})).toBeVisible();
  await c.page.screenshot({path:'test-results/login-desktop.png',fullPage:true});
  await c.page.setViewportSize({width:390,height:844});
  await c.page.screenshot({path:'test-results/login-mobile.png',fullPage:true});
  assert.equal(await c.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await c.page.getByRole('button',{name:'Forgot or need a password?'}).click();
  await c.page.getByLabel('Email',{exact:true}).fill('limited@example.test');
  await c.page.getByRole('button',{name:'Send password reset link'}).click();
  await expect(c.page.locator('.auth-error')).toContainText('Email sending is temporarily limited');
  await c.page.getByLabel('Email',{exact:true}).fill('alice@example.test');
  await c.page.getByRole('button',{name:'Send password reset link'}).click();
  await expect(c.page.getByRole('status')).toContainText('If an account exists');
  await c.page.goto(`${base}/auth/confirm?code=test-alice%40example.test`);
  await expect(c.page.getByRole('heading',{name:'Set your password.'})).toBeVisible();
  assert.equal(new URL(c.page.url()).search,'','one-time code is removed');
  const exchangesBeforeReload=requests.filter(r=>r.path.endsWith('/token')).length;
  await c.page.reload();
  await expect(c.page.getByRole('heading',{name:'Set your password.'})).toBeVisible();
  assert.equal(requests.filter(r=>r.path.endsWith('/token')).length,exchangesBeforeReload,'refresh must not exchange a consumed code');
  await c.page.getByLabel('New password',{exact:true}).fill(password);
  await c.page.getByLabel('Confirm password',{exact:true}).fill('does-not-match');
  await c.page.getByRole('button',{name:'Save password'}).click();
  await expect(c.page.locator('.auth-error')).toContainText('do not match');
  await c.page.getByLabel('Confirm password',{exact:true}).fill(password);
  await c.page.getByRole('button',{name:'Save password'}).click();
  await expect(c.page).toHaveURL(`${base}/#check-in`);
  await expect(c.page.locator('.account-panel > summary')).toContainText('alice@example.test');
  assert.equal(await c.page.evaluate(()=>sessionStorage.getItem('rhythm-password-recovery-user')),null);
  assert.ok(requests.some(r=>r.path.endsWith('/user') && r.method==='PUT' && r.body.password===password));
  await openAccount(c.page);
  await c.page.getByRole('button',{name:'Sign out',exact:true}).click();
  await c.page.getByRole('button',{name:'Create an account',exact:true}).click();
  await c.page.getByLabel('Email',{exact:true}).fill('new@example.test');
  await c.page.getByLabel('Password',{exact:true}).fill(password);
  await expect(c.page.getByRole('button',{name:'Create account',exact:true})).toBeDisabled();
  await c.page.getByRole('checkbox',{name:/I understand/}).check();
  await c.page.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(c.page.getByRole('status')).toContainText('confirm your email');
  await expect(c.page.locator('.platform-shell')).toHaveCount(0);
  await c.page.getByRole('button',{name:'Back to sign in'}).click();
  await c.page.getByRole('button',{name:'Use an email link instead'}).click();
  await c.page.getByLabel('Email',{exact:true}).fill('alice@example.test');
  await c.page.getByRole('button',{name:'Send sign-in link',exact:true}).click();
  await expect(c.page.getByRole('status')).toContainText('Check your inbox for a sign-in link');
  await c.page.goto(`${base}/auth/confirm?code=test-alice%40example.test`);
  await expect(c.page).toHaveURL(`${base}/#check-in`);
  await expect(c.page.locator('.account-panel > summary')).toContainText('alice@example.test');
  const d = await device();
  const emailCount=requests.filter(r=>/\/(otp|recover|signup)$/.test(r.path)).length;
  for (const suffix of ['?error=access_denied&error_code=otp_expired', '#error=access_denied&error_code=otp_expired&error_description=private-secret']) {
    await d.page.goto(`${base}/`); // Each provider redirect is a new document, not a same-page hash change.
    await d.page.goto(`${base}/auth/confirm${suffix}`);
    await expect(d.page.locator('.auth-intro')).toContainText('expired or has already been used');
    await expect(d.page.locator('body')).not.toContainText('private-secret');
    assert.equal(d.page.url(),`${base}/auth/confirm`);
    await expect(d.page.locator('.platform-shell')).toHaveCount(0);
  }
  await d.page.goto(`${base}/auth/confirm`);
  await expect(d.page.locator('.auth-intro')).toContainText('no sign-in code');
  await d.page.goto(`${base}/auth/confirm?code=test-alice%40example.test`);
  await expect(d.page.locator('.auth-intro')).toContainText('cannot match the link');
  await d.page.goto(`${base}/`);
  await d.page.goto(`${base}/auth/confirm#access_token=synthetic-token&refresh_token=synthetic-refresh`);
  await expect(d.page.locator('.auth-intro')).toContainText('format this app does not accept');
  assert.equal(d.page.url(),`${base}/auth/confirm`);
  await d.page.getByRole('link',{name:'Return to sign in'}).click();
  await expect(d.page.getByRole('heading',{name:'Welcome to your space.'})).toBeVisible();
  assert.equal(requests.filter(r=>/\/(otp|recover|signup)$/.test(r.path)).length,emailCount,'callback errors must never send emails');
  await c.page.goto(`${base}/auth/confirm`);
  await expect(c.page).toHaveURL(`${base}/#check-in`);
  await expect(c.page.locator('.account-panel > summary')).toContainText('alice@example.test');
  assert.deepEqual(errors,[]);
  console.log('PASS: expired query/fragment callbacks, missing code, missing verifier, rejected implicit tokens, URL scrubbing, recovery refresh, restored session and zero error-triggered emails.');
  console.log('PASS: login-first deep links, password login without email, invalid credentials, session restore, signup consent, rate-limit guidance, PKCE recovery/password update, email links, isolated accounts, two-device sync, offline conflict, backup, sign-out, guest import, desktop/mobile. Synthetic transport only.');
} finally { await browser.close(); }

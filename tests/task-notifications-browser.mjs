// Synthetic account and push transport; no external accounts or notifications.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://127.0.0.1:3017';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const user = { id: '00000000-0000-4000-8000-000000000091', email: 'notify@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
  const writes = [], errors = [];
  let failSave = false;
  await context.addInitScript(() => {
    let sub = null;
    const subscription = { endpoint: 'https://fcm.googleapis.com/test', toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } }; }, async unsubscribe() { sub = null; return true; } };
    const registration = { pushManager: { async getSubscription() { return sub; }, async subscribe() { sub = subscription; return sub; } }, async unregister() { return true; } };
    Object.defineProperty(navigator, 'serviceWorker', { value: { async register() { return registration; }, async getRegistration() { return registration; }, async getRegistrations() { return []; }, ready: Promise.resolve(registration) } });
    Object.defineProperty(window, 'Notification', { value: { permission: 'default', async requestPermission() { this.permission = 'granted'; return 'granted'; } } });
    Object.defineProperty(window, 'PushManager', { value: function () {} });
  });
  await context.route('https://*.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    const token = [Buffer.from('{}').toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now()/1000) + 86400 })).toString('base64url'), 'test'].join('.');
    if (url.pathname.endsWith('/token')) return route.fulfill({ json: { access_token: token, refresh_token: 'test', expires_in: 86400, token_type: 'bearer', user } });
    if (url.pathname.endsWith('/user')) return route.fulfill({ json: user });
    if (url.pathname.endsWith('/workspace_documents')) return route.fulfill({ json: [] });
    if (url.pathname.endsWith('/save_workspace_document')) return route.fulfill({ json: 1 });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ json: {} });
    throw new Error(`Unexpected account request: ${url.pathname}`);
  });
  await context.route('**/api/notifications', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { configured: true, publicKey: 'B'.repeat(87) } });
    writes.push(route.request().method());
    assert.match(route.request().headers().authorization, /^Bearer /);
    return route.fulfill({ status: failSave ? 503 : 200, json: failSave ? { error: 'Could not save notification settings. Please retry.' } : { enabled: route.request().method() === 'POST' } });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/#settings`);
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-123!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const enable = page.getByRole('button', { name: 'Enable task notifications on this device', exact: true });
  await expect(enable).toBeEnabled();
  failSave = true;
  await enable.click();
  await expect(page.getByText('Could not save notification settings. Please retry.', { exact: true })).toBeVisible();
  await expect(enable).toBeEnabled();
  failSave = false;
  await enable.click();
  const disable = page.getByRole('button', { name: 'Disable task notifications on this device', exact: true });
  await expect(disable).toBeEnabled();
  await disable.click();
  await expect(enable).toBeEnabled();
  assert.deepEqual(writes, ['POST', 'POST', 'DELETE']);
  assert.deepEqual(errors, []);
  console.log('PASS: mobile notification settings, permission, registration failure/retry, authenticated enable, and disable.');
} finally { await browser.close(); }

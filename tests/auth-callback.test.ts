import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAuthCallback, callbackErrorMessage, finishAuthCallback } from '../src/lib/cloud/auth-callback';
const parse = (suffix: string) => parseAuthCallback(new URL(`https://example.test/auth/confirm${suffix}`));
test('callback reads query and fragment errors before trying a code exchange', () => {
  assert.deepEqual(parse('?error=access_denied&error_code=otp_expired'), {kind:'error',code:'otp_expired'});
  assert.deepEqual(parse('?code=unused#error=access_denied&error_code=otp_expired'), {kind:'error',code:'otp_expired'});
  assert.deepEqual(parse('#error_description=sensitive-secret'), {kind:'error',code:'unknown'});
  assert.doesNotMatch(callbackErrorMessage({code:'sensitive-secret'}), /sensitive-secret/);
});
test('callback preserves flow IDs and rejects legacy token formats', () => {
  assert.deepEqual(parse('?code=example&sb_flow_id=flow-id'), {kind:'code',code:'example',flowId:'flow-id'});
  assert.deepEqual(parse('?code=example&sb_flow_id='), {kind:'code',code:'example',flowId:''});
  for (const suffix of ['#access_token=secret&refresh_token=secret', '?token_hash=secret', '?token=secret']) assert.deepEqual(parse(suffix), {kind:'unsupported'});
  assert.deepEqual(parse(''), {kind:'missing'});
});
test('callback messages distinguish expiry, wrong browser, throttling and network errors', () => {
  assert.match(callbackErrorMessage({code:'otp_expired'}), /expired or has already been used/);
  assert.match(callbackErrorMessage({name:'AuthPKCECodeVerifierMissingError'}), /same browser and device/);
  assert.match(callbackErrorMessage({code:'bad_code_verifier'}), /cannot match/);
  assert.match(callbackErrorMessage({status:429}), /rate-limited/);
  assert.match(callbackErrorMessage({name:'AuthRetryableFetchError'}), /could not be reached/);
});
test('callback errors and missing configuration never request an email or establish a session', async () => {
  const noCalls = new Proxy({}, {get() { throw new Error('No SDK access allowed'); }}) as SupabaseClient;
  assert.equal((await finishAuthCallback(noCalls,parse('#error_code=otp_expired'))).kind,'error');
  assert.equal((await finishAuthCallback(noCalls,parse('#access_token=secret'))).kind,'error');
  const missing = await finishAuthCallback(null,parse('?code=example'));
  assert.equal(missing.kind,'error');
  if (missing.kind==='error') assert.match(missing.message,/not configured/);
});
test('opening bare callback restores a session only when one exists', async () => {
  for (const session of [null,{user:{id:'synthetic-user'}}]) {
    const client = {auth:{getSession:async()=>({data:{session},error:null})}} as unknown as SupabaseClient;
    assert.equal((await finishAuthCallback(client,{kind:'missing'})).kind,session?'signed-in':'error');
  }
});
test('code exchange passes captured flow ID and unsubscribes even on failure', async () => {
  let listener: (event: string) => void = () => {};
  let unsubscribed = 0;
  const calls: unknown[] = [];
  const client = {auth:{
    onAuthStateChange:(callback: typeof listener)=>{listener=callback;return {data:{subscription:{unsubscribe:()=>unsubscribed++}}};},
    exchangeCodeForSession:async(...args:unknown[])=>{calls.push(args);listener('PASSWORD_RECOVERY');return {data:{session:{user:{id:'synthetic-user'}}},error:null};},
  }} as unknown as SupabaseClient;
  assert.equal((await finishAuthCallback(client,{kind:'code',code:'example',flowId:'preserved'})).kind,'recovery');
  assert.deepEqual(calls,[['example',{flowId:'preserved'}]]);
  assert.equal(unsubscribed,1);
  client.auth.exchangeCodeForSession = async () => {throw new TypeError('secret-details');};
  const failure=await finishAuthCallback(client,{kind:'code',code:'example'});
  assert.equal(failure.kind,'error');
  assert.equal(unsubscribed,2);
  assert.doesNotMatch(JSON.stringify(failure),/secret-details/);
});

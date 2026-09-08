import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath, authErrorMessage } from '../src/lib/cloud/auth-ui';
test('auth return destinations accept only internal app pages', () => {
  assert.equal(safeReturnPath('#check-in'), '/#check-in');
  assert.equal(safeReturnPath('#rhythm-tasks'), '/#rhythm-tasks');
  for (const value of [null, '', '//evil.example', 'https://evil.example', '#check-in?next=evil', '#unknown']) assert.equal(safeReturnPath(value), '/#rhythm');
});
test('auth errors explain email throttling and existing passwordless accounts', () => {
  assert.match(authErrorMessage({code:'over_email_send_rate_limit'}), /sign in with it/);
  assert.match(authErrorMessage({message:'email rate limit exceeded'}), /up to an hour/);
  assert.match(authErrorMessage({code:'invalid_credentials'}), /previously used an email link/);
  assert.match(authErrorMessage({code:'email_not_confirmed'}), /confirm your email/);
});

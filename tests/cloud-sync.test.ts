import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from '../src/lib/cloud/model';
const local = {payload:{note:'offline edit'},revision:2,dirty:true};
test('new account document is created only against an empty remote', () => {
  assert.equal(reconcile({...local,revision:0}, null),'push');
  assert.equal(reconcile({...local,revision:0}, {payload:{note:'existing'},revision:1}),'conflict');
});
test('offline edits sync only against their original revision', () => {
  assert.equal(reconcile(local, {payload:{note:'before edit'},revision:2}),'push');
  assert.equal(reconcile(local, {payload:{note:'other device'},revision:3}),'conflict');
});
test('lost acknowledgement is recovered without overwriting newer remote edits', () => {
  assert.equal(reconcile(local, {payload:local.payload,revision:3}),'pull');
  assert.equal(reconcile(local, {payload:{note:'newer edit'},revision:4}),'conflict');
});
test('clean device follows cloud changes including deletions', () => {
  assert.equal(reconcile({...local,dirty:false},{payload:{},revision:3}),'pull');
  assert.equal(reconcile({...local,dirty:false},{payload:local.payload,revision:2}),'same');
});
test('Postgres JSONB key ordering does not create a false conflict after a lost acknowledgement', () => {
  assert.equal(reconcile({...local,payload:{version:1,task:{name:'Write',duration:30}}},{revision:3,payload:{task:{duration:30,name:'Write'},version:1}}),'pull');
});

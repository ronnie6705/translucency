import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Postgres enforces isolation, authenticated writes, atomic revisions and cascade deletion', async () => {
  const pg = new PGlite();
  const alice = '00000000-0000-4000-8000-000000000001';
  const bob = '00000000-0000-4000-8000-000000000002';
  try {
    await pg.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('${alice}'), ('${bob}');`);
    await pg.exec(await readFile(new URL('../supabase/migrations/202609080001_account_sync.sql', import.meta.url), 'utf8'));
    const login = async (id: string, role = 'authenticated') => {
      await pg.exec(`reset role; set role ${role};`);
      await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    };
    const save = (id: string, revision: number, payload = {note:'private'}) => pg.query<{revision:number}>('select public.save_workspace_document($1, $2, $3, $4) as revision', [id,'rhythm',JSON.stringify(payload),revision]);
    await login('', 'anon');
    await assert.rejects(pg.query('select * from public.workspace_documents'), /permission denied/);
    await assert.rejects(save(alice,0), /permission denied/);
    await login(alice);
    assert.equal((await save(alice,0)).rows[0].revision, 1);
    assert.equal((await pg.query('select * from public.workspace_documents')).rows.length,1);
    await assert.rejects(save(alice,0), /Sync conflict/);
    assert.equal((await save(alice,1,{note:'updated'})).rows[0].revision,2);
    await assert.rejects(save(alice,1,{note:'stale device'}), /Sync conflict/);
    await assert.rejects(pg.query("update public.workspace_documents set payload = '{}'"), /permission denied/);
    await assert.rejects(pg.query('delete from public.workspace_documents'), /permission denied/);
    await login(bob);
    assert.equal((await pg.query('select * from public.workspace_documents')).rows.length,0);
    await assert.rejects(save(alice,2,{note:'cross-account race'}), /Sign in required/);
    assert.equal((await save(bob,0)).rows[0].revision,1);
    await login('');
    assert.equal((await pg.query('select * from public.workspace_documents')).rows.length,0);
    await assert.rejects(save(bob,1), /Sign in required/);
    await login(alice);
    assert.equal((await pg.query<{payload:{note:string}}>('select payload from public.workspace_documents')).rows[0].payload.note,'updated');
    await pg.exec(`reset role; delete from auth.users where id='${alice}';`);
    assert.equal((await pg.query('select * from public.workspace_documents')).rows.length,1);
  } finally { await pg.close(); }
});

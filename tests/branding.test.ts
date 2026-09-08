import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import manifest from '../src/app/manifest';

test('Rhythm is the installed app name without changing its identity or launch URL', () => {
  const app = manifest();
  assert.equal(app.name, 'Rhythm');
  assert.equal(app.short_name, 'Rhythm');
  assert.equal(app.id, '/');
  assert.equal(app.start_url, '/');
  assert.equal(app.scope, '/');
});

test('branding update retires old app shells but leaves unrelated caches alone', async () => {
  const listeners = new Map<string, (event: { waitUntil: (work: Promise<void>) => void }) => void>();
  const removed: string[] = [];
  let claimed = false;
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: {
      addEventListener: (name: string, handler: typeof listeners extends Map<string, infer V> ? V : never) => listeners.set(name, handler),
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      keys: async () => ['translucency-shell-v5-login', 'rhythm-shell-v5', 'rhythm-shell-v6-brand', 'unrelated-cache'],
      delete: async (name: string) => { removed.push(name); },
    },
  });
  let completion: Promise<void> | undefined;
  listeners.get('activate')!({ waitUntil: work => { completion = work; } });
  await completion;
  assert.deepEqual(removed, ['translucency-shell-v5-login', 'rhythm-shell-v5']);
  assert.equal(claimed, true);
});

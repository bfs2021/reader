/**
 * The desktop app's folders: kept most recent first, each on a port of its
 * own from one launch to the next.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIRST_PORT, load, save, ports, remember, forget } from './folders.js';

const take = (it, n) => Array.from({ length: n }, () => it.next().value);

test('a folder is tried on its own port first, then on the ports no other folder has', () => {
  const data = { folders: [{ path: '/a', port: FIRST_PORT }, { path: '/b', port: FIRST_PORT + 2 }] };
  assert.deepEqual(take(ports(data, '/b'), 3), [FIRST_PORT + 2, FIRST_PORT + 1, FIRST_PORT + 3]);
  assert.deepEqual(take(ports(data, '/c'), 2), [FIRST_PORT + 1, FIRST_PORT + 3]);
  assert.deepEqual(take(ports({ folders: [] }, '/a'), 1), [FIRST_PORT]);
});

test('the folder opened last comes first, on the port it got, and ten are kept', () => {
  let data = { folders: [] };
  for (let i = 0; i < 12; i++) data = remember(data, `/f${i}`, FIRST_PORT + i);
  assert.equal(data.folders.length, 10);
  assert.deepEqual(data.folders[0], { path: '/f11', port: FIRST_PORT + 11 });
  data = remember(data, '/f5', FIRST_PORT + 20);
  assert.deepEqual(data.folders[0], { path: '/f5', port: FIRST_PORT + 20 });
  assert.equal(data.folders.filter((f) => f.path === '/f5').length, 1);
  assert.deepEqual(forget(data, '/f5').folders.map((f) => f.path).includes('/f5'), false);
  assert.deepEqual(forget(data), { folders: [] });
});

test('saved and loaded back; nothing, or nothing readable, is no folders', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-folders-'));
  const file = path.join(dir, 'settings', 'folders.json');
  assert.deepEqual(load(file), { folders: [] });
  save(file, { folders: [{ path: '/a', port: FIRST_PORT }] });
  assert.deepEqual(load(file), { folders: [{ path: '/a', port: FIRST_PORT }] });
  fs.writeFileSync(file, '{ not json');
  assert.deepEqual(load(file), { folders: [] });
  fs.writeFileSync(file, JSON.stringify({ folders: [{ path: '/a', port: 'x' }, { path: '/b', port: FIRST_PORT }] }));
  assert.deepEqual(load(file), { folders: [{ path: '/b', port: FIRST_PORT }] });
  fs.rmSync(dir, { recursive: true });
});

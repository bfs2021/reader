import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const READER = fileURLToPath(new URL('../bin/reader.js', import.meta.url));

function dir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-cli-'));
  fs.writeFileSync(path.join(root, 'a.md'), '# a\n');
  return root;
}

/** Start reader, and give back the address it printed, to be stopped with `stop`. */
function start(...args) {
  const child = spawn(process.execPath, [READER, dir(), '--no-browser', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (c) => {
      out += c;
      const url = /^ {2}(http:\/\/\S+)$/m.exec(out)?.[1];
      if (url) resolve({ url, stop: () => child.kill() });
    });
    child.on('exit', (code) => reject(new Error(`exited ${code}: ${out}`)));
  });
}

test('the address printed is the one listened on', async () => {
  const { url, stop } = await start('--host', '::1', '--port', '0');
  try {
    assert.match(url, /^http:\/\/\[::1\]:\d+\/$/);
    assert.equal((await fetch(url + 'api/tree')).status, 200);
  } finally {
    stop();
  }
});

test('a --port with nothing after it is refused, not taken as any free port', () => {
  for (const args of [['--port='], ['--port', ''], ['--port', ' ']]) {
    const out = spawnSync(process.execPath, [READER, dir(), '--no-browser', ...args], { encoding: 'utf8', timeout: 5000 });
    assert.equal(out.status, 1, args.join(' '));
    assert.match(out.stderr, /--port must be a number/);
  }
});

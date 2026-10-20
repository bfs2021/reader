import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const READER = fileURLToPath(new URL('../bin/reader.js', import.meta.url));

function dir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-cli-'));
  fs.writeFileSync(path.join(root, 'a.md'), '# a\n');
  return root;
}

/** Start reader, and give back the address it printed, to be stopped with `stop`, which waits till it has. */
function start(...args) {
  const child = spawn(process.execPath, [READER, dir(), '--no-browser', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (c) => {
      out += c;
      const url = /^ {2}(http:\/\/\S+)$/m.exec(out)?.[1];
      if (url) resolve({ url, stop: () => new Promise((done) => child.once('exit', done).kill()) });
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
    await stop();
  }
});

test('a --port with nothing after it is refused, not taken as any free port', () => {
  for (const args of [['--port='], ['--port', ''], ['--port', ' ']]) {
    const out = spawnSync(process.execPath, [READER, dir(), '--no-browser', ...args], { encoding: 'utf8', timeout: 5000 });
    assert.equal(out.status, 1, args.join(' '));
    assert.match(out.stderr, /--port must be a number/);
  }
});

/** Run reader to its end, as it is when it refuses what it's given. */
function run(...args) {
  return spawnSync(process.execPath, [READER, ...args], { encoding: 'utf8', timeout: 5000 });
}

/** Listen on `port` here, so reader finds it busy; null if something else already has it. */
function hold(port) {
  const server = net.createServer();
  return new Promise((resolve) => {
    server.once('error', () => resolve(null));
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

test('--help says how to use it, and that is all', () => {
  const out = run('--help');
  assert.equal(out.status, 0);
  assert.match(out.stdout, /^usage: reader <dir>/);
  assert.equal(run('-h').stdout, out.stdout);
});

test('an argument it doesn\'t know is refused, saying which', () => {
  const root = dir();
  const cases = [
    [['--nope'], /unknown option --nope\n\nusage:/],
    [[root, 'other'], /unexpected argument other\n\nusage:/],
    [['--host'], /--host needs a value/],
    [['--host', '--no-browser'], /--host needs a value/],
    [['--allow-host'], /--allow-host needs a value/],
    [['--port', '70000'], /--port must be a number/],
    [['--port', '-1'], /--port must be a number/],
    [['-p', '80a'], /--port must be a number/],
    [['--port=1.5'], /--port must be a number/],
    [[path.join(root, 'a.md')], /not a directory: .*a\.md/],
    [[path.join(root, 'missing')], /not a directory: .*missing/],
  ];
  for (const [args, message] of cases) {
    const out = run(...(args[0]?.startsWith('-') ? [root, ...args] : args), '--no-browser');
    assert.equal(out.status, 1, args.join(' '));
    assert.match(out.stderr, message, args.join(' '));
  }
});

test('--open puts the file in the address', async () => {
  const { url, stop } = await start('--port', '0', '--open', 'notes/a b.md');
  try {
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/#notes%2Fa%20b\.md$/);
  } finally {
    await stop();
  }
});

test('without --port, a busy 8734 moves it on to the next port free', async () => {
  const held = await hold(8734);
  const { url, stop } = await start();
  try {
    const port = Number(new URL(url).port);
    assert.ok(port > 8734 && port < 8734 + 50, url);
    assert.equal((await fetch(url + 'api/tree')).status, 200);
  } finally {
    await stop();
    held?.close();
  }
});

test('without --port, it gives up after fifty busy ports, saying which', async () => {
  const held = await Promise.all(Array.from({ length: 50 }, (_, i) => hold(8734 + i)));
  try {
    const out = run(dir(), '--no-browser');
    assert.equal(out.status, 1);
    assert.match(out.stderr, /ports 8734-8783 are all busy; pick one with --port\./);
  } finally {
    for (const server of held) server?.close();
  }
});

test('a --port given that is busy is refused, not moved on from', async () => {
  const held = await hold(0);
  const { port } = held.address();
  try {
    const out = run(dir(), '--no-browser', '--port', String(port));
    assert.equal(out.status, 1);
    assert.match(out.stderr, new RegExp(`port ${port} is busy; pick another with --port`));
  } finally {
    held.close();
  }
});

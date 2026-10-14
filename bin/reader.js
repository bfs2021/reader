#!/usr/bin/env node
/**
 *   reader <dir> [--port 8734] [--no-browser] [--host <address> --allow-host <name>]
 *   reader export <file>... [--out <file>] [--no-draw]
 *
 * Serve a directory of markdown for reading and editing in the browser, or
 * save documents in it as HTML (src/export-cli.js).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from '../src/server.js';

const USAGE = `usage: reader <dir> [--port 8734] [--no-browser] [--host <addr> --allow-host <name>]
       reader export <file>... [--out <file>] [--no-draw]

  <dir>          the content directory to serve (default: current directory)
  --port <n>     port to listen on (default: 8734, or the next free one)
  --no-browser   don't open a browser tab
  --open <file>  open this file first (path relative to <dir>)
  --host <addr>  address to listen on (default: 127.0.0.1); 0.0.0.0 for every
                 network this machine is on. There is no sign-in: whoever can
                 reach it can read and write <dir>
  --allow-host <name>
                 a name or address other devices reach this machine by, as
                 the browser will send it; repeat for more than one
`;

function parseArgs(argv) {
  const opts = { dir: null, port: null, browser: true, open: null, host: '127.0.0.1', allowHosts: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      process.stdout.write(USAGE);
      process.exit(0);
    } else if (a === '--port' || a === '-p') {
      opts.port = Number(argv[++i]);
    } else if (a.startsWith('--port=')) {
      opts.port = Number(a.slice('--port='.length));
    } else if (a === '--no-browser') {
      opts.browser = false;
    } else if (a === '--open') {
      opts.open = argv[++i];
    } else if (a === '--host' || a === '--allow-host') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) fail(`${a} needs a value`);
      if (a === '--host') opts.host = value;
      else opts.allowHosts.push(value);
    } else if (a.startsWith('-')) {
      fail(`unknown option ${a}\n\n${USAGE}`);
    } else if (!opts.dir) {
      opts.dir = a;
    } else {
      fail(`unexpected argument ${a}\n\n${USAGE}`);
    }
  }
  if (opts.port !== null && (!Number.isInteger(opts.port) || opts.port < 0 || opts.port > 65535)) fail('--port must be a number');
  return opts;
}

function fail(msg) {
  process.stderr.write(`reader: ${msg}\n`);
  process.exit(1);
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* the URL is printed anyway */
  }
}

if (process.argv[2] === 'export') {
  const { main } = await import('../src/export-cli.js');
  try {
    await main(process.argv.slice(3));
  } catch (err) {
    fail(err.message);
  }
  process.exit(0);
}

const LOCAL = new Set(['127.0.0.1', 'localhost', '::1']);

const opts = parseArgs(process.argv.slice(2));
const dir = path.resolve(opts.dir || '.');
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`not a directory: ${dir}`);

const { server, content } = createServer({ root: dir, allowHosts: opts.allowHosts });

// Without --port, count up from 8734 so each directory gets its own instance
// and the URLs stay about the same from run to run.
const DEFAULT_PORT = 8734;
const MAX_TRIES = 50;
let port = opts.port ?? DEFAULT_PORT;

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && opts.port === null && port < DEFAULT_PORT + MAX_TRIES - 1) {
    server.listen(++port, opts.host);
    return;
  }
  if (err.code === 'EADDRINUSE') {
    fail(
      opts.port === null
        ? `ports ${DEFAULT_PORT}-${port} are all busy; pick one with --port.`
        : `port ${port} is busy; pick another with --port, or leave it off to use a free one.`
    );
  }
  fail(err.message);
});

server.listen(port, opts.host);

server.on('listening', () => {
  const { port } = server.address();
  const hash = opts.open ? `#${encodeURIComponent(opts.open)}` : '';
  const url = `http://127.0.0.1:${port}/${hash}`;
  const count = content.list().length;
  console.log(`\n  reader — ${content.root}`);
  console.log(`  ${count} file${count === 1 ? '' : 's'}`);
  console.log(`  ${url}`);
  for (const name of opts.allowHosts) console.log(`  http://${name}:${port}/${hash}`);
  if (!LOCAL.has(opts.host)) {
    console.log(`\n  listening on ${opts.host} with no sign-in: anyone who can reach this`);
    console.log('  machine can read and write these files. Keep it to a network you trust.');
    if (!opts.allowHosts.length) console.log('  Other devices are refused until their name for it is given with --allow-host.');
  }
  console.log('  ctrl-c to stop\n');
  if (opts.browser) openBrowser(url);
});

// SIGTERM is how a container or a service manager stops it.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log('\nstopped');
    process.exit(0);
  });
}

/**
 * A headless browser, for `reader export`: what the preview frame would draw
 * of a document (a diagram), which only a browser can draw.
 *
 * It's whatever Chrome or Chromium is on the machine (GitHub's runners have
 * one), driven over the DevTools protocol with Node's own WebSocket, so
 * reader needs nothing more installed. The browser opens the app as served
 * by `url` and is asked what the app's export asks the preview frame for
 * (static/app/exporting.js).
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STARTUP_TIMEOUT = 20000;
const DRAW_TIMEOUT = 60000;

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  win32: [
    `${process.env['PROGRAMFILES']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
    `${process.env['PROGRAMFILES(X86)']}\\Microsoft\\Edge\\Application\\msedge.exe`,
  ],
};
const ON_PATH = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];

/** The browser to draw with: `CHROME_PATH`, or one installed where it usually is; or null. */
export function findBrowser() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const file of CANDIDATES[process.platform] ?? []) if (fs.existsSync(file)) return file;
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const name of ON_PATH) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

/**
 * Opens `browser` headless on the app at `url`. `drawn(file)` is what the
 * preview frame draws of the document at `file`; `close()` ends it, and
 * resolves once it has.
 */
export async function openBrowser(browser, url) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-browser-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    // Chrome won't run its sandbox as root, which is how a container runs it.
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ];
  const child = spawn(browser, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  // One that couldn't start never exits; it fails.
  const exited = new Promise((r) => child.on('exit', r).on('error', r));
  // The profile is written to until the browser has gone, and its helper
  // processes can outlive it for a moment; a profile left in the temp
  // directory is no reason to fail what was drawn.
  const close = async () => {
    child.kill();
    await exited;
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    } catch {
      /* left in the temp directory, for the system to clear */
    }
  };
  try {
    const cdp = await connect(await devtoolsUrl(child));
    const { targetId } = await cdp.send('Target.createTarget', { url });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await cdp.send(
        'Runtime.evaluate',
        { expression, awaitPromise: true, returnByValue: true },
        sessionId
      );
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    const origin = new URL(url).origin;
    await until(
      () => evaluate(`location.origin === ${JSON.stringify(origin)} && document.readyState === 'complete'`).catch(() => false),
      STARTUP_TIMEOUT,
      `the app didn't load in ${browser}`
    );
    return {
      drawn: async (file) =>
        JSON.parse(
          await withTimeout(
            evaluate(`import('/app/exporting.js').then((m) => m.drawnFor(${JSON.stringify(file)})).then(JSON.stringify)`),
            DRAW_TIMEOUT,
            `${file} took too long to draw`
          )
        ),
      close: async () => {
        cdp.close();
        await close();
      },
    };
  } catch (err) {
    await close();
    throw err;
  }
}

/** The DevTools address the browser prints as it starts. */
function devtoolsUrl(child) {
  return new Promise((resolve, reject) => {
    let said = '';
    const timer = setTimeout(() => reject(new Error(`the browser didn't start:\n${said}`)), STARTUP_TIMEOUT);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`the browser stopped (${code}):\n${said}`));
    });
    child.stderr.on('data', (chunk) => {
      said += chunk;
      const m = said.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
  });
}

/** A DevTools connection: `send(method, params, sessionId)` answers with the result. */
function connect(address) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(address);
    const waiting = new Map();
    let next = 0;
    ws.onerror = () => reject(new Error(`couldn't reach the browser at ${address}`));
    ws.onclose = () => {
      for (const { failed } of waiting.values()) failed(new Error('the browser closed'));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      if (m.error) w.failed(new Error(m.error.message));
      else w.done(m.result);
    };
    ws.onopen = () =>
      resolve({
        send: (method, params, sessionId) =>
          new Promise((done, failed) => {
            const id = ++next;
            waiting.set(id, { done, failed });
            ws.send(JSON.stringify({ id, method, params, sessionId }));
          }),
        close: () => ws.close(),
      });
  });
}

async function until(test, ms, message) {
  const end = Date.now() + ms;
  while (!(await test())) {
    if (Date.now() > end) throw new Error(message);
    await new Promise((r) => setTimeout(r, 50));
  }
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => (timer = setTimeout(() => reject(new Error(message)), ms))),
  ]).finally(() => clearTimeout(timer));
}

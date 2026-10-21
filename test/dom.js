/**
 * A page for the tests of what runs in a browser: happy-dom's, enough of
 * one to click, type and post messages in, though it lays nothing out.
 * Nothing on it is fetched and none of its <script>s run; a test runs the
 * scripts it's after itself.
 *
 *   page(html)            a page of `html`, a whole document or what goes in its body
 *   file('static/x.html') a page of one of reader's own
 *   run(window, ...files) runs reader's scripts in the page, as its <script>s would
 *   frame(html)           a page in a frame: `posted` is what it sends the page
 *                         around it, `send` sends it something from there
 *   preview()             the preview frame as the server serves it, every feature's
 *                         script in it: `show(body)` draws a render, as the app sends one
 *   globals(window)       makes the page this test's own, for the app's modules
 */
import fs from 'node:fs';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { FEATURES } from '../features/index.js';

const ROOT = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, ROOT), 'utf8');

export function page(html = '', { url = 'http://localhost:8734/' } = {}) {
  const window = new Window({
    url,
    settings: {
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
      handleDisabledFileLoadingAsSuccess: true,
      navigation: { disableMainFrameNavigation: true, disableChildFrameNavigation: true, disableChildPageNavigation: true },
    },
  });
  if (/^\s*<!doctype/i.test(html)) window.document.write(html);
  else window.document.body.innerHTML = html;
  return window;
}

export const file = (path, opts) => page(read(path), opts);

export function run(window, ...files) {
  for (const path of files) vm.runInContext(read(path), window, { filename: path });
  return window;
}

export function frame(html, opts) {
  const window = page(html, opts);
  const posted = [];
  const parent = { postMessage: (data) => posted.push(structuredClone(data)) };
  Object.defineProperty(window, 'parent', { value: parent, configurable: true });
  const send = (data) => window.dispatchEvent(new window.MessageEvent('message', { data, source: parent }));
  return { window, document: window.document, posted, send };
}

export function preview(opts = {}) {
  const f = frame(read('static/preview.html'), { url: 'http://localhost:8734/preview.html', ...opts });
  run(f.window, 'static/preview-api.js', ...FEATURES.flatMap((x) => [x.preview ?? []].flat()), 'static/preview.js');
  const show = (body, m = {}) => f.send({ type: 'render', css: '', body, ...m });
  return { ...f, show };
}

// Node's own are kept: its timers, for one, are what `mock.timers` mocks.
// These are the page's, Node's own being of no use to it.
const PAGE = ['window', 'document', 'location', 'navigator', 'localStorage', 'sessionStorage', 'Event', 'CustomEvent', 'EventTarget', 'MessageEvent'];

export function globals(window) {
  for (const name of Object.getOwnPropertyNames(window)) {
    if (name in globalThis && !PAGE.includes(name)) continue;
    Object.defineProperty(globalThis, name, { get: () => (name === 'window' ? window : window[name]), set: (v) => { window[name] = v; }, configurable: true });
  }
  return window;
}

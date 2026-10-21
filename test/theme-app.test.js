import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// The theme chosen in the help, as the app takes it: its radio buttons, and
// the document drawn again in it. (theme.test.js has the choice itself.)

mock.timers.enable({ apis: ['setTimeout'] });

const window = globals(app());
globalThis.fetch = async (url) => {
  const ask = String(url);
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { files: [{ path: 'a.md', type: 'md', mtime: 1 }] }
    : ask.startsWith('/api/render') ? { css: '', body: '<div class="gm-doc"><p>A</p></div>', title: 'A', deck: false }
    : { text: '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el } = await import('../static/app/state.js');
const sent = [];
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage: (m) => sent.push(m) } });
await import('../static/app/main.js');
// The frame says it's ready, as it does once it's loaded.
window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'ready' }, source: el.preview.contentWindow }));
const settled = () => new Promise(setImmediate);
await settled();
const radio = (value) => el.theme.querySelector(`input[value=${value}]`);
const renders = () => sent.filter((m) => m.type === 'render');

test('the theme is a named group of three choices, System ticked to start', () => {
  assert.equal(el.theme.tagName, 'FIELDSET');
  assert.equal(el.theme.querySelector('legend').textContent, 'Theme');
  assert.deepEqual([...el.theme.querySelectorAll('input[type=radio]')].map((r) => r.value), ['light', 'dark', 'system']);
  assert.ok(radio('system').checked);
  assert.ok(renders().length);
  assert.equal(renders().at(-1).dark, false);
});

test('choosing Dark keeps it, darkens the app and draws the document again, dark', async () => {
  const before = renders().length;
  radio('dark').click();
  await settled();
  assert.equal(window.localStorage.getItem('reader:theme'), 'dark');
  assert.equal(window.document.documentElement.dataset.theme, 'dark');
  assert.ok(radio('dark').checked);
  assert.ok(renders().length > before);
  assert.equal(renders().at(-1).dark, true);
});

test('choosing Light from another window ticks it here, and draws it light', async () => {
  window.localStorage.setItem('reader:theme', 'light');
  const e = new window.Event('storage');
  Object.defineProperty(e, 'key', { value: 'reader:theme' });
  window.dispatchEvent(e);
  await settled();
  assert.ok(radio('light').checked);
  assert.ok(!radio('dark').checked);
  assert.equal(renders().at(-1).dark, false);
});

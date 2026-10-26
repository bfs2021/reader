import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { app, globals } from './dom.js';

// A toast hides itself a few seconds on; here it waits to be told.
mock.timers.enable({ apis: ['setTimeout'] });

const window = globals(app());
const { document } = window;
// The server: a folder of three files, and whatever's asked of it done.
let files = ['a.md', 'b.md', 'c.md'];
globalThis.fetch = async (url, { body } = {}) => {
  const ask = String(url);
  const said = body && JSON.parse(body);
  if (ask.startsWith('/api/trash')) files = files.filter((p) => p !== said.path);
  const out = ask.startsWith('/api/info') ? { name: 'notes', root: '/notes' }
    : ask.startsWith('/api/tree') ? { files: files.map((path) => ({ path, type: 'md', mtime: 1 })) }
    : ask.startsWith('/api/trash') ? { trash: 't1' }
    : { text: '# A\n', mtime: 1 };
  return { ok: true, json: async () => out };
};

const { el, state, deck } = await import('../static/app/state.js');
const { setPages } = await import('../static/app/pages.js');
const { deckKey } = await import('../static/app/deck.js');
Object.defineProperty(el.preview, 'contentWindow', { value: { postMessage() {} } });
// The stage keeps what it's sent.
const staged = [];
Object.defineProperty(el.stage, 'contentWindow', { value: { postMessage: (m) => staged.push(m) } });
await import('../static/app/main.js');
const settled = () => new Promise(setImmediate);
await settled();

const row = (p) => el.files.querySelector(`.file[data-path="${p}"]`);
const press = (target, key, opts = {}) => target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...opts }));

test('Esc in the New form gives the keyboard back to New', () => {
  el.newBtn.click();
  assert.equal(document.activeElement, el.newName);
  press(el.newName, 'Escape');
  assert.equal(el.newForm.hidden, true);
  assert.equal(document.activeElement, el.newBtn);
});

test('a rename called off by Esc, or left as it was by Enter, gives the keyboard back to its row', async () => {
  for (const key of ['Escape', 'Enter']) {
    row('b.md').focus();
    press(row('b.md'), 'F2');
    const input = el.files.querySelector('.name-edit');
    assert.equal(document.activeElement, input);
    press(input, key);
    await settled();
    assert.equal(document.activeElement, row('b.md'), key);
  }
});

test('a file trashed from the list leaves the keyboard on the file after it', async () => {
  row('b.md').focus();
  press(row('b.md'), 'Backspace', { metaKey: true });
  await settled();
  await settled();
  assert.equal(row('b.md'), null);
  assert.equal(document.activeElement, row('c.md'));
  assert.equal(state.current.path, 'a.md');
});

test("one of a row's actions keeps the keyboard when the list is drawn again, as coming back to the window does", async () => {
  const action = (kind) => row('a.md').closest('li').querySelector(`.row-action.${kind}`);
  for (const kind of ['branch', 'export', 'trash', 'into']) {
    const was = action(kind);
    was.focus();
    window.dispatchEvent(new window.Event('focus'));
    await settled();
    assert.ok(action(kind) !== was, `${kind}: the list was drawn again`);
    assert.ok(document.activeElement === action(kind), `${kind} has the keyboard`);
  }
});

test('a page dot clicked gives the keyboard to the dot of the page turned to, and Back or Next to the other at an end', () => {
  const pages = ['One', 'Two', 'Three'].map((t, line) => ({ body: `<h1>${t}</h1>`, line }));
  setPages(pages, 'a.md');
  const dot = (n) => el.pageDots.querySelectorAll('.page-dot')[n];
  dot(1).focus();
  dot(1).click();
  assert.equal(document.activeElement, dot(1));
  assert.equal(dot(1).getAttribute('aria-current'), 'page');
  el.pageNext.focus();
  el.pageNext.click();
  assert.equal(document.activeElement, el.pageBack);
});

test('Tab in a deck takes the keyboard into the slide, and the slide gives it back to the deck', () => {
  deck.open = true;
  deckKey({ key: 'Tab', shiftKey: false });
  assert.ok(document.activeElement === el.stage, 'the stage has the keyboard');
  assert.deepEqual(staged.at(-1), { type: 'tab', back: false });
  deckKey({ key: 'Tab', shiftKey: true });
  assert.deepEqual(staged.at(-1), { type: 'tab', back: true });
  // Past its last box, the slide says so.
  window.dispatchEvent(new window.MessageEvent('message', { data: { type: 'untab' }, source: el.stage.contentWindow }));
  assert.ok(document.activeElement === el.deck, 'the deck has the keyboard back');
  deck.open = false;
});

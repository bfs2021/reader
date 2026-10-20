import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// A toast hides itself a few seconds on; here it waits to be told.
mock.timers.enable({ apis: ['setTimeout'] });

const ROW = 20;    // px, each row of the editor
const WIDE = 40;   // characters to a row, before a line wraps

/** Just enough of an element for lines.js, and the mirror sync.js measures lines in. */
class Node {
  constructor() {
    Object.assign(this, { children: [], parent: null, style: {}, dataset: {}, className: '', textContent: '', hidden: false, listeners: {} });
  }
  append(...nodes) { this.insertBefore(nodes, null); }
  insertBefore(nodes, ref) {
    const list = nodes instanceof Node && nodes.fragment ? nodes.children : [nodes].flat();
    for (const n of list) n.parent = this;
    const at = ref ? this.children.indexOf(ref) : this.children.length;
    this.children.splice(at, 0, ...list);
  }
  replaceWith(...nodes) {
    for (const n of nodes) n.parent = this.parent;
    this.parent.children.splice(this.parent.children.indexOf(this), 1, ...nodes);
  }
  remove() { this.parent?.children.splice(this.parent.children.indexOf(this), 1); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  focus() { page.activeElement = this; }
  select() { page.selected = this; }
  closest() { return this; }
  /** A line in the mirror wraps at WIDE characters. */
  get offsetHeight() { return Math.max(1, Math.ceil(this.textContent.length / WIDE)) * ROW; }
}

class Editor extends Node {
  constructor() {
    super();
    Object.assign(this, { value: '', selectionStart: 0, selectionEnd: 0, selectionDirection: 'forward', scrollTop: 0, clientWidth: 400, clientHeight: 100 });
  }
  setSelectionRange(start, end) { Object.assign(this, { selectionStart: start, selectionEnd: end }); }
  get scrollHeight() {
    return this.value.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / WIDE)), 0) * ROW;
  }
}

const elements = { editor: new Editor() };
const frames = [];
const copied = [];
let clipboard = true;
let execCopies = true;
const page = {
  body: new Node(),
  activeElement: null,
  getElementById: (id) => (elements[id] ??= new Node()),
  createElement: () => new Node(),
  createDocumentFragment: () => Object.assign(new Node(), { fragment: true }),
  addEventListener() {},
  execCommand: () => {
    if (execCopies) copied.push(page.selected.value);
    return execCopies;
  },
};
globalThis.document = page;
globalThis.window = { addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.getComputedStyle = () => ({ lineHeight: `${ROW}px`, paddingTop: '0px', paddingBottom: '0px' });
globalThis.requestAnimationFrame = (fn) => frames.push(fn);
globalThis.ResizeObserver = class { observe() {} };
globalThis.location = { hostname: 'localhost', origin: 'http://localhost:8734' };
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    clipboard: {
      writeText: async (text) => {
        if (!clipboard) throw new Error('not a secure context');
        copied.push(text);
      },
    },
  },
});

const { el, state } = await import('../static/app/state.js');
const { copyLines, copyPath, goToLines, scheduleGutter, wireLines } = await import('../static/app/lines.js');
wireLines();

const TEXT = 'one\ntwo\nthree\nfour\n';

/** The editor showing `text` in the file at `path`, with `selected` selected. */
function editing(text = TEXT, { path = 'notes/a b.md', type = 'md', selected = [0, 0] } = {}) {
  Object.assign(state, { root: '/home/me/docs', current: { path, type } });
  Object.assign(el.editor, { value: text, scrollTop: 0, selectionDirection: 'forward' });
  el.editor.setSelectionRange(...selected);
  copied.length = 0;
}

/** What's copied when `copy` is called. */
async function copying(copy) {
  copied.length = 0;
  copy();
  await new Promise(setImmediate);
  return copied.slice();
}

/** The line numbers drawn down the side: [number, top, the caret's]. */
function gutter() {
  for (const fn of frames.splice(0)) fn();
  return el.gutter.children.map((n) => [String(n.textContent), n.style.top, n.className === 'now']);
}

test('copying lines gives the file and the caret\'s line, or the lines selected', async () => {
  editing(TEXT, { selected: [5, 5] });
  assert.deepEqual(await copying(copyLines), ['/home/me/docs/notes/a b.md:2']);
  editing(TEXT, { selected: [5, 10] });
  assert.deepEqual(await copying(copyLines), ['/home/me/docs/notes/a b.md:2-3']);
  assert.equal(el.toast.textContent, 'Copied /home/me/docs/notes/a b.md:2-3');
});

test('lines selected whole end at the start of the next, which isn\'t one of them', async () => {
  editing(TEXT, { selected: [4, 14] });
  assert.deepEqual(await copying(copyLines), ['/home/me/docs/notes/a b.md:2-3']);
  editing(TEXT, { selected: [4, 8] });
  assert.deepEqual(await copying(copyLines), ['/home/me/docs/notes/a b.md:2']);
});

test('copying the path gives the file alone, and lines are only a markdown file\'s', async () => {
  editing(TEXT, { selected: [5, 5] });
  assert.deepEqual(await copying(copyPath), ['/home/me/docs/notes/a b.md']);
  editing(TEXT, { path: 'paper.pdf', type: 'pdf' });
  assert.deepEqual(await copying(copyLines), []);
  assert.deepEqual(await copying(copyPath), ['/home/me/docs/paper.pdf']);
});

test('seen from another device, it\'s the file\'s address here, at its lines', async () => {
  globalThis.location = { hostname: '192.168.1.5', origin: 'http://192.168.1.5:8734' };
  try {
    editing(TEXT, { selected: [5, 10] });
    assert.deepEqual(await copying(copyLines), ['http://192.168.1.5:8734/#notes/a%20b.md:2-3']);
    assert.deepEqual(await copying(copyPath), ['http://192.168.1.5:8734/#notes/a%20b.md']);
  } finally {
    globalThis.location = { hostname: 'localhost', origin: 'http://localhost:8734' };
  }
});

test('without the clipboard, it\'s copied the old way, and the editor\'s selection kept', async () => {
  clipboard = false;
  try {
    editing(TEXT, { selected: [5, 10] });
    el.editor.focus();
    assert.deepEqual(await copying(copyLines), ['/home/me/docs/notes/a b.md:2-3']);
    assert.equal(page.activeElement, el.editor);
    assert.deepEqual([el.editor.selectionStart, el.editor.selectionEnd], [5, 10]);
    assert.deepEqual(page.body.children.filter((n) => 'value' in n && n !== el.editor), [], 'the scratch is gone');
    execCopies = false;
    assert.deepEqual(await copying(copyLines), []);
    assert.equal(el.toast.textContent, 'could not copy');
    assert.match(el.toast.className, /err/);
  } finally {
    clipboard = execCopies = true;
  }
});

test('going to lines selects them, or puts the caret at the start of one, and brings it a third down', () => {
  const text = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');
  editing(text);
  goToLines(10, 12);
  assert.equal(text.slice(el.editor.selectionStart, el.editor.selectionEnd), 'line 10\nline 11\nline 12');
  assert.equal(el.editor.scrollTop, 9 * ROW - 100 / 3);
  goToLines(2);
  assert.deepEqual([el.editor.selectionStart, el.editor.selectionEnd], [text.indexOf('line 2'), text.indexOf('line 2')]);
  assert.equal(el.editor.scrollTop, 0, 'no further up than the top');
});

test('going to lines past either end stops at the first or the last', () => {
  editing(TEXT);
  goToLines(0);
  assert.equal(el.editor.selectionStart, 0);
  goToLines(3, 99);
  assert.equal(TEXT.slice(el.editor.selectionStart, el.editor.selectionEnd), 'three\nfour\n');
  goToLines(99);
  assert.equal(el.editor.selectionStart, TEXT.length);
});

test('the gutter numbers the lines in view, each where its line starts, the caret\'s marked', () => {
  const long = 'x'.repeat(WIDE * 2);
  editing(`one\n${long}\nthree\nfour\nfive\nsix\n`, { selected: [2, 2] });
  scheduleGutter();
  assert.deepEqual(gutter(), [['1', '0px', true], ['2', '20px', false], ['3', '60px', false], ['4', '80px', false]]);
  // Scrolled down a line, and the caret on the long one.
  el.editor.scrollTop = 20;
  el.editor.setSelectionRange(10, 10);
  scheduleGutter();
  assert.deepEqual(gutter(), [['2', '0px', true], ['3', '40px', false], ['4', '60px', false], ['5', '80px', false]]);
});

test('the gutter is drawn once a frame, and not for what isn\'t markdown', () => {
  editing(TEXT);
  scheduleGutter();
  scheduleGutter();
  assert.equal(frames.length, 1);
  gutter();
  editing(TEXT, { path: 'paper.pdf', type: 'pdf' });
  el.gutter.replaceChildren();
  scheduleGutter();
  assert.deepEqual(gutter(), []);
});

test('clicking a line\'s number copies where that line is', async () => {
  editing(TEXT);
  assert.deepEqual(await copying(() => el.gutter.listeners.click({ target: Object.assign(new Node(), { dataset: { line: '3' } }) })),
    ['/home/me/docs/notes/a b.md:3']);
});

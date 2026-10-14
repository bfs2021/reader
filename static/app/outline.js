/**
 * The open file's outline, in the file list: one level below the file, as
 * a file's versions are one level below its row. Its parts and headings
 * are worked out in sections.js; clicking one goes there, in the editor
 * and the page beside it. The one being read is marked as either scrolls.
 *
 * Parts (and a talk's sections) are folded but for the one being read;
 * headings are open. ▸ and ▾, or → and ←, fold and open one, and that's
 * kept while the file is open.
 */

import { el, state } from './state.js';
import { outline } from './sections.js';
import { goToLine } from './goto.js';
import { topLine } from './sync.js';
import { drawTree } from './files.js';

let cache = { text: null, data: null };
let at = 0;                 // the line being read
let toggled = new Map();    // entry key -> open or not, as set by hand
let toggledFor = null;      // the file `toggled` is for

/** The open file's outline, worked out again only when its text has changed. */
export function current() {
  if (cache.text !== el.editor.value) cache = { text: el.editor.value, data: outline(el.editor.value) };
  return cache.data;
}

const shown = () => state.outline && !el.filter.value.trim() && state.current?.type === 'md';
// An entry's titles from the outermost in: kept for it as lines move with typing.
const keyOf = (e, parent) => `${parent ?? ''}/${e.title}`;
const isFolded = (e) => e.kind === 'part' || e.kind === 'section';

/** The entry that `line` is in, at each depth, outermost first. */
function trail(entries, line, out = []) {
  const e = entries.findLast((x) => x.line <= line && line < x.end);
  if (!e) return out;
  out.push(e);
  return trail(e.children, line, out);
}

function isOpen(e, key) {
  if (toggled.has(key)) return toggled.get(key);
  return !isFolded(e) || (e.line <= at && at < e.end);
}

/** Draws the outline as the file list's rows. */
export function drawOutline() {
  if (toggledFor !== state.current?.path) {
    toggled = new Map();
    toggledFor = state.current?.path;
  }
  const { entries, parts } = current();
  if (!entries.length) {
    const li = document.createElement('li');
    li.className = 'outline-empty';
    li.textContent = 'No headings or parts yet. A # heading, or --- between parts, makes one.';
    el.files.append(li);
    return;
  }
  const here = trail(entries, at).at(-1);
  const add = (list, depth, parent) => {
    for (const e of list) {
      const key = keyOf(e, parent);
      const open = isOpen(e, key);
      el.files.append(entryItem(e, { depth, key, open, here: e === here, number: parts.findIndex((p) => p.line === e.line) + 1 }));
      if (open) add(e.children, depth + 1, key);
    }
  };
  add(entries, 0, null);
}

function entryItem(e, { depth, key, open, here, number }) {
  const li = document.createElement('li');
  li.className = 'entry-row';
  li.style.setProperty('--depth', depth);
  const fold = document.createElement('button');
  fold.className = 'fold';
  fold.tabIndex = -1;
  if (e.children.length) {
    fold.textContent = open ? '▾' : '▸';
    fold.setAttribute('aria-label', open ? 'Fold' : 'Open');
    fold.addEventListener('click', () => toggle(key, !open));
  } else fold.disabled = true;

  const b = document.createElement('button');
  b.className = `entry ${e.kind}`;
  b.dataset.entry = key;
  b.dataset.line = e.line;
  if (e.children.length) b.setAttribute('aria-expanded', String(open));
  if (here) b.classList.add('at');
  b.title = `Line ${e.head + 1}`;
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = e.title;
  b.append(name);
  if (number && e.kind !== 'heading') {
    const n = document.createElement('span');
    n.className = 'num';
    n.textContent = number;
    b.append(n);
  }
  b.addEventListener('click', () => goToLine(e.head, { focus: false }));
  li.append(fold, b);
  return li;
}

function toggle(key, open) {
  toggled.set(key, open);
  redraw();
}

// drawTree keeps the focused row focused.
const redraw = () => drawTree();

/**
 * Keys on an entry: → opens it, or goes into it; ← folds it, or goes out
 * to the entry it's in. False for a key that isn't the outline's, as ← is
 * on an outermost entry, which goes back out to the files.
 */
export function entryKey(e, b) {
  const open = b.getAttribute('aria-expanded');
  const key = b.dataset.entry;
  if (e.key === 'ArrowRight') {
    if (open === 'false') toggle(key, true);
    else if (open === 'true') b.closest('li').nextElementSibling?.querySelector('.entry')?.focus();
    return true;
  }
  if (e.key === 'ArrowLeft') {
    if (open === 'true') {
      toggle(key, false);
      return true;
    }
    const parent = key.slice(0, key.lastIndexOf('/'));
    if (!parent) return false;
    el.files.querySelector(`.entry[data-entry="${CSS.escape(parent)}"]`)?.focus();
    return true;
  }
  return false;
}

let held = 0;

/**
 * The line being read is `line`: mark the entry it's in, and open its part
 * if it's folded. A place gone to (`goto`) holds against the scrolling it
 * sets off, which may not get there at the end of the file.
 */
export function setAt(line, { goto = false } = {}) {
  if (goto) held = performance.now() + 300;
  else if (performance.now() < held) return;
  if (line === at) return;
  const before = trail(current().entries, at);
  at = line;
  if (!shown()) return;
  const after = trail(current().entries, at);
  if (before[0] !== after[0] && after[0] && isFolded(after[0]) && !toggled.has(keyOf(after[0], null))) return redraw();
  const here = after.reduce((key, e) => keyOf(e, key), null);
  for (const b of el.files.querySelectorAll('.entry')) b.classList.toggle('at', b.dataset.entry === here);
  el.files.querySelector('.entry.at')?.scrollIntoView({ block: 'nearest' });
}

let typing = 0;
export function wireOutline() {
  el.editor.addEventListener('scroll', () => setAt(topLine()), { passive: true });
  window.addEventListener('message', (e) => {
    if (e.source === el.preview.contentWindow && e.data?.type === 'scrolled') setAt(Math.floor(e.data.line));
  });
  // Typing changes the outline; it's drawn again once there's a pause.
  el.editor.addEventListener('input', () => {
    if (!shown()) return;
    clearTimeout(typing);
    typing = setTimeout(redraw, 300);
  });
}

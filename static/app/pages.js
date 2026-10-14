/**
 * A deck being worked through: a workbook, a page to a slide, one shown at a
 * time. Under it are Back and Next and a dot for each page, filled once the
 * page is done; a long one's dots go in blocks (see dots.js).
 */

import { el } from './state.js';
import { renderNow } from './render.js';
import { layout } from './dots.js';

const book = {
  pages: null,          // [{ body, line }] while a deck is being worked through
  index: 0,
  path: null,           // the file `index` is a page of
  line: null,           // a line of the file to open on the page of, at the next render
};

/** Is a page of a workbook showing? */
export const paged = () => Boolean(book.pages);

/** Opens on the page `line` of the file is on, when the pages next arrive. */
export function openAt(line) {
  book.line = line;
}

/**
 * Takes a render's pages, if it had any, for the file at `path`. Returns the
 * one to show, or null when the file isn't being worked through as a deck.
 */
export function setPages(pages, path) {
  book.pages = pages ?? null;
  el.pages.hidden = !pages;
  if (!pages) return null;
  if (book.line != null) book.index = Math.max(0, pages.findLastIndex((p) => p.line <= book.line));
  else if (book.path !== path) book.index = 0;
  book.line = null;
  book.path = path;
  book.index = Math.min(book.index, pages.length - 1);
  draw();
  return pages[book.index];
}

export function turnTo(i) {
  if (!book.pages) return;
  const index = Math.min(book.pages.length - 1, Math.max(0, i));
  if (index === book.index) return;
  book.index = index;
  draw();
  // Drawn again from the file, which has whatever was filled in since.
  renderNow({ resetScroll: true });
}

export const turn = (by) => turnTo(book.index + by);

/** Turns to the page that line `line` of the file is on. */
export function turnToLine(line) {
  if (book.pages) turnTo(Math.max(0, book.pages.findLastIndex((p) => p.line <= line)));
}

export function wirePages() {
  el.pageBack.addEventListener('click', () => turn(-1));
  el.pageNext.addEventListener('click', () => turn(1));
}

const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const checked = (box) => box.hasAttribute('checked');

/**
 * A page's name, from its first heading, and whether it's done: by its
 * opening heading's checkbox if it has one; otherwise when every task on it
 * is ticked and every choice made. With none of those there's nothing to
 * do on it, and `done` is null.
 */
export function mark(body, i) {
  const doc = new DOMParser().parseFromString(`<body>${body}</body>`, 'text/html');
  const heading = doc.querySelector(HEADINGS);
  const title = heading?.textContent.trim() || `Page ${i + 1}`;
  const own = heading?.querySelector(':scope > .task-box');
  if (own) return { title, done: checked(own) };
  const tasks = [...doc.querySelectorAll('.task-box')];
  const choices = Map.groupBy(doc.querySelectorAll('.choice-box'), (box) => box.name);
  if (!tasks.length && !choices.size) return { title, done: null };
  return { title, done: tasks.every(checked) && [...choices.values()].every((group) => group.some(checked)) };
}

function dot({ title, done }, i, index) {
  const dot = document.createElement('button');
  dot.type = 'button';
  dot.className = 'page-dot';
  dot.classList.toggle('done', Boolean(done));
  dot.classList.toggle('now', i === index);
  dot.title = title;
  dot.setAttribute('aria-label', `Page ${i + 1}: ${title}${done ? ', done' : ''}`);
  if (i === index) dot.setAttribute('aria-current', 'page');
  dot.addEventListener('click', () => turnTo(i));
  return dot;
}

/**
 * A closed block of pages, named by its first and filled as far as its pages
 * are done; it opens on its first.
 */
function block(marks, from, to) {
  const range = `${from + 1}–${to}`;
  const counted = marks.slice(from, to).filter((m) => m.done != null);
  const done = counted.filter((m) => m.done).length;
  const mark = document.createElement('button');
  mark.type = 'button';
  mark.className = 'page-block';
  mark.textContent = from + 1;
  mark.style.setProperty('--done', `${counted.length ? (100 * done) / counted.length : 0}%`);
  mark.classList.toggle('done', counted.length > 0 && done === counted.length);
  const summary = `Pages ${range}${counted.length ? `, ${done} of ${counted.length} done` : ''}`;
  mark.title = summary;
  mark.setAttribute('aria-label', summary);
  mark.addEventListener('click', () => turnTo(from));
  return mark;
}

function draw() {
  const { pages, index } = book;
  const marks = pages.map((p, i) => mark(p.body, i));
  el.pageDots.replaceChildren(...layout(pages.length, index).map((m) => {
    const li = document.createElement('li');
    li.append('page' in m ? dot(marks[m.page], m.page, index) : block(marks, m.from, m.to));
    return li;
  }));
  const counted = marks.filter((m) => m.done != null);
  const done = counted.filter((m) => m.done).length;
  el.pageCount.textContent = `${index + 1} of ${pages.length}${counted.length ? ` · ${done} done` : ''}`;
  el.pageBack.disabled = index === 0;
  el.pageNext.disabled = index === pages.length - 1;
}

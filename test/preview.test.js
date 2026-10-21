import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';
import { preview } from './dom.js';

const BASE = 'http://localhost:8734/content/notes/';

/** The preview frame showing `markdown`, from a file in notes/. */
function showing(markdown, m = {}) {
  const p = preview();
  p.show(render(markdown).body, { base: BASE, ...m });
  p.posted.length = 0;
  const link = (text) => [...p.document.querySelectorAll('a')].find((a) => a.textContent === text);
  return { ...p, link };
}

test('a relative link or image is to the file in the content directory, and no further up than its top', () => {
  const { document, link } = showing([
    '[next](next.md) [up](../top.md?x#y) [past](../../../../etc/passwd.md) [here](#a) [abs](/api/files)',
    '[away](https://example.com/a.md) ![pic](img/pic.png)',
  ].join('\n'));
  assert.equal(link('next').href, 'http://localhost:8734/content/notes/next.md');
  assert.equal(link('up').href, 'http://localhost:8734/content/top.md?x#y');
  assert.equal(link('past').href, 'http://localhost:8734/content/etc/passwd.md');
  assert.equal(link('here').getAttribute('href'), '#a');
  assert.equal(link('abs').getAttribute('href'), '/api/files');
  assert.equal(link('away').href, 'https://example.com/a.md');
  assert.equal(document.querySelector('img').src, 'http://localhost:8734/content/notes/img/pic.png');
});

test('a page not from the content directory keeps its links as written', () => {
  const { link } = showing('[next](next.md)', { base: 'http://localhost:8734/export/' });
  assert.equal(link('next').getAttribute('href'), 'next.md');
});

/** Clicks `a`, with `keys` held: whether it was taken, and what the frame asked of the app. */
function click(p, a, keys = {}) {
  const e = new p.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...keys });
  a.dispatchEvent(e);
  const followed = p.posted.filter((m) => m.type === 'follow').map((m) => m.href);
  p.posted.length = 0;
  return { taken: e.defaultPrevented, followed };
}

test('a link to a markdown file being served is opened in the app', () => {
  const p = showing('[next](next.md) [notes](../Notes.MARKDOWN#part)');
  assert.deepEqual(click(p, p.link('next')), { taken: true, followed: ['http://localhost:8734/content/notes/next.md'] });
  assert.deepEqual(click(p, p.link('notes')), { taken: true, followed: ['http://localhost:8734/content/Notes.MARKDOWN#part'] });
});

test('a link to anything else, or clicked with a key held, is left to open its tab', () => {
  const p = showing('[pdf](paper.pdf) [away](https://example.com/a.md) [next](next.md)');
  const none = { taken: false, followed: [] };
  assert.deepEqual(click(p, p.link('pdf')), none);
  assert.deepEqual(click(p, p.link('away')), none);
  for (const key of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) assert.deepEqual(click(p, p.link('next'), { [key]: true }), none, key);
  assert.deepEqual(click(p, p.link('next'), { button: 1 }), none);
});

test('on a slide, a link isn\'t followed: the deck shouldn\'t give way to another file', () => {
  const p = showing('[next](next.md)', { deck: true });
  assert.deepEqual(click(p, p.link('next')).followed, []);
});

test('the document is the frame\'s main part, and its title the frame\'s', () => {
  const { document, show } = preview();
  assert.equal(document.title, 'Rendered document');
  const out = render('---\ntitle: Notes on things\n---\n\nHello\n');
  show(out.body, { title: out.title });
  assert.equal(document.title, 'Notes on things');
  assert.equal(document.querySelector('.gm-doc').getAttribute('role'), 'main');
  show(render('Hi\n').body);
  assert.equal(document.title, 'Rendered document');
});

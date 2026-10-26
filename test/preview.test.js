import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';
import { slides } from '../src/slides.js';
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

test('on a slide, Tab goes round its boxes and back out to the deck, and Space on one is the box\'s', () => {
  const { document, window, show, send, posted } = preview();
  show(render('* [ ] one\n* [ ] two\n').body, { deck: true });
  const boxes = [...document.querySelectorAll('.task-box')];
  const press = (key, keys = {}) => {
    const e = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...keys });
    (document.activeElement ?? document.body).dispatchEvent(e);
    return e.defaultPrevented;
  };
  const sent = () => posted.splice(0).filter((m) => m.type === 'key' || m.type === 'untab').map((m) => m.key ?? m.type);
  send({ type: 'tab', back: false });
  assert.equal(document.activeElement, boxes[0]);
  assert.equal(press('Tab'), true);
  assert.equal(document.activeElement, boxes[1]);
  press(' ');
  assert.deepEqual(sent(), [], 'Space works the box, and doesn\'t go up to the deck');
  press('n');
  assert.deepEqual(sent(), ['n']);
  press('Tab');
  assert.deepEqual(sent(), ['untab']);
  send({ type: 'tab', back: true });
  assert.equal(document.activeElement, boxes[1]);
  press('Tab', { shiftKey: true });
  assert.equal(document.activeElement, boxes[0]);
});

/** A slide of `markdown` being presented, and the keys it sends up to the deck. */
function presenting(markdown) {
  const p = preview();
  p.show(slides(`${markdown}\n---\n\n# Next\n`).slides[0].body, { deck: true });
  const press = (key) => {
    const e = new p.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (p.document.activeElement ?? p.document.body).dispatchEvent(e);
    return e.defaultPrevented;
  };
  const sent = () => p.posted.splice(0).filter((m) => m.type === 'key' || m.type === 'untab').map((m) => m.key ?? m.type);
  return { ...p, press, sent };
}

test('on a slide, Tab passes over a blank, which can\'t be filled in there, and a box keeps only Space from the deck', () => {
  const { document, send, press, sent } = presenting('# One\n\nFill in: [@ answer here:]\n\n- [ ] A box\n');
  send({ type: 'tab', back: false });
  assert.ok(document.activeElement === document.querySelector('.task-box'), 'Tab reaches the box, not the blank');
  press(' ');
  assert.deepEqual(sent(), [], 'Space ticks the box');
  assert.equal(press('ArrowRight'), true);
  press('Enter');
  assert.deepEqual(sent(), ['ArrowRight', 'Enter'], 'the box doesn\'t use them: they move the deck');
  press('Tab');
  assert.deepEqual(sent(), ['untab']);
});

test('on a slide, a choice keeps Space and the arrows from the deck, a link Enter, and anything else the keys it takes', () => {
  const { document, press, sent } = presenting('# One\n\n@ Session: ( ) Sat AM ( ) Sat PM\n\n[a link](https://example.com)\n');
  document.querySelector('.choice-box').focus();
  press(' ');
  press('ArrowDown');
  press('Enter');
  assert.deepEqual(sent(), ['Enter']);
  document.querySelector('a').focus();
  press('Enter');
  press('ArrowRight');
  assert.deepEqual(sent(), ['ArrowRight']);
  // Something else Tab reaches, as a puzzle is, that takes ← and not →.
  const mine = document.createElement('span');
  mine.tabIndex = 0;
  document.querySelector('.gm-doc').append(mine);
  mine.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') e.preventDefault(); });
  mine.focus();
  press('ArrowLeft');
  press('ArrowRight');
  assert.deepEqual(sent(), ['ArrowRight']);
});

test('a slide with nothing to Tab to gives the keyboard straight back to the deck', () => {
  const { show, send, posted } = preview();
  show(render('Just words.\n').body, { deck: true });
  send({ type: 'tab', back: false });
  assert.deepEqual(posted.filter((m) => m.type === 'untab').length, 1);
});

test('the box that had the keyboard has it again once a render replaces it', () => {
  const { document, show } = preview();
  const md = '* [ ] one\n* [ ] two\n';
  show(render(md).body);
  document.querySelectorAll('.task-box')[1].focus();
  show(render(md.replace('[ ] two', '[x] two')).body);
  assert.equal(document.activeElement, document.querySelectorAll('.task-box')[1]);
});

test('the keyboard comes back to the box it left, once the edit that took it is made', () => {
  const { window, document, show, send } = preview();
  const md = '* [ ] one\n* [ ] two\n';
  show(render(md).body);
  const box = document.querySelectorAll('.task-box')[1];
  box.focus();
  // Ticking it takes the keyboard out of the frame, to the editor.
  leave(window, box);
  show(render(md.replace('[ ] two', '[x] two')).body);
  assert.equal(document.activeElement, document.body);
  send({ type: 'refocus' });
  assert.equal(document.activeElement, document.querySelectorAll('.task-box')[1]);
});

/** Takes the keyboard from `node` out of the frame altogether, as to the editor. */
function leave(window, node) {
  node.blur();
  window.dispatchEvent(new window.Event('blur'));
}

test('a box left by a click on the page isn\'t given the keyboard back', async () => {
  const { window, document, show, send } = preview();
  show(render('* [ ] one\n\nSome text.\n').body);
  const box = document.querySelector('.task-box');
  box.focus();
  // A click on the text: the keyboard is on the page, still in the frame.
  box.blur();
  await new Promise((r) => window.setTimeout(r));
  // Then a step ticked with x takes it from the page to the editor, and back.
  window.dispatchEvent(new window.Event('blur'));
  send({ type: 'refocus' });
  // (Not assert.equal: a failure would print the whole box.)
  assert.ok(document.activeElement === document.body, 'the keyboard stays on the page');
});

test('a box the keyboard left the frame from is forgotten once it\'s back in the frame', () => {
  const { window, document, show, send } = preview();
  show(render('* [ ] one\n* [ ] two\n').body);
  const [one, two] = document.querySelectorAll('.task-box');
  one.focus();
  leave(window, one);
  two.focus();
  two.blur();
  send({ type: 'refocus' });
  // (Not assert.equal: a failure would print the whole box.)
  assert.ok(document.activeElement === document.body, 'the keyboard stays on the page');
});

test('a blank written into a definition is gone, and Enter on it opens nothing after it', () => {
  const { window, document, show } = preview();
  const md = '# Words\n\n!Foo:\n!Bar:\n\n- [ ] A box\n';
  show(render(md).body);
  document.querySelector('.def-blank .field-value').focus();
  const input = document.activeElement;
  input.value = 'a thing';
  input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  // The meaning is written, and the file's new text brings a render.
  show(render(md.replace('!Foo:', '!Foo: a thing')).body);
  assert.equal(document.querySelectorAll('textarea').length, 0, 'no blank is open');
  // (Not assert.equal: a failure would print the whole blank.)
  assert.ok(document.activeElement === document.body, 'the keyboard stays on the page');
});

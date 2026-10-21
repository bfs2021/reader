import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slides } from '../src/slides.js';
import { app, globals } from './dom.js';

// deck.js is the app's, for the browser: it's loaded here on the app's page.
const window = globals(app());
const read = (html) => new window.DOMParser().parseFromString(html, 'text/html').body;

const { deck } = await import('../static/app/state.js');
const { paging, steps, deckKey } = await import('../static/app/deck.js');

/** Each thing a slide's steps show, by the step it shows with: [step, its text]. */
function stepped(body) {
  const out = steps(body);
  const shown = [...read(out.body).querySelectorAll('[data-step]')].map((e) => [Number(e.getAttribute('data-step')), e.textContent.trim().replace(/\s+/g, ' ')]);
  return { steps: out.steps, shown };
}

/** The body of each slide of `src`, as the server sends them. */
const bodies = (src) => slides(src).slides.map((s) => s.body);

test('the count reads as the front matter\'s paging says, or n / total', () => {
  deck.slides = [{}, {}, {}];
  deck.meta = {};
  assert.equal(paging(0), '1 / 3');
  assert.equal(paging(2), '3 / 3');
  deck.meta = { paging: 'Slide %d of %d' };
  assert.equal(paging(1), 'Slide 2 of 3');
  // One %d is the slide; any more after it are the total.
  deck.meta = { paging: '%d' };
  assert.equal(paging(1), '2');
  deck.meta = { paging: '%d/%d (%d)' };
  assert.equal(paging(0), '1/3 (3)');
  // Without a %d it isn't a count, and the usual one stands.
  deck.meta = { paging: 'page' };
  assert.equal(paging(1), '2 / 3');
});

test('? shows the deck\'s keys at its foot, and puts them away again', () => {
  const stage = window.document.getElementById('deck');
  assert.match(stage.querySelector('.deck-keys').textContent, /\? these keys/);
  assert.equal(deckKey({ key: '?' }), true);
  assert.ok(stage.classList.contains('keys-shown'));
  deckKey({ key: '?' });
  assert.ok(!stage.classList.contains('keys-shown'));
});

test('each block is a step, and so is each list item and each column; the title isn\'t', () => {
  const [first, second] = bodies('# Title\n\nA paragraph.\n\n- one\n- two\n\n> a quote\n\n---\n\n::: columns\nleft\n+++\nright\n:::\n');
  assert.deepEqual(stepped(first), { steps: 4, shown: [[1, 'A paragraph.'], [2, 'one'], [3, 'two'], [4, 'a quote']] });
  assert.deepEqual(stepped(second), { steps: 2, shown: [[1, 'left'], [2, 'right']] });
});

test('a slide that\'s only a title has no steps', () => {
  assert.deepEqual(stepped(bodies('# Only a title\n')[0]), { steps: 0, shown: [] });
});

test('an opening heading the server left in place shows with the slide; a later one is a step', () => {
  const body = '<section class="gm-pair"><div class="gm-speaker"><h1>Title</h1><p>a</p><h2>Later</h2></div><div></div></section>';
  assert.deepEqual(stepped(body), { steps: 2, shown: [[1, 'a'], [2, 'Later']] });
  // Not at the opening, a heading is a step like any other block.
  assert.deepEqual(stepped(bodies('First\n\n## A heading\n')[0]).shown, [[1, 'First'], [2, 'A heading']]);
});

test('a fence written {1-3|5} takes a step more for each range after its first', () => {
  const [body] = bodies('# Code\n\n```js {1|2|3}\na\nb\nc\n```\n\nafter\n');
  assert.deepEqual(stepped(body), { steps: 4, shown: [[1, 'a b c'], [4, 'after']] });
});

test('of versions of a fence in tabs, the one that moves through the most sets the steps', () => {
  const [body] = bodies('# Code\n\n::: tabs\n+++ Java\n```java {1|2|3}\na\nb\nc\n```\n+++ Kotlin\n```kotlin {1|2}\na\nb\n```\n:::\n\nafter\n');
  const { steps: n, shown } = stepped(body);
  assert.equal(n, 4);
  assert.deepEqual(shown.map(([k]) => k), [1, 4]);
});

test('an aside appears with the last step of the passage it sits beside', () => {
  const [body] = bodies('# Title\n\nFirst.\n\n- one\n- two\n~ about two\n\nLast.\n');
  const { steps: n, shown } = stepped(body);
  assert.equal(n, 4);
  assert.deepEqual(shown.find(([, text]) => text.includes('about two')), [3, '~about two']);
});

test('an aside beside a passage with no steps of its own gets none', () => {
  const body = '<header class="slide-title"><h1>T</h1></header><section class="gm-pair"><div class="gm-speaker"></div><div class="gm-asides"><p>aside</p></div></section>';
  assert.deepEqual(stepped(body), { steps: 0, shown: [] });
});

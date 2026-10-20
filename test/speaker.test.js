import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const SCRIPT = fs.readFileSync(new URL('../static/speaker.js', import.meta.url), 'utf8');

/** Just enough of an element for the speaker view to write into. */
class Element {
  constructor() {
    Object.assign(this, { hidden: false, className: '', textContent: '', innerHTML: '', style: {}, nodes: [] });
    this.classList = { toggle() {} };
    this.contentWindow = { postMessage() {} };
  }
  addEventListener() {}
  replaceChildren(...nodes) { this.nodes = nodes; }
  append(...nodes) { this.nodes.push(...nodes); }
  /** What it says, as a reader would see it. */
  get said() { return this.nodes.map((n) => (typeof n === 'string' ? n : n.textContent)).join(''); }
}

/**
 * The speaker view, loaded as speaker.html loads it, on a clock that reads
 * `now.seconds`: `say` sends it a message from the deck, as the
 * BroadcastChannel would.
 */
function speaker() {
  const now = { seconds: 0 };
  const elements = {};
  let heard = null;
  const context = {
    document: {
      getElementById: (id) => (elements[id] ??= new Element()),
      createElement: () => new Element(),
      querySelectorAll: () => [],
    },
    window: { addEventListener() {} },
    BroadcastChannel: class {
      addEventListener(type, fn) { heard = fn; }
      postMessage() {}
    },
    Date: class {
      static now() { return now.seconds * 1000; }
      toLocaleTimeString() { return '9:00'; }
    },
    setInterval() {},
  };
  vm.runInNewContext(SCRIPT, context);
  return { now, elements, clock: context.clock, say: (data) => heard({ data }) };
}

test('the timer reads minutes and seconds, and hours once there are some', () => {
  const { clock } = speaker();
  assert.equal(clock(0), '0:00');
  assert.equal(clock(5), '0:05');
  assert.equal(clock(59.6), '1:00');
  assert.equal(clock(754), '12:34');
  assert.equal(clock(3600), '1:00:00');
  assert.equal(clock(3725), '1:02:05');
  assert.equal(clock(36000 + 59), '10:00:59');
});

test('the timer starts when the deck opens on its first slide, and counts from there', () => {
  const { now, elements, say } = speaker();
  now.seconds = 1000;
  say({ type: 'deck', open: true, index: 0, reveal: 0, slides: [{}, {}], meta: {} });
  now.seconds = 1075;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal(elements.timer.textContent, '1:15');
  // Picked up on a later slide, it's the same talk.
  say({ type: 'deck', open: false, index: 1, reveal: 0, slides: [{}, {}], meta: {} });
  say({ type: 'deck', open: true, index: 1, reveal: 0, slides: [{}, {}], meta: {} });
  now.seconds = 1080;
  say({ type: 'go', index: 1, reveal: 0 });
  assert.equal(elements.timer.textContent, '1:20');
});

// Three slides planned to start at 0:00 (a checkpoint), 2:00 and 5:00,
// the talk to end at 6:00.
const PLANNED = [{ plan: 0, at: 0 }, { plan: 120 }, { plan: 300 }];

/** What the pace says on slide `index` at `seconds` into the talk. */
function paced(slides, index, seconds, end = null) {
  const { now, elements, say } = speaker();
  say({ type: 'deck', open: true, index: 0, reveal: 0, slides, meta: {}, end });
  now.seconds = seconds;
  say({ type: 'go', index, reveal: 0 });
  const pace = elements.pace;
  return pace.hidden ? null : { state: pace.className, says: pace.said };
}

test('on a slide between its start and the next one\'s, give or take half a minute, the talk is on plan', () => {
  assert.deepEqual(paced(PLANNED, 0, 10, 360), { state: 'pace on', says: 'on plan · checkpoint 0:00–2:00' });
  assert.deepEqual(paced(PLANNED, 1, 90, 360), { state: 'pace on', says: 'on plan · plan 2:00–5:00' });
  assert.deepEqual(paced(PLANNED, 1, 330, 360), { state: 'pace on', says: 'on plan · plan 2:00–5:00' });
});

test('before a slide\'s start it\'s ahead, and after the next one\'s behind, then late two minutes on', () => {
  assert.deepEqual(paced(PLANNED, 1, 89, 360), { state: 'pace ahead', says: '0:31 ahead · plan 2:00–5:00' });
  assert.deepEqual(paced(PLANNED, 1, 331, 360), { state: 'pace behind', says: '0:31 behind · plan 2:00–5:00' });
  assert.deepEqual(paced(PLANNED, 1, 420, 360), { state: 'pace behind', says: '2:00 behind · plan 2:00–5:00' });
  assert.deepEqual(paced(PLANNED, 1, 421, 360), { state: 'pace late', says: '2:01 behind · plan 2:00–5:00' });
});

test('the last slide runs to the talk\'s end, or, with none, is never behind', () => {
  assert.deepEqual(paced(PLANNED, 2, 400, 360), { state: 'pace behind', says: '0:40 behind · plan 5:00–6:00' });
  assert.deepEqual(paced(PLANNED, 2, 4000), { state: 'pace on', says: 'on plan · plan 5:00' });
});

test('a slide with no plan has no pace, and one planned no later than the next shows only its start', () => {
  assert.equal(paced([{}, {}], 0, 10), null);
  assert.equal(paced([{ plan: 0 }, {}], 1, 10), null);
  assert.deepEqual(paced([{ plan: 60, at: 60 }, { plan: 60 }], 0, 70), { state: 'pace on', says: 'on plan · checkpoint 1:00' });
});

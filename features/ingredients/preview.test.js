import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { preview } from '../../test/dom.js';

const RECIPE = [
  '---', 'multibox:', '  stages: have, prepped, used', '---', '',
  '## Akara', '',
  '### Ingredients',
  '* [x][ ][ ] count:1 small yellow !onion, diced',
  '* [ ] a handful of fresh !cilantro, chopped',
  '* [ ] count:2 cups !peas',
  '',
  '### Steps',
  '1) [ ] Fry the onion.',
  '2) [ ] Add the cilantro and the onion.',
].join('\n');

/** Ticks step `n` of RECIPE, as shown: what it asked to be written, as lines [from, after]. */
function ticking(p, n) {
  p.posted.length = 0;
  p.document.querySelectorAll('li.step > .task-box')[n - 1].click();
  return p.posted.filter((m) => m.type === 'edit').map((m) => m.edits.map((e) => [e.from, e.after[0]]));
}

test('an ingredient isn\'t used until the last step that names it is done', () => {
  const p = preview();
  p.show(render(RECIPE).body);
  assert.deepEqual(ticking(p, 1), [[[13, '1) [x] Fry the onion.']]]);
  assert.equal(p.document.querySelector('.stage-box').dataset.stage, '1');
});

test('the last step to name an ingredient marks it used in the same edit: a staged box filled, a plain one ticked', () => {
  const p = preview();
  p.show(render(RECIPE).body);
  ticking(p, 1);
  assert.deepEqual(ticking(p, 2), [[
    [14, '2) [x] Add the cilantro and the onion.'],
    [9, '* [x] a handful of fresh !cilantro, chopped'],
    [8, '* [x][x][x] count:1 small yellow !onion, diced'],
  ]]);
  const [staged] = p.document.querySelectorAll('.stage-box');
  const [cilantro, peas] = p.document.querySelectorAll('li.ingredient .task-box');
  assert.equal(staged.dataset.stage, '3');
  assert.deepEqual([cilantro.checked, peas.checked], [true, false]);
});

test('a step done out of order leaves what a step still to do names', () => {
  const p = preview();
  p.show(render(RECIPE).body);
  assert.deepEqual(ticking(p, 2), [[
    [14, '2) [x] Add the cilantro and the onion.'],
    [9, '* [x] a handful of fresh !cilantro, chopped'],
  ]]);
});

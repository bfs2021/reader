import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { preview } from '../../test/dom.js';

const STEPS = '## Soup\n\n1) [ ] Chop.\n2) [ ] Fry.\n3) [ ] Simmer.\n\n@ Notes: x\n';

/** The preview showing STEPS: `press` presses a key in the page, `lit` is the step lit, from 1. */
function page(m = {}) {
  const p = preview();
  p.show(render(STEPS).body, m);
  const steps = () => [...p.document.querySelectorAll('li.step')];
  const press = (key, keys = {}, on = p.document.body) => {
    const e = new p.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...keys });
    on.dispatchEvent(e);
    return e.defaultPrevented;
  };
  const lit = () => steps().findIndex((li) => li.classList.contains('step-current')) + 1;
  return { ...p, steps, press, lit };
}

test('j and k light the next step and the one before, from the first, and no further than either end', () => {
  const { press, lit } = page();
  assert.equal(lit(), 0);
  assert.equal(press('j'), true);
  assert.equal(lit(), 1);
  press('j');
  press('j');
  press('j');
  assert.equal(lit(), 3);
  press('k');
  assert.equal(lit(), 2);
  press('k');
  press('k');
  assert.equal(lit(), 1);
});

test('x marks the lit step done, and lights the next not done', () => {
  const { press, lit, steps, posted } = page();
  assert.equal(press('x'), true, 'nothing lit: the key is the steps\', and does nothing');
  assert.deepEqual(posted.filter((m) => m.type === 'edit'), []);
  press('j');
  press('j');
  press('x');
  assert.deepEqual(posted.filter((m) => m.type === 'edit').map((m) => m.edits.map((e) => e.after[0])), [['2) [x] Fry.']]);
  assert.deepEqual(steps().map((li) => li.classList.contains('step-done')), [false, true, false]);
  assert.equal(lit(), 3);
});

test('the keys are left alone with a modifier, while typing, and on a slide', () => {
  const { press, lit, document } = page();
  for (const keys of [{ metaKey: true }, { ctrlKey: true }, { altKey: true }]) assert.equal(press('j', keys), false);
  document.querySelector('.field').click();
  assert.equal(press('j', {}, document.querySelector('.field textarea')), false);
  assert.equal(lit(), 0);
  const deck = page({ deck: true });
  deck.press('j');
  assert.equal(deck.lit(), 0);
});

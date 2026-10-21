import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { preview } from '../../test/dom.js';

/**
 * The preview showing `markdown`: `edits()` is what it has asked to be
 * written since last asked, each ask an array of edits.
 */
function page(markdown) {
  const p = preview();
  // Today, as far as the page knows.
  p.window.Date = class extends Date {
    constructor(...at) { super(...(at.length ? at : [2026, 2, 4, 12])); }
  };
  p.show(render(markdown).body);
  const edits = () => p.posted.splice(0).filter((m) => m.type === 'edit').map((m) => {
    assert.equal(m.undo, true, 'an edit the editor can undo');
    return m.edits.map((e) => [e.from, e.before.join('\n'), e.after.join('\n')]);
  });
  const $ = (sel) => p.document.querySelector(sel);
  const $$ = (sel) => [...p.document.querySelectorAll(sel)];
  const click = (node, keys = {}) => node.dispatchEvent(new p.window.MouseEvent('click', { bubbles: true, cancelable: true, ...keys }));
  edits();
  return { ...p, edits, $, $$, click };
}

const STAGED = '---\nmultibox:\n  stages: have, prepped, used\n---\n\n* [x][ ][ ] onion\n';

test('a click on a staged box fills its next stage, and on a full one empties it', () => {
  const { $, click, edits } = page(STAGED);
  const box = $('.stage-box');
  click(box);
  assert.deepEqual(edits(), [[[5, '* [x][ ][ ] onion', '* [x][x][ ] onion']]]);
  assert.equal(box.dataset.stage, '2');
  assert.equal(box.getAttribute('aria-checked'), 'mixed');
  assert.deepEqual([...box.children].map((pip) => pip.classList.contains('on')), [true, true, false]);
  click(box);
  assert.deepEqual(edits(), [[[5, '* [x][x][ ] onion', '* [x][x][x] onion']]]);
  assert.equal(box.getAttribute('aria-checked'), 'true');
  click(box);
  assert.deepEqual(edits(), [[[5, '* [x][x][x] onion', '* [ ][ ][ ] onion']]]);
  assert.equal(box.getAttribute('aria-checked'), 'false');
});

test('a shift-click on a staged box goes back a stage, and does nothing on an empty one', () => {
  const { $, click, edits } = page(STAGED);
  const box = $('.stage-box');
  click(box, { shiftKey: true });
  assert.deepEqual(edits(), [[[5, '* [x][ ][ ] onion', '* [ ][ ][ ] onion']]]);
  click(box, { shiftKey: true });
  assert.deepEqual(edits(), []);
  assert.equal(box.dataset.stage, '0');
});

test('Start over clears every box in its section, plain, staged or a choice, as one edit', () => {
  const { $, $$, click, edits } = page([
    '## Akara', 'reset:[]', '',
    '* [x] peas', '* [ ] chili', '* [x][x][ ] onion', '',
    '- ( ) small', '- (x) large', '',
    '## Next', '* [x] stays',
  ].join('\n'));
  click($('.task-reset'));
  assert.deepEqual(edits(), [[
    [3, '* [x] peas', '* [ ] peas'],
    [8, '- (x) large', '- ( ) large'],
    [5, '* [x][x][ ] onion', '* [ ][ ][ ] onion'],
  ]]);
  assert.deepEqual($$('input').map((b) => b.checked), [false, false, false, false, true]);
  assert.equal($('.stage-box').dataset.stage, '0');
  // Nothing left to clear, nothing to write.
  click($('.task-reset'));
  assert.deepEqual(edits(), []);
});

const LOGGED = [
  '## Akara', 'Serves count:4', 'multiplier:[]', 'reset:[]', '',
  '### Log', '#### date:2026-10-18[]', 'Good (Ana): fine', '',
  '## Next',
].join('\n');

test('Log today adds a heading for today after the log\'s last entry, with the multiple the recipe is at', () => {
  const { $, $$, click, edits } = page(LOGGED);
  click($('.task-log'));
  assert.deepEqual(edits(), [[[8, '', '\n#### date:2026-03-04[]']]]);
  click($$('.multiply').find((b) => b.textContent === '2×'));
  edits();
  click($('.task-log'));
  assert.deepEqual(edits(), [[[8, '', '\n#### date:2026-03-04[] · 2×']]]);
  // Back at 1×, it's as written.
  click($$('.multiply').find((b) => b.textContent === '1×'));
  edits();
  click($('.task-log'));
  assert.deepEqual(edits(), [[[8, '', '\n#### date:2026-03-04[]']]]);
});

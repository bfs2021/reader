import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { frame, run } from '../../test/dom.js';

/**
 * The fields of `markdown` as rendered, in a page with preview.js loaded:
 * `fill(i, value)` types `value` into the i-th and clicks away, and
 * `edits` is what it asked to be written.
 */
function page(markdown) {
  const { window, document, posted } = frame(render(markdown).body);
  run(window, 'static/preview-api.js', 'features/fields/preview.js');
  const fields = [...document.querySelectorAll('.field')];
  // What it asked to be written, as it went up to the page around it.
  const edits = [];
  const heard = () => edits.splice(0, Infinity, ...posted.filter((m) => m.type === 'edit').flatMap((m) => m.edits));

  const open = (i) => {
    fields[i].click();
    return fields[i].querySelector('.field-value textarea');
  };
  const fill = (i, value) => {
    const input = open(i);
    input.value = value;
    input.blur();
    heard();
  };
  const press = (input, key) => {
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    heard();
  };
  return { fields, edits, open, fill, press };
}

const lines = (edits) => edits.map((e) => e.after[0]);

test('a field on a line of its own is written with its value after its colons', () => {
  const { edits, fill } = page('@ Name: Josh\n\n@ Notes ::: it went\n');
  fill(0, 'Ann');
  fill(1, 'it went well');
  assert.deepEqual(edits, [
    { from: 0, to: 1, before: ['@ Name: Josh'], after: ['@ Name: Ann'] },
    { from: 2, to: 3, before: ['@ Notes ::: it went'], after: ['@ Notes ::: it went well'] },
  ]);
});

test('a field emptied is written as only its label and colons', () => {
  const { edits, fill } = page('@ Name: Josh\n');
  fill(0, '');
  assert.deepEqual(lines(edits), ['@ Name:']);
});

test('a field filled is written again from what it was last written as', () => {
  const { edits, fill } = page('@ Name: Josh\n');
  fill(0, 'Ann');
  fill(0, 'Bea');
  assert.deepEqual(edits.map((e) => [e.before[0], e.after[0]]), [['@ Name: Josh', '@ Name: Ann'], ['@ Name: Ann', '@ Name: Bea']]);
});

test('what\'s typed is written on one line, and nothing is written when it\'s the same', () => {
  const { edits, fill } = page('@ Name: Josh\n');
  fill(0, '  Josh  ');
  assert.deepEqual(edits, []);
  fill(0, ' two\n  lines ');
  assert.deepEqual(lines(edits), ['@ Name: two lines']);
});

test('Esc puts a field back as it was, and writes nothing', () => {
  const { fields, edits, open, press } = page('@ Name: Josh\n');
  const input = open(0);
  input.value = 'Ann';
  press(input, 'Escape');
  assert.deepEqual(edits, []);
  assert.equal(fields[0].querySelector('.field-value').textContent, 'Josh');
});

test('a field in a sentence is written into its place, and the ones after it move along', () => {
  const { fields, edits, fill } = page('I am [@ name: Josh] and [@ age:] years, from [@ city: x].\n');
  fill(0, 'Joshua');
  fill(2, 'Provo');
  fill(1, '40');
  fill(0, '');
  assert.deepEqual(lines(edits), [
    'I am [@ name: Joshua] and [@ age:] years, from [@ city: x].',
    'I am [@ name: Joshua] and [@ age:] years, from [@ city: Provo].',
    'I am [@ name: Joshua] and [@ age: 40] years, from [@ city: Provo].',
    'I am [@ name] and [@ age: 40] years, from [@ city: Provo].',
  ]);
  // Each knows where it is on the line as now written.
  const now = edits.at(-1).after[0];
  for (const f of fields) {
    assert.equal(f.dataset.text, now);
    assert.match(now.slice(Number(f.dataset.start), Number(f.dataset.end)), /^\[@ \w+(: [^\]]+)?\]$/);
  }
});

test('in a sentence, brackets typed go round, so as not to end the field', () => {
  const { edits, fill } = page('Say [@ what: x] now.\n');
  fill(0, 'a [b] c');
  assert.deepEqual(lines(edits), ['Say [@ what: a (b) c] now.']);
});

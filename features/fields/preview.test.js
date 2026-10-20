import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'node-html-parser';
import { render } from '../../src/render.js';

const SCRIPT = fs.readFileSync(new URL('./preview.js', import.meta.url), 'utf8');

/** Just enough of an element for preview.js: its data, its children, its listeners. */
class Element {
  constructor(tag, { dataset = {}, text = '', children = [] } = {}) {
    Object.assign(this, { tagName: tag.toUpperCase(), dataset, text, children, listeners: {}, style: {} });
  }
  get textContent() { return this.text; }
  set textContent(text) {
    this.text = text;
    this.children = [];
  }
  querySelector(sel) {
    if (sel === 'textarea') return this.children.find((c) => c instanceof TextArea) ?? null;
    return this.children.find((c) => c.className === sel.slice(1)) ?? null;
  }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  setAttribute() {}
  closest() { return this; }
}

class TextArea extends Element {
  constructor() {
    super('textarea');
    this.value = '';
    this.scrollHeight = 20;
  }
  focus() {}
  setSelectionRange(start, end) { Object.assign(this, { selectionStart: start, selectionEnd: end }); }
}

const camel = (name) => name.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase());

/**
 * The fields of `markdown` as rendered, in a page with preview.js loaded:
 * `fill(i, value)` types `value` into the i-th and clicks away, and
 * `edits` is what it asked to be written.
 */
function page(markdown) {
  const fields = parse(render(markdown).body).querySelectorAll('.field').map((f) => {
    const dataset = Object.fromEntries(Object.entries(f.attributes).filter(([k]) => k.startsWith('data-')).map(([k, v]) => [camel(k), v]));
    const part = (cls) => f.querySelector(`.${cls}`);
    const label = Object.assign(new Element('span', { text: part('field-label').text }), { className: 'field-label' });
    const value = Object.assign(new Element('span', { dataset: { value: part('field-value').getAttribute('data-value') } }), { className: 'field-value' });
    return new Element('span', { dataset, children: [label, value] });
  });
  const listeners = {};
  const document = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    createElement: () => new TextArea(),
    querySelectorAll(sel) {
      const line = /data-line="(\d+)"\]\[data-start\]$/.exec(sel)?.[1];
      if (line) return fields.filter((f) => f.dataset.line === line && f.dataset.start !== undefined);
      if (sel === '.field:not([data-choices])') return fields.filter((f) => f.dataset.choices === undefined);
      return fields;
    },
  };
  const edits = [];
  // Made in the script's own context, so kept as plain values.
  const Preview = { deck: false, register() {}, edit: (changes) => edits.push(...JSON.parse(JSON.stringify(changes))) };
  vm.runInNewContext(SCRIPT, { document, Preview, HTMLTextAreaElement: TextArea });

  const open = (i) => {
    listeners.click({ target: fields[i] });
    return fields[i].querySelector('.field-value').querySelector('textarea');
  };
  const fill = (i, value) => {
    const input = open(i);
    input.value = value;
    input.listeners.blur();
  };
  return { fields, edits, open, fill };
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
  const { fields, edits, open } = page('@ Name: Josh\n');
  const input = open(0);
  input.value = 'Ann';
  input.listeners.keydown({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(edits, []);
  assert.equal(fields[0].children[1].textContent, 'Josh');
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

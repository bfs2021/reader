import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('@ lines become form fields that know their line and value', () => {
  const { body } = render('# Form\n\n@ My Name: Josh\n@ Date:\n@ Time: 10:30 -> *noon* <b>\n');
  assert.match(body, /<span class="field" data-line="2" data-text="@ My Name: Josh" data-head="@ My Name:"><span class="field-label">My Name<\/span><span class="field-value" data-value="Josh">Josh<\/span><\/span>/);
  assert.match(body, /data-line="3" data-text="@ Date:" data-head="@ Date:"><span class="field-label">Date<\/span><span class="field-value" data-value=""><\/span>/);
  assert.match(body, /data-value="10:30 -&gt; \*noon\* &lt;b&gt;">10:30 -&gt; \*noon\* &lt;b&gt;</);
});

test('@ lines with more colons are that many lines tall', () => {
  const { body } = render('@ Notes ::: it went well\n@ Bio::\n@ Name: Josh\n');
  assert.match(body, /<span class="field" data-line="0" data-text="@ Notes ::: it went well" data-head="@ Notes :::" data-lines="3" style="--lines: 3"><span class="field-label">Notes<\/span><span class="field-value" data-value="it went well">/);
  assert.match(body, /data-line="1" [^>]* data-lines="2" style="--lines: 2"><span class="field-label">Bio<\/span><span class="field-value" data-value="">/);
  assert.match(body, /<span class="field" data-line="2" [^>]*><span class="field-label">Name</);
});

test('@ lines in code, indented, without a label or mid-sentence are left as typed', () => {
  const { body } = render('```\n@ No: code\n```\n\nhello @ there: x\n\n @ Indented: x\n\n@ : empty\n\n@mention: hi\n');
  assert.doesNotMatch(body, /class="field"/);
  assert.match(body, /@ No: code/);
  assert.match(body, /hello @ there: x/);
  assert.match(body, /@mention: hi/);
});

test('a field carried into an aside keeps its line', () => {
  const { body } = render('~ a thought\n@ Name: x\n', { line: 3 });
  assert.match(body, /gm-aside-cell[\s\S]*<span class="field" data-line="4" data-text="@ Name: x" data-head="@ Name:">/);
});

test('a field in a ::: block is styled with it', () => {
  const { body } = render('::: red\n@ Name: x\n:::\n');
  assert.match(body, /<p style="color: red"><span class="field" data-line="1" /);
});

test('a field of ( ) choices is radio buttons in a row, each knowing its line with only it picked', () => {
  const { body } = render('@ Session: ( ) Sat AM  (x) Sat PM ( ) Sun (late)\n');
  assert.match(body, /<span class="field" data-line="0" data-text="@ Session: \( \) Sat AM {2}\(x\) Sat PM \( \) Sun \(late\)" data-head="@ Session:" data-choices><span class="field-label">Session<\/span><span class="field-choices">/);
  const radios = [...body.matchAll(/<label class="field-choice"><input type="radio" class="choice-box" name="field-0" data-on="([^"]*)"( checked)?> ([^<]*)<\/label>/g)]
    .map(([, on, checked, label]) => ({ on, checked: Boolean(checked), label }));
  assert.deepEqual(radios, [
    { on: '@ Session: (x) Sat AM  ( ) Sat PM ( ) Sun (late)', checked: false, label: 'Sat AM' },
    { on: '@ Session: ( ) Sat AM  (x) Sat PM ( ) Sun (late)', checked: true, label: 'Sat PM' },
    { on: '@ Session: ( ) Sat AM  ( ) Sat PM (x) Sun (late)', checked: false, label: 'Sun (late)' },
  ]);
});

test('a value that is only partly choices is written in, as typed', () => {
  for (const value of ['before ( ) A ( ) B', '( ) A ( )', '(y) A']) {
    const { body } = render(`@ Pick: ${value}\n`);
    assert.doesNotMatch(body, /field-choices/, value);
    assert.match(body, /class="field-value"/, value);
  }
});

test('[@ ] in a sentence is a blank there, knowing where it is on its line', () => {
  const line = 'I am from a [@ an item from childhood] and [@ a product: Tang].';
  const { body } = render(`# Me\n\n${line}\n`);
  const text = 'data-text="I am from a [@ an item from childhood] and [@ a product: Tang]."';
  assert.match(body, new RegExp(`<p>I am from a <span class="field field-inline" data-line="2" ${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} data-head="\\[@ an item from childhood" data-start="12" data-end="38"><span class="field-value" data-value=""></span><span class="field-label">an item from childhood</span></span> and `));
  assert.match(body, /data-head="\[@ a product" data-start="43" data-end="62"><span class="field-value" data-value="Tang">Tang<\/span><span class="field-label">a product<\/span><\/span>\.<\/p>/);
});

test('[@ ] lines keep their breaks, and a link, code, an escape or an @ line are left as they are', () => {
  const { body } = render('A [@ one]\nB [@ two]\n\n[@ text](x) `[@ code]` \\[@ kept]\n\n@ Name: [@ x]\n');
  assert.match(body, /<p>A <span class="field field-inline"[^]*?<\/span><\/span>\nB <span class="field field-inline"/);
  assert.match(body, /<a href="x">@ text<\/a> <code>\[@ code\]<\/code> \[@ kept\]/);
  assert.match(body, /<span class="field" data-line="5" [^>]*><span class="field-label">Name<\/span><span class="field-value" data-value="\[@ x\]">/);
});

test('the stylesheet comes with the feature', () => {
  assert.match(render('@ A: b\n').css, /\.field \{/);
});

test('a > in a field stays out of the tags it is written into', () => {
  const { body } = render('@ N"><svg>: v\n\nA [@ x"><b>: y].\n');
  for (const [tag] of body.matchAll(/<span [^>]*>/g)) assert.doesNotMatch(tag.slice(1, -1), /[<>]/, tag);
  assert.match(body, /data-text="@ N&quot;&gt;&lt;svg&gt;: v"/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';

test('an image alone in a paragraph is a captioned figure', () => {
  const { body } = render('![a cat](cat.jpg "Ginger, 2019")\n\n![a dog](dog.png)\n\nsee ![x](x.png) inline\n');
  assert.match(body, /<figure><img src="cat\.jpg" alt="a cat" title="Ginger, 2019"><figcaption>Ginger, 2019<\/figcaption><\/figure>/);
  assert.match(body, /<figure><img src="dog\.png" alt="a dog"><figcaption>a dog<\/figcaption><\/figure>/);
  assert.match(body, /<p>see <img src="x\.png" alt="x"> inline<\/p>/);
});

test('tables render', () => {
  const { body } = render('| a | b |\n|---|:-:|\n| 1 | 2 |\n');
  assert.match(body, /<table>\n<thead>\n<tr>\n<th>a<\/th>\n<th style="text-align:center">b<\/th>/);
});


test('with lines, each block names the line of the file it came from', () => {
  const src = '-----\ntitle: T\n-----\n# Head\n\n~ an aside\n\npara\n\n- one\n- two\n';
  const { body } = render(src, { lines: true });
  assert.match(body, /<h1 data-line="3">Head<\/h1>/);
  assert.match(body, /<p data-line="7">para<\/p>/);
  assert.match(body, /<ul data-line="9">\n<li data-line="9">one<\/li>\n<li data-line="10">two<\/li>/);
  assert.match(body, /<div class="gm-aside-cell" role="note">\n<p><span class="gm-mark" aria-hidden="true">~<\/span>an aside<\/p>/);
  assert.doesNotMatch(render(src).body, /data-line/);
});

test('with lines, an image alone in a paragraph is still a figure, on its line', () => {
  const { body } = render('para\n\n![a cat](cat.jpg "Ginger")\n', { lines: true });
  assert.match(body, /<figure data-line="2"><img src="cat\.jpg" alt="a cat" title="Ginger"><figcaption>Ginger<\/figcaption><\/figure>/);
});

test('code fenced in a blockquote or a deep list is left as written', () => {
  const code = '[@ what: answer] rfc:9110[] ![](x.png =10x)';
  const shown = '<code>[@ what: answer] rfc:9110[] ![](x.png =10x)\n</code>';
  assert.ok(render(`> \`\`\`\n> ${code}\n> \`\`\`\n`).body.includes(shown));
  assert.ok(render(`- a\n  - b\n    - c\n\n      \`\`\`\n      ${code}\n      \`\`\`\n`).body.includes(shown));
  assert.ok(render(`1. a\n   > ~~~\n   > ${code}\n   > ~~~\n`).body.includes(shown));
});

test('code fenced in a blockquote ends with it', () => {
  const { body } = render('> ```\n> code\n\nrfc:9110[] and ![](x.png =10x)\n');
  assert.match(body, /<a href="https:\/\/www\.rfc-editor\.org\/rfc\/rfc9110\.html">RFC 9110<\/a>/);
  assert.match(body, /<img src="x\.png" alt="" style="width: 10px">/);
});

test('a document opening with a --- rule has no front matter', () => {
  const { body, title } = render('---\n\nA paragraph between rules.\n\n---\n\nmore\n', { file: 'notes.md' });
  assert.equal(title, 'notes');
  assert.match(body, /<hr>\n<p>A paragraph between rules\.<\/p>\n<hr>\n<p>more<\/p>/);
  assert.equal(render('---\ntitle: Kept\n\n---\nbody\n').title, 'Kept');
});

test("a deck's settings stay out of its masthead, and the rest of its front matter shows", () => {
  const { body } = render('---\ntitle: T\nauthor: Josh\ntime: 20m\ntransition: fade\nprint: landscape\ntype: slides\npaging: Slide %d of %d\nvenue: SpringOne\n---\n\n# One\n\n---\n\n# Two\n');
  const byline = /<div class="gm-byline">([\s\S]*?)<\/div>/.exec(body)[1];
  assert.equal(byline, '<span>Josh</span><span>venue: SpringOne</span>');
});

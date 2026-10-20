import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/render.js';

test('rfc: links to the RFC Editor', () => {
  const link = (src) => render(src).body.match(/<p>([\s\S]*?)<\/p>/)[1];
  assert.equal(link('rfc:9110[]'), '<a href="https://www.rfc-editor.org/rfc/rfc9110.html">RFC 9110</a>');
  assert.equal(
    link('rfc:9110#section-15.5[]'),
    '<a href="https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5">RFC 9110 §15.5</a>',
  );
  assert.equal(
    link('rfc:6749#appendix-A[]'),
    '<a href="https://www.rfc-editor.org/rfc/rfc6749.html#appendix-A">RFC 6749 Appendix A</a>',
  );
  assert.equal(link('rfc:6749[OAuth *2.0*]'), '<a href="https://www.rfc-editor.org/rfc/rfc6749.html">OAuth <em>2.0</em></a>');
  for (const src of ['`rfc:9110[]`', 'rfc:9110 alone', 'xrfc:9110[]', '\\rfc:9110[]']) {
    assert.doesNotMatch(render(src).body, /rfc-editor/);
  }
  assert.doesNotMatch(render('```\nrfc:9110[]\n```\n').body, /rfc-editor/);
});

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
  assert.match(body, /<div class="gm-aside-cell">\n<p><span class="gm-mark">~<\/span>an aside<\/p>/);
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

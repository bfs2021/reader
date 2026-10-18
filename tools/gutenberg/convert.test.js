import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from './convert.js';

const page = (body) => `<html><body><header class="pg-boilerplate">*** START ***</header>${body}<footer class="pg-boilerplate">*** END ***</footer></body></html>`;
const book = (more) => ({ slug: 'x/y', title: 'Y', author: 'X', cite: 'chapter.paragraph', kind: 'prose', ...more });
/** The converted text, after its front matter. */
const text = (html, more) => convert(page(html), book(more)).markdown.split('-----\n\n')[1];

test('front matter says what the book is and how it is cited', () => {
  const { markdown } = convert(page('<p>x</p>'), book({ translator: 'T', published: 1800, edition: 'E' }));
  assert.equal(markdown, '-----\ntitle: Y\nauthor: X\ntranslator: T\npublished: 1800\nedition: E\ncite: chapter.paragraph\n-----\n\nx\n');
});

test('from the start to the end, Gutenberg\'s pages, pictures and contents left out', () => {
  const md = text(`<h1>Title page</h1><table><tr><td>Contents</td></tr></table>
    <p><span class="pagenum"><a id="page_1">{1}</a></span></p>
    <h2><a id="Chapter_I"></a><img src="a.jpg">Chapter I.</h2>
    <p class="nind"><span class="letra">I</span>T is a truth, <i>universally</i> acknowledged.</p>
    <div class="figcenter"><img src="b.jpg"><div class="caption"><p>A picture<span class="pagenum">{2}</span></p></div></div>
    <p>Still<span class="pagenum">{3}</span> more.</p>
    <p class="fint">PRINTED BY</p>`, { start: '#Chapter_I', end: '.fint' });
  assert.equal(md, '{p.1}\n\n## Chapter I\n\nIt is a truth, *universally* acknowledged.\n\n{p.2}\n\nStill{p.3} more.\n');
});

test('a start or end can be named by the words a heading starts with, before a contents line that names it too', () => {
  const md = text('<p class="toc"><a>PART 1.</a></p><h2>PART 1.</h2><p>in</p><div><b>Notes</b><p>out</p></div>', { start: 'text:PART 1.', end: 'text:Notes' });
  assert.equal(md, '## PART 1\n\nin\n');
});

test('a play: speeches with their speaker, lines kept, stage directions in italics', () => {
  const md = text(`<p class="scenedesc">Enter <span class="charname">Polonius</span>.</p>
    <p class="drama">POLONIUS.<br>Give him this money,<br>and these notes.<br></p>
    <p class="right">[<i>Exit.</i>]</p>`, { kind: 'play' });
  assert.equal(md, '*Enter Polonius.*\n\n**POLONIUS**\\\nGive him this money,\\\nand these notes.\n\n*[Exit.]*\n');
});

test('verse keeps a line\'s indent, as no-break spaces', () => {
  const md = text('<p class="poem">\nFrom fairest creatures,<br>\nThat thereby beauty,<br>\n    Pity the world.<br>\n</p>', { kind: 'verse' });
  assert.equal(md, 'From fairest creatures,\\\nThat thereby beauty,\\\n    Pity the world.\n');
});

test('a <pre> is a poem: its lines, their indents, a paragraph to each stanza', () => {
  const md = text('<pre>\n     “Which to secure,\n       no skill\n\n     Mote him\n</pre>');
  assert.equal(md, '“Which to secure,\\\n  no skill\n\nMote him\n');
});

test('chapters numbered before their verses, told from verses by counting', () => {
  const md = text(`<p>Ch. 1. 1. The Tao that can be trodden.</p><p>2. Having no name.</p>
    <p>2. 1. All in the world.</p><p>2.</p><pre>A poem</pre><p>3. The next verse, not chapter 3.</p>`, { chapters: 'Chapter' });
  assert.equal(md, [
    '### Chapter 1', '\\1. The Tao that can be trodden.', '\\2. Having no name.',
    '### Chapter 2', '\\1. All in the world.', '\\2. A poem', '\\3. The next verse, not chapter 3.',
  ].join('\n\n') + '\n');
  // One more than the chapter, where the next verse would be one more than the last.
  const one = text('<p>10. 1. A.</p><p>2. B.</p><p>11. The thirty spokes.</p><p>12.</p><p>1.</p><pre>Colour</pre>', { chapters: 'Chapter' });
  assert.equal(one, '### Chapter 10\n\n\\1. A.\n\n\\2. B.\n\n### Chapter 11\n\nThe thirty spokes.\n\n### Chapter 12\n\n\\1. Colour\n');
});

test('verses numbered chapter:verse get a heading where a chapter starts, counted afresh in each book', () => {
  const md = text('<h2>Genesis</h2><p>1:1 In the beginning</p><p>1:2 And the earth</p><p>2:1 Thus</p><h2>Exodus</h2><p>1:1 Now these</p>', { verseChapters: true });
  assert.equal(md, '## Genesis\n\n### Chapter 1\n\n1:1 In the beginning\n\n1:2 And the earth\n\n### Chapter 2\n\n2:1 Thus\n\n## Exodus\n\n### Chapter 1\n\n1:1 Now these\n');
});

test('what reader would read as its own is escaped; brackets only where they\'d start something', () => {
  const md = text('<p>A: not an answer</p><p>~ not an aside</p><p>1. not a list</p><p>*stars* and [Exit.] and [this]{red} and see:[x]</p>');
  assert.equal(md, '\\A: not an answer\n\n\\~ not an aside\n\n\\1. not a list\n\n\\*stars\\* and [Exit.] and [this\\]{red} and see:\\[x]\n');
});

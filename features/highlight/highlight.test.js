import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { parseInfo, splitLines } from './index.js';

const fence = (info, code) => render(`\`\`\`${info}\n${code}\n\`\`\`\n`).body;

test('a fence in a known language is highlighted', () => {
  assert.match(fence('c', 'int x = 1;'), /<pre><code class="hljs language-c"><span class="hljs-type">int<\/span> x = <span class="hljs-number">1<\/span>;\n<\/code><\/pre>/);
  assert.match(fence('bash', 'echo hi'), /<span class="hljs-built_in">echo<\/span>/);
  assert.match(fence('asciidoc', '== Title'), /<code class="hljs language-asciidoc"><span class="hljs-section">== Title<\/span>/);
});

test('an unknown language, or none, is left plain', () => {
  assert.match(fence('nope', '<x> & y'), /<pre><code class="language-nope">&lt;x&gt; &amp; y\n<\/code><\/pre>/);
  assert.match(fence('', 'let a = 1'), /<pre><code>let a = 1\n<\/code><\/pre>/);
});

test('the info string: a language, then lines and numbering in braces', () => {
  const lines = (info) => {
    const { groups, ...rest } = parseInfo(info);
    return { ...rest, groups: groups.map((g) => [...g]) };
  };
  assert.deepEqual(lines('js'), { lang: 'js', numbers: false, groups: [] });
  assert.deepEqual(lines('js {3,5-7}'), { lang: 'js', numbers: false, groups: [[3, 5, 6, 7]] });
  assert.deepEqual(lines('js{numbers}'), { lang: 'js', numbers: true, groups: [] });
  assert.deepEqual(lines('js {1-2|4 numbers}'), { lang: 'js', numbers: true, groups: [[1, 2], [4]] });
  assert.deepEqual(lines('{2}'), { lang: '', numbers: false, groups: [[2]] });
  assert.deepEqual(lines('js {title}'), { lang: 'js', numbers: false, groups: [] });
});

test('a span across lines is closed and opened again at each break', () => {
  assert.deepEqual(splitLines('<span class="a">x\n<span class="b">y\nz</span></span> w'), [
    '<span class="a">x</span>',
    '<span class="a"><span class="b">y</span></span>',
    '<span class="a"><span class="b">z</span></span> w',
  ]);
});

test('picked-out lines stand out', () => {
  const body = fence('c {2}', '/* a\nb */\nint x;');
  assert.match(body, /<pre class="code-lines code-focus"><code class="hljs language-c">/);
  assert.match(body, /<span class="line"><span class="hljs-comment">\/\* a<\/span><\/span>\n<span class="line hl"><span class="hljs-comment">b \*\/<\/span><\/span>\n<span class="line">/);
});

test('numbered lines say how wide their numbers are', () => {
  assert.match(fence('{numbers}', Array(12).fill('x').join('\n')), /<pre class="code-lines code-numbers" style="--digits: 2"><code>(<span class="line">x<\/span>\n){12}<\/code>/);
});

test('ranges separated by | are steps, the first standing out from the start', () => {
  const body = fence('js {1|2-3|1}', 'a\nb\nc');
  assert.match(body, /<pre class="code-lines code-focus" data-focus-steps="3">/);
  assert.match(body, /<span class="line hl" data-focus="1 3">a<\/span>\n<span class="line" data-focus="2">b<\/span>\n<span class="line" data-focus="2">c<\/span>/);
});

test('a callout marks its line, and its note follows the fence', () => {
  const body = fence('', 'a <1>');
  const html = render('```\na <1>\nb\nc // <2>\n```\n<1> - the first\n<2> the second\nrunning on\n').body;
  assert.match(html, /<div class="code-group">\n<pre class="code-lines code-focus" data-focus-steps="3"><code>/);
  assert.match(html, /<span class="line" data-focus="2" data-callout="1">a<span class="callout" data-n="1"><\/span><\/span>\n<span class="line">b<\/span>\n<span class="line" data-focus="3" data-callout="2">c<span class="callout" data-n="2"><\/span><\/span>/);
  assert.match(html, /<ol class="callout-notes">\n<li data-callout="1" data-focus="2"><span class="callout" data-n="1"><\/span><span>the first<\/span><\/li>\n<li data-callout="2" data-focus="3"><span class="callout" data-n="2"><\/span><span>the second\nrunning on<\/span><\/li>\n<\/ol>\n<\/div>/);
  assert.match(body, /a &lt;1&gt;/, 'without a note, a marker is code');
});

test('only a marker after a space, with a note, is taken', () => {
  const html = render('```\nList<1> a;\nx-- <1>\n  # <1>\nb <!-- <1> -->\nc <9>\n```\n<1> note\n').body;
  assert.match(html, /<span class="line">List&lt;1&gt; a;<\/span>/);
  assert.match(html, /<span class="line"[^>]*>x--<span class="callout"/);
  assert.match(html, /<span class="line"[^>]*><span class="callout"/, 'a comment alone goes with its marker');
  assert.match(html, /<span class="line"[^>]*>b<span class="callout"/);
  assert.match(html, /<span class="line">c &lt;9&gt;<\/span>/);
});

test('a fence that picks its own lines keeps them, and its notes follow them', () => {
  const html = render('```js {2|1}\na <1>\nb <2>\n```\n<1> one\n<2> two\n').body;
  assert.match(html, /<span class="line" data-focus="2" data-callout="1">a/);
  assert.match(html, /<span class="line hl" data-focus="1" data-callout="2">b/);
  assert.match(html, /<li data-callout="1" data-focus="2">/);
  assert.match(html, /<li data-callout="2" data-focus="1">/);
});

test('a paragraph after a fence that is not notes is left alone', () => {
  const html = render('```\na <1>\n```\nJust text.\n').body;
  assert.doesNotMatch(html, /code-group/);
  assert.match(html, /a &lt;1&gt;/);
});

test('an output fence after code is its output, shown as a step after it', () => {
  const html = render('```js\nlog(1)\n```\n```output\n1\n```\n').body;
  assert.match(html, /<div class="code-group">\n<pre data-focus-steps="2"><code class="hljs language-js">/);
  assert.match(html, /<pre class="output" data-focus="2"><code class="language-output">1\n<\/code><\/pre>\n<\/div>/);
});

test('an output fence on its own is output, unattached', () => {
  const html = render('```output\n1\n```\n').body;
  assert.match(html, /<pre class="output"><code class="language-output">1\n<\/code><\/pre>/);
  assert.doesNotMatch(html, /code-group/);
});

test('a callout in the output marks its line, and shows the output from its step', () => {
  const html = render('```js\na <1>\n```\n```output\nb <2>\n```\n<1> one\n<2> two\n').body;
  assert.match(html, /<pre class="code-lines code-focus" data-focus-steps="3">/);
  assert.match(html, /<pre class="output code-lines code-focus" data-focus="3"><code class="language-output"><span class="line" data-focus="3" data-callout="2">b<span class="callout" data-n="2"><\/span><\/span>/);
  assert.match(html, /<li data-callout="2" data-focus="3">/);
});

test('long output is cut short, with a way to show the rest', () => {
  const html = render(`\`\`\`output\n${Array(13).fill('x').join('\n')}\n\`\`\`\n`).body;
  assert.match(html, /<div class="output-long">\n<pre class="output">[\s\S]*<\/pre>\n<label class="output-more"><input type="checkbox"><span>Show all 13 lines<\/span><\/label>\n<\/div>/);
  assert.doesNotMatch(render(`\`\`\`output\n${Array(12).fill('x').join('\n')}\n\`\`\`\n`).body, /output-long/);
});

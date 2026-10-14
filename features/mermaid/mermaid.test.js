import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { FEATURES } from '../index.js';

test('a mermaid fence is wrapped for the preview to draw, its text kept as code', () => {
  const { body } = render('```mermaid\nflowchart LR\n  a --> b\n```\n');
  assert.match(body, /<div class="mermaid"><pre><code class="language-mermaid">flowchart LR\n {2}a --&gt; b\n<\/code><\/pre><\/div>/);
});

test('a fence the preview drew is written drawn, for a page with nothing to draw it', () => {
  const src = '```mermaid\nflowchart LR\n  a --> b\n```\n\n```mermaid\ngraph TD\n```\n';
  const { body } = render(src, { drawn: { mermaid: { 'flowchart LR\n  a --> b': '<svg id="m1"></svg>' } } });
  assert.match(body, /<div class="mermaid drawn"><pre><code class="language-mermaid">flowchart LR\n {2}a --&gt; b\n<\/code><\/pre><div class="mermaid-figure"><svg id="m1"><\/svg><\/div><\/div>/);
  assert.match(body, /<div class="mermaid"><pre><code class="language-mermaid">graph TD\n<\/code><\/pre><\/div>/);
});

test('other fences are left alone', () => {
  const { body } = render('```js\nx\n```\n\n```\nmermaid\n```\n');
  assert.doesNotMatch(body, /class="mermaid"/);
});

test('the wrapper takes the block\'s line, which stays on the page once the code is hidden', () => {
  const { body } = render('# Title\n\n```mermaid\ngraph TD\n```\n', { lines: true });
  assert.match(body, /<div class="mermaid" data-line="2"><pre><code/);
});

test('Mermaid is served for the preview to load when a page has a diagram', () => {
  const feature = FEATURES.find((f) => f.name === 'mermaid');
  assert.match(feature.preview, /mermaid\/preview\.js$/);
  assert.match(feature.lazy, /vendor\/mermaid\.min\.js$/);
});

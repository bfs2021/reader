import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBackground, liftBackground, backdrop } from '../src/background.js';
import { render } from '../src/render.js';
import { slides } from '../src/slides.js';
import { page, preview, run } from './dom.js';

test('a background is a color, an image, or both, in either order', () => {
  assert.deepEqual(readBackground('MidnightBlue'), { color: 'midnightblue' });
  assert.deepEqual(readBackground('#1a2B3c'), { color: '#1a2b3c' });
  assert.deepEqual(readBackground('images/paper.jpg'), { image: 'images/paper.jpg' });
  assert.deepEqual(readBackground('images/stars.jpg black'), { color: 'black', image: 'images/stars.jpg' });
  assert.deepEqual(readBackground('black my stars.PNG'), { color: 'black', image: 'my stars.PNG' });
  assert.deepEqual(readBackground('"https://example.com/a.webp?w=1600"'), { image: 'https://example.com/a.webp?w=1600' });
  assert.deepEqual(readBackground('none'), {});
});

test('what is neither is not a background', () => {
  assert.equal(readBackground('he grew up in Ohio'), null);
  assert.equal(readBackground('notes.md'), null);
  assert.equal(readBackground(''), null);
  assert.equal(readBackground(undefined), null);
});

test('the backdrop is an element behind the page', () => {
  assert.equal(backdrop({ color: 'navy' }), '<div class="gm-bg" style="background-color: navy"></div>\n');
  assert.equal(
    backdrop({ color: 'black', image: 'a "b".jpg' }),
    '<div class="gm-bg" style="background-color: black; background-image: url(&quot;a %22b%22.jpg&quot;)"></div>\n',
  );
  assert.equal(backdrop({}), '');
  assert.equal(backdrop(null), '');
});

test('a background: line comes out of a slide\'s notes; other lines stay', () => {
  assert.deepEqual(liftBackground('Say it slowly.\nbackground: navy\n\nThen wait.'), {
    notes: 'Say it slowly.\n\nThen wait.',
    background: { color: 'navy' },
  });
  assert.deepEqual(liftBackground('background: he grew up in Ohio'), {
    notes: 'background: he grew up in Ohio',
    background: undefined,
  });
});

test('the front matter\'s background is behind the page, and not in its masthead', () => {
  const { body, css } = render('---\ntitle: T\nbackground: paper.jpg #fdf6e3\n---\n\nHello.\n');
  assert.match(body, /^<div class="gm-bg" style="background-color: #fdf6e3; background-image: url\(&quot;paper.jpg&quot;\)"><\/div>\n<div class="gm-doc">/);
  assert.doesNotMatch(body, /background: paper/);
  assert.match(css, /\.gm-bg \{/);
  assert.doesNotMatch(render('Hello.\n').body, /gm-bg/);
});

test('a deck\'s background is behind every slide, unless the slide says otherwise', () => {
  const out = slides([
    '---\nbackground: paper.jpg\n---\n\n# One\n',
    '# Two\n\n<!--\nThe point.\nbackground: black\n-->\n',
    '# Three\n\n<!-- background: none -->\n',
    '<!-- background: stars.jpg -->\n',
  ].join('\n---\n\n'));
  const style = (s) => /class="gm-bg" style="([^"]*)"/.exec(s.body)?.[1];
  assert.deepEqual(out.slides.map(style), [
    'background-image: url(&quot;paper.jpg&quot;)',
    'background-color: black',
    undefined,
    'background-image: url(&quot;stars.jpg&quot;)',
  ]);
  assert.equal(out.slides[1].notes, 'The point.');
  const long = slides('-----\ntitle: T\nbackground: paper.jpg\n-----\n\n# One\n\n---\n\n# Two\n');
  assert.equal(long.title, 'T');
  assert.deepEqual(long.slides.map(style), Array(2).fill('background-image: url(&quot;paper.jpg&quot;)'));
  assert.equal(out.slides[2].notes, '');
});

test('the ink is whichever stands out more on the color, light or dark', () => {
  const { Ink } = run(page(), 'static/ink.js');
  assert.equal(Ink.lightInk([0, 0, 128]), true);
  assert.equal(Ink.lightInk([255, 255, 255]), false);
  // Mid-greys: on #777 the light ink is 4.0:1 and the dark 3.9:1; on #808080
  // and #8a8a8a, which brightness took for dark, the light would be 3.6:1
  // and 3.1:1, the dark 4.4:1 and 5.0:1.
  assert.equal(Ink.lightInk([0x77, 0x77, 0x77]), true);
  assert.equal(Ink.lightInk([0x80, 0x80, 0x80]), false);
  assert.equal(Ink.lightInk([0x8a, 0x8a, 0x8a]), false);
  // Pure red, which brightness took for dark: the light is 3.6:1, the dark 4.4:1.
  assert.equal(Ink.lightInk([255, 0, 0]), false);
  // Mostly see-through, it's the paper that shows.
  assert.equal(Ink.lightInk([0, 0, 0, 0.3]), false);
});

test('the preview frame inks the page by what its backdrop came to', () => {
  const { document, show } = preview();
  show('<div class="gm-bg" style="background-color: rgb(0, 0, 128)"></div><div class="gm-doc"></div>');
  assert.ok(document.documentElement.classList.contains('gm-dark'));
  show('<div class="gm-bg" style="background-color: rgb(138, 138, 138)"></div><div class="gm-doc"></div>');
  assert.ok(!document.documentElement.classList.contains('gm-dark'));
});

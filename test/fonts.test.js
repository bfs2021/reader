import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fontFamily, fontCss } from '../src/fonts.js';
import { render } from '../src/render.js';
import { slides } from '../src/slides.js';

test('fonts are named with hyphens for spaces, and tried in order', () => {
  assert.equal(fontFamily('avenir-next'), "'avenir next'");
  assert.equal(fontFamily('Playfair-Display source-serif-4, Sans-Serif'), "'Playfair Display', 'source serif 4', sans-serif");
  assert.equal(fontFamily(''), '');
  assert.equal(fontFamily(undefined), '');
});

test('what could not be a font\'s name is left out', () => {
  assert.equal(fontFamily('x; } { display:none'), '');
  assert.equal(fontFamily("georgia a'b url(x)"), "'georgia'");
});

test('font: sets the text, and title-font: the headings', () => {
  assert.equal(fontCss({ font: 'avenir-next' }), "body { font-family: 'avenir next', var(--gm-serif); }");
  assert.equal(fontCss({ 'title-font': 'Didot' }), "h1, h2, h3, h4, h5, h6 { font-family: 'Didot', var(--gm-serif); }");
  assert.equal(fontCss({}), '');
});

test('a document\'s fonts end its stylesheet, and stay out of its masthead', () => {
  const { css, body } = render('---\nfont: avenir-next\ntitle-font: didot\n---\n\n# Hi\n');
  assert.match(css, /body \{ font-family: 'avenir next', var\(--gm-serif\); \}\nh1, h2, h3, h4, h5, h6 \{ font-family: 'didot', var\(--gm-serif\); \}$/);
  assert.doesNotMatch(body, /avenir|didot/);
  assert.doesNotMatch(render('# Hi\n').css, /body \{ font-family: '/);
});

test('a deck\'s fonts set every slide', () => {
  const { css } = slides('-----\ntitle-font: Didot\n-----\n\n# One\n\n---\n\n# Two\n');
  assert.match(css, /h1, h2, h3, h4, h5, h6 \{ font-family: 'Didot', var\(--gm-serif\); \}/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { slides } from '../../src/slides.js';
import { readHeadline, lookFor } from './index.js';

const fence = (text) => `\`\`\`headline\n${text}\n\`\`\`\n`;

test('the text is the headline, a second paragraph the line under it, and the rest is fields', () => {
  assert.deepEqual(readHeadline('Opinion: Code Is "Free," Sort Of\nwrapped onto a line\n\nUnder it.\nAgency: The Atlantic\ndate : October 3, 2026\nurl: https://x.test/a'), {
    title: 'Opinion: Code Is "Free," Sort Of wrapped onto a line',
    deck: 'Under it.',
    agency: 'The Atlantic',
    date: 'October 3, 2026',
    by: '',
    url: 'https://x.test/a',
  });
});

test('a paper is known by its name, or by where the url points', () => {
  assert.equal(lookFor('The New York Times', '').look, 'nyt');
  assert.equal(lookFor('NYT', '').look, 'nyt');
  assert.equal(lookFor('the atlantic', '').look, 'atlantic');
  assert.equal(lookFor('The Guardian', '').look, 'guardian');
  assert.equal(lookFor('WIRED', '').look, 'wired');
  assert.equal(lookFor('Slashdot', '').look, 'slashdot');
  assert.equal(lookFor('', 'https://news.slashdot.org/story/1').look, 'slashdot');
  assert.equal(lookFor('', 'https://www.theguardian.com/x').look, 'guardian');
  assert.equal(lookFor('The Daily Planet', 'https://www.nytimes.com/x'), undefined, 'the name given wins');
  assert.equal(lookFor('', 'https://notnytimes.com/x'), undefined);
  assert.equal(lookFor('', ''), undefined);
});

test('a headline fence is a clipping, linked to its url', () => {
  const { body } = render(fence('Sam Says "Code Is Free"\nagency: Wired\ndate: October 3, 2026\nby: A. Reporter\nurl: https://www.wired.com/story/x?a=1&b=2'));
  assert.match(body, /<div class="headline headline-wired">\n<p class="headline-agency">Wired<\/p>\n<p class="headline-title"><a href="https:\/\/www.wired.com\/story\/x\?a=1&amp;b=2">Sam Says “Code Is Free”<\/a><\/p>\n<p class="headline-dateline">By A. Reporter · October 3, 2026<\/p>\n<\/div>/);
});

test('a paper reader doesn\'t know gets the plain clipping; the url alone can name one it does', () => {
  assert.match(render(fence('Man Bites Dog\nagency: The Daily Planet')).body, /<div class="headline headline-plain">\n<p class="headline-agency">The Daily Planet<\/p>\n<p class="headline-title">Man Bites Dog<\/p>\n<\/div>/);
  assert.match(render(fence('Man Bites Dog\nurl: https://www.theatlantic.com/x')).body, /headline-atlantic">\n<p class="headline-agency">The Atlantic<\/p>/);
});

test('only a web address is linked, and markup in a field is shown, not run', () => {
  const { body } = render(fence('Hi\nagency: <b>x</b>\nurl: javascript:alert(1)'));
  assert.doesNotMatch(body, /<a |<b>/);
  assert.match(body, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('a fence with no headline in it stays code, and so do other fences', () => {
  assert.match(render(fence('agency: Wired')).body, /<pre><code class="language-headline">/);
  assert.doesNotMatch(render('```\nheadline\n```\n').body, /class="headline/);
});

test('the clipping takes the block\'s line', () => {
  assert.match(render(`# T\n\n${fence('Hi')}`, { lines: true }).body, /<div class="headline headline-plain" data-line="2">/);
});

test('on a slide, a headline under the title is the slide\'s body', () => {
  const { body } = slides(`# T\n\n${fence('Hi')}\n---\n\n# Two\n`).slides[0];
  assert.match(body, /<div class="slide-body">\n<section class="gm-pair">\n<div class="gm-speaker">\n<div class="headline /);
});

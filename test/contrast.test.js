import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const style = read('static/style.css');
const speaker = read('static/speaker.css');

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** `hex` at `share` over `under`, as color-mix() makes it. */
const mix = (hex, share, under) => {
  const [a, b] = [rgb(hex), rgb(under)];
  return '#' + a.map((c, i) => Math.round(c * share + b[i] * (1 - share)).toString(16).padStart(2, '0')).join('');
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const readable = (ink, ground, what) =>
  assert.ok(contrast(ink, ground) >= 4.5, `${what}: ${ink} on ${ground} is ${contrast(ink, ground).toFixed(2)}:1`);

/** The custom properties set in a block of CSS. */
const tokens = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const light = tokens(style.slice(0, style.indexOf('@media')));
const dark = { ...light, ...tokens(style.slice(style.indexOf('@media'), style.indexOf('* {'))) };

test('no text is drawn in the faint ink', () => {
  for (const [name, css] of [['style.css', style], ['speaker.css', speaker]]) {
    assert.doesNotMatch(css, /(^|[;{\s])color:\s*var\(--ink-faint\)/m, name);
  }
});

test('the soft ink reads on every panel and row, in both themes', () => {
  for (const [theme, t] of [['light', light], ['dark', dark]]) {
    // a row: hovered, open, picked
    for (const ground of ['bg', 'panel', 'line', 'line-soft']) readable(t['ink-soft'], t[ground], `${theme} --${ground}`);
    readable(t['ink-soft'], mix(t.accent, 0.18, t.panel), `${theme} picked row`);
  }
  readable(tokens(speaker)['ink-soft'], tokens(speaker).panel, 'speaker view');
});

test("the version, at the foot of the list, is in the soft ink or the ink", () => {
  const rules = [...style.matchAll(/^\.version[^{]*\{([^}]*)\}/gm)].map((m) => m[1]);
  const inks = rules.flatMap((r) => [...r.matchAll(/(?:^|[;\s])color:\s*([^;]+)/g)].map((m) => m[1].trim()));
  assert.ok(inks.length);
  for (const ink of inks) assert.match(ink, /^var\(--ink(-soft)?\)$/);
});

test("the deck's foot reads on its white", () => {
  readable(style.match(/\.deck-foot \{[^}]*?[\s;]color: (#\w+)/)[1], '#ffffff', 'deck foot');
});

test("code's comments read on every ground code is drawn on", () => {
  const comment = read('features/highlight/highlight.css').match(/--hl-comment: (#\w+)/)[1];
  // the fence, a line picked out, output, a line of output picked out
  for (const ground of ['#f7f6f3', '#f0ebde', '#eef1f5', '#dfe6ef']) readable(comment, ground, 'comment');
});

test("a retro card's label reads on light paper and on dark", () => {
  const qa = read('features/qa/qa.css');
  for (const card of ['good', 'bad', 'try']) {
    const [, onLight] = qa.match(new RegExp(`li\\.qa-${card} \\{ --qa-card: (#\\w+)`));
    const [, onDark] = qa.match(new RegExp(`\\.gm-dark li\\.qa-${card} \\{ --qa-card: (#\\w+)`));
    readable(onLight, '#ffffff', `${card} label`);
    readable('#ffffff', onLight, `${card} label, done`);
    readable(onDark, '#22252b', `${card} label, dark`);
    readable('#22252b', onDark, `${card} label, done, dark`);
  }
});

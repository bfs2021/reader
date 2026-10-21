import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const style = read('static/style.css');
const speaker = read('static/speaker.css');
const columns = read('src/columns.css');

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** `hex` at `share` over `under`, as color-mix() in srgb makes it. */
const mix = (hex, share, under) => {
  const [a, b] = [rgb(hex), rgb(under)];
  return toHex(a.map((c, i) => c * share + b[i] * (1 - share)));
};
const lin = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const readable = (ink, ground, what) =>
  assert.ok(contrast(ink, ground) >= 4.5, `${what}: ${ink} on ${ground} is ${contrast(ink, ground).toFixed(2)}:1`);

/** The custom properties set in a block of CSS, as written. */
const declared = (css) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
/** The block of CSS after `head`, to its closing brace. */
const block = (css, head) => {
  const at = css.indexOf(head);
  assert.ok(at >= 0, head);
  return css.slice(at, css.indexOf('}', at) + 1);
};

/** Each of `props` as a #hex: a #hex as it is, a var() looked up, a color-mix() in srgb mixed. */
function resolve(props) {
  const out = {};
  const value = (v) => {
    v = v.trim();
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('').toLowerCase();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    let m = /^var\(--([\w-]+)\)$/.exec(v);
    if (m) return get(m[1]);
    m = /^color-mix\(in srgb, (.+) (\d+)%, (.+)\)$/.exec(v);
    if (m) {
      const [a, b] = [value(m[1]), value(m[3])];
      return a && b && mix(a, m[2] / 100, b);
    }
    return null; // rgba(), a rule's: never text
  };
  const get = (name) => (name in out ? out[name] : (out[name] = props[name] === undefined ? undefined : value(props[name])));
  for (const name of Object.keys(props)) get(name);
  return out;
}

// the app's colours, and the speaker view's, dark unless light is chosen
const appLight = declared(block(style, ':root {'));
const light = resolve(appLight);
const dark = resolve({ ...appLight, ...declared(block(style, ':root[data-theme="dark"] {')) });
const speakerDark = declared(block(speaker, ':root {'));
const speakers = {
  dark: resolve(speakerDark),
  light: resolve({ ...speakerDark, ...declared(block(speaker, ':root[data-chosen="light"] {')) }),
};

// the document's: the light set, the dark over it, and what each is for
const meaning = declared(block(columns, ':root {\n  --gm-accent'));
const lightSet = declared(block(columns, '/* colours, light */'));
const doc = {
  light: resolve({ ...lightSet, ...meaning }),
  dark: resolve({ ...lightSet, ...declared(block(columns, '/* colours, dark */')), ...meaning }),
};
const FAMILY = ['red', 'amber', 'moss', 'green', 'blue', 'violet', 'rose', 'slate'];

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
  for (const [theme, s] of Object.entries(speakers)) for (const ground of ['bg', 'panel']) readable(s['ink-soft'], s[ground], `speaker view, ${theme}`);
});

test("the app's ok and warn read where they're drawn, and the toast's ink on warn", () => {
  for (const [theme, t] of [['light', light], ['dark', dark]]) {
    for (const ground of ['bg', 'panel', 'line-soft']) {
      readable(t.ok, t[ground], `${theme} ok on --${ground}`);
      readable(t.warn, t[ground], `${theme} warn on --${ground}`);
    }
    readable(t.warn, mix(t.warn, 0.14, t.bg), `${theme} trash, hovered`);
    readable(t['on-warn'], t.warn, `${theme} toast`);
  }
});

test("the speaker view's pace reads on its ground", () => {
  for (const [theme, s] of Object.entries(speakers)) {
    for (const ink of ['ahead', 'on-pace', 'behind', 'warn']) for (const ground of ['bg', 'panel']) readable(s[ink], s[ground], `${theme} ${ink} on --${ground}`);
  }
});

test("the version, at the foot of the list, is in the soft ink or the ink", () => {
  const rules = [...style.matchAll(/^\.version[^{]*\{([^}]*)\}/gm)].map((m) => m[1]);
  const inks = rules.flatMap((r) => [...r.matchAll(/(?:^|[;\s])color:\s*([^;]+)/g)].map((m) => m[1].trim()));
  assert.ok(inks.length);
  for (const ink of inks) assert.match(ink, /^var\(--ink(-soft)?\)$/);
});

test("the deck's foot reads on its paper, light or dark", () => {
  const [, ink, ground] = style.match(/\.deck-foot \{[^}]*?[\s;]color: var\(--([\w-]+)\); background: var\(--([\w-]+)\)/);
  for (const t of [light, dark]) readable(t[ink], t[ground], 'deck foot');
});

test("the document's inks read on its paper and every ground on it, light and dark", () => {
  for (const [theme, t] of Object.entries(doc)) {
    for (const ground of ['paper', 'wash', 'well', 'th', 'stripe', 'lit']) {
      for (const ink of ['ink', 'ink-soft', 'aside-ink', 'accent']) readable(t[`gm-${ink}`], t[`gm-${ground}`], `${theme} --gm-${ink} on --gm-${ground}`);
    }
  }
});

test("the family's hues read on the paper and a fence, and the paper on them", () => {
  for (const [theme, t] of Object.entries(doc)) {
    for (const hue of FAMILY) {
      for (const ground of ['paper', 'well']) readable(t[`gm-${hue}`], t[`gm-${ground}`], `${theme} --gm-${hue} on --gm-${ground}`);
      readable(t['gm-paper'], t[`gm-${hue}`], `${theme} the paper on --gm-${hue}`);
    }
  }
});

test("a retro card's label reads on the paper, and the paper on it once it's done", () => {
  for (const [theme, t] of Object.entries(doc)) {
    for (const card of ['good', 'bad', 'try']) {
      for (const ground of ['paper', 'well']) readable(t[`gm-${card}`], t[`gm-${ground}`], `${theme} ${card} on --gm-${ground}`);
      readable(t['gm-paper'], t[`gm-${card}`], `${theme} ${card}, done`);
    }
  }
});

test("code's colours read on every ground code is drawn on", () => {
  for (const [theme, t] of Object.entries(doc)) {
    const inks = Object.keys(t).filter((k) => k.startsWith('gm-code-'));
    assert.ok(inks.length >= 9);
    // the fence, a line picked out, output, a line of output picked out
    for (const ink of inks) for (const ground of ['well', 'lit', 'output', 'output-lit']) readable(t[ink], t[`gm-${ground}`], `${theme} --${ink} on --gm-${ground}`);
  }
});

test("a headline's clipping reads, in each paper's colours", () => {
  for (const [theme, t] of Object.entries(doc)) {
    for (const ground of ['clip-paper', 'clip-white']) for (const ink of ['clip-ink', 'clip-ink-soft']) readable(t[`gm-${ink}`], t[`gm-${ground}`], `${theme} ${ink} on ${ground}`);
    for (const brand of ['atlantic', 'guardian']) readable(t[`gm-brand-${brand}`], t['gm-clip-white'], `${theme} ${brand}`);
    readable(t['gm-on-brand'], t['gm-brand-slashdot'], `${theme} slashdot`);
    readable(t['gm-clip-white'], t['gm-clip-ink'], `${theme} wired`);
  }
});

test("what's tinted reads on its tint: an unused ingredient, a puzzle's cursor and conflicts", () => {
  for (const [theme, t] of Object.entries(doc)) {
    readable(t['gm-amber'], mix(t['gm-amber'], 0.12, t['gm-paper']), `${theme} in no step`);
    readable(t['gm-pick'], mix(t['gm-pick'], 0.18, t['gm-paper']), `${theme} sudoku cursor`);
    readable(t['gm-error'], mix(t['gm-error'], 0.18, t['gm-paper']), `${theme} sudoku conflict`);
    readable(mix(t['gm-pick'], 0.7, t['gm-ink']), t['gm-paper'], `${theme} a coord puzzle's cue`);
  }
});

// Machado, Oliveira and Fernandes (2009), at full severity, in linear RGB.
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
/** `hex` as OKLab, seen through `matrix`. */
const oklab = (hex, matrix) => {
  let c = rgb(hex).map(lin);
  if (matrix) c = matrix.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2])));
  const [r, g, b] = c;
  const [l, m, s] = [
    0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b,
    0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
    0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b,
  ].map(Math.cbrt);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const apart = (a, b, matrix) => Math.hypot(...oklab(a, matrix).map((v, i) => v - oklab(b, matrix)[i]));

test('Good, Bad and Try, and ok and warn, stay apart under deuteranopia and protanopia', () => {
  const pairs = [];
  for (const [theme, t] of Object.entries(doc)) pairs.push([theme, t['gm-good'], t['gm-bad'], t['gm-try']]);
  for (const [theme, t] of [['app light', light], ['app dark', dark]]) pairs.push([theme, t.ok, t.warn]);
  for (const [theme, ...set] of pairs) {
    for (const [name, matrix] of Object.entries(CVD)) {
      for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) {
        const d = apart(set[i], set[j], matrix);
        // the old Good and Bad were 0.02 apart, their letters all that told them apart
        assert.ok(d >= 0.07, `${theme}, ${name}: ${set[i]} and ${set[j]} are ${d.toFixed(3)} apart`);
      }
    }
  }
});

test('no colour is written outside the blocks that name them', () => {
  const blocks = [
    [style, /^ *:root[^{]*\{[^}]*\}/gm],
    [speaker, /^ *:root[^{]*\{[^}]*\}/gm],
    [columns, /^\/\* colours, (light|dark) \*\/\n:root(\.gm-dark)? \{[^}]*\}/gm],
  ];
  const named = new Map(blocks.map(([css, re]) => [css, css.replace(re, '')]));
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const path = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (!['vendor', 'node_modules', 'icons'].includes(e.name)) walk(path); }
      else if (/\.(css|js|html)$/.test(e.name) && !e.name.endsWith('.test.js')) files.push(path);
    }
  };
  for (const dir of ['src', 'static', 'features']) walk(dir);
  assert.ok(files.length > 50);
  for (const path of files) {
    const css = read(path);
    const left = named.get(css) ?? css;
    assert.doesNotMatch(left, /#[0-9a-f]{3,8}\b(?![\w-])/i, path);
  }
});

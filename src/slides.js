/**
 * Markdown -> a deck of rendered slides, in the format of
 * https://github.com/maaslalani/slides, so one file presents both in the
 * terminal and here:
 *
 *   ---                      optional front matter (author, date, paging, ...)
 *   author: Josh
 *   background: paper.jpg    behind every slide (background.js)
 *   font: avenir-next        the deck's type (fonts.js)
 *   ---
 *
 *   # First slide
 *
 *   <!-- speaker notes -->
 *   <!-- background: navy -->    behind this slide instead
 *
 *   ---
 *
 *   # Second slide
 *
 * A line that is exactly `---` ends a slide, unless it is inside a code fence.
 * A slide's opening heading is its title, kept at the top (`.slide-title`),
 * and the rest (`.slide-body`) sits in the middle of what's left; a slide of
 * headings only, a title slide, is centered whole. One quote, image,
 * headline or line of math alone under the title is centered across the slide too.
 *
 * HTML comments are lifted out of a slide as its speaker notes: `slides`
 * sanitizes them away, so they never show in the terminal either. That
 * makes the notes the place for what reader is told about one slide: a
 * `key: value` line there is read and taken out of the notes shown (its
 * `background:` here, its `at:` and `time:` in pacing.js).
 *
 * The same file is a workbook when it's worked through and not presented
 * (`pages`): each slide a page of the document, at the size it's written.
 */

import path from 'node:path';
import { render, renderNotes } from './render.js';
import { readNotes, plan, planEnd, duration } from './pacing.js';
import { readBackground, liftBackground } from './background.js';
import { readEntry, makeKey } from '../features/asides/key.js';

const SEPARATOR = /^---[ \t]*$/;
// Front matter may be fenced with more dashes (`-----`), as a document's may.
const MATTER = /^-{3,}[ \t]*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const META = /^[ \t]*[\w-]+(?:[ \t]+\S)?[ \t]*:/;
const NOTE = /<!--([\s\S]*?)-->/g;

/** Is there a slide break in `src` after its front matter? */
export function isDeck(src) {
  return split(src).slides.length > 1;
}

export function slides(src, { file, read } = {}) {
  const { meta, key, slides: chunks } = split(src);
  const title = meta.title || (file ? path.basename(file, path.extname(file)) : 'Untitled');
  let css = '';
  const out = [];
  // Kept by features across the slides, to number things through the deck.
  const shared = {};
  const behind = readBackground(meta.background);
  for (const { text, line } of chunks) {
    const lifted = lift(text);
    if (!lifted.body.trim() && !lifted.notes) continue;
    const own = liftBackground(lifted.notes);
    const { notes, at, budget } = readNotes(own.notes);
    const r = render(lifted.body, { file, read, line, shared, asideKey: key, background: own.background ?? behind, fonts: meta });
    css ||= `${r.css}\n${CSS}`;
    out.push({ body: titled(unmast(r.body), lifted.body), notes, notesHtml: renderNotes(notes), line, at, budget });
  }
  // When each slide should start, by the notes' checkpoints and budgets.
  const total = duration(meta.time);
  const starts = plan(out, total);
  out.forEach((s, i) => { s.plan = starts[i]; });
  return { css: css || CSS, title, meta, slides: out, end: planEnd(out, starts, total) };
}

/**
 * A deck as a workbook's pages: each slide drawn as a document is, not as a
 * stage, with nothing of the slide's notes. `line` is where the page starts
 * in the file, and its blocks carry theirs (`data-line`).
 */
export function pages(src, { file, read } = {}) {
  const { meta, key, slides: chunks } = split(src);
  let css = '';
  const out = [];
  const shared = {};
  const behind = readBackground(meta.background);
  for (const { text, line } of chunks) {
    const lifted = lift(text);
    if (!lifted.body.trim()) continue;
    const own = liftBackground(lifted.notes);
    const r = render(lifted.body, { file, read, line, shared, asideKey: key, background: own.background ?? behind, fonts: meta, lines: true });
    css ||= r.css;
    out.push({ body: unmast(r.body), line });
  }
  return { css, meta, pages: out };
}

/**
 * Cuts `src` into slides, each with the 0-based line it starts on. Front
 * matter is taken only when every line in it reads as `key: value`, so a
 * deck that opens with a bare `---` rule isn't swallowed whole. Aside
 * aliases declared there (`reviewer #: Josh`) are the deck's `key`.
 */
export function split(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const meta = {};
  const entries = [];
  let i = 0;
  if (MATTER.test(lines[0] ?? '')) {
    const end = lines.findIndex((l, n) => n > 0 && MATTER.test(l));
    const inner = end > 0 ? lines.slice(1, end) : [];
    if (end > 0 && inner.every((l) => !l.trim() || META.test(l))) {
      for (const l of inner) {
        // An aside alias (`reviewer #: Josh`) is the deck's key, not its meta.
        const entry = readEntry(l);
        if (entry) {
          entries.push(entry);
          continue;
        }
        const at = l.indexOf(':');
        if (at > 0) meta[l.slice(0, at).trim().toLowerCase()] = unquote(l.slice(at + 1).trim());
      }
      i = end + 1;
    }
  }

  const out = [];
  let start = i;
  let fence = null;
  for (; i <= lines.length; i++) {
    const l = lines[i];
    if (i === lines.length || (!fence && SEPARATOR.test(l))) {
      out.push({ text: lines.slice(start, i).join('\n'), line: start });
      start = i + 1;
      continue;
    }
    fence = fenced(fence, l);
  }
  return { meta, key: makeKey(entries), slides: out.filter((s) => s.text.trim()) };
}

/**
 * Separates a slide's speaker notes (its HTML comments) from its content. A
 * note leaves its line breaks behind, so each line of the content is still
 * on the line it was in the file.
 */
export function lift(text) {
  const notes = [];
  const lines = text.split('\n');
  let fence = null;
  // Only comments outside code fences are notes; mask the fenced lines first.
  const masked = lines.map((l) => {
    const inside = fence || FENCE.test(l);
    fence = fenced(fence, l);
    return inside ? '\0'.repeat(l.length) : l;
  }).join('\n');

  let body = '';
  let last = 0;
  for (const m of masked.matchAll(NOTE)) {
    body += text.slice(last, m.index) + m[0].replace(/[^\n]/g, '');
    notes.push(dedent(m[1]));
    last = m.index + m[0].length;
  }
  body += text.slice(last);
  return { body, notes: notes.filter(Boolean).join('\n\n') };
}

/** The fence still open after line `l`, given the one open before it. */
function fenced(fence, l) {
  const f = FENCE.exec(l);
  if (!f) return fence;
  if (!fence) return f[1];
  const closes = f[1][0] === fence[0] && f[1].length >= fence.length && !l.trim().slice(f[1].length).trim();
  return closes ? null : fence;
}

function dedent(s) {
  const lines = s.replace(/^\n+|\s+$/g, '').split('\n');
  const pad = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(pad) ? pad : 0)).join('\n').trim();
}

function unquote(v) {
  return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

/** A slide is not a document: drop the title masthead the layout puts on top. */
function unmast(body) {
  return body.replace(/<header class="gm-masthead">[\s\S]*?<\/header>\s*/, '');
}

const PAIR = '<section class="gm-pair">\n<div class="gm-speaker">\n';
const OPENING = /<(h[1-6])\b[^>]*>[\s\S]*?<\/\1>\n?/y;
// What's left of a row that held only the title.
const EMPTY = `${PAIR}</div>\n<div></div>\n</section>\n`;
const HEADING_LINE = /^[ \t]*(?:#{1,6}[ \t]|:::)/;

/**
 * Sets a slide's opening heading apart from the rest of it, as
 * `.slide-title` above `.slide-body`, for the stylesheet to keep one at the
 * top and center the other. `src` is the slide as written: one that's all
 * headings is left as it was, to be centered whole.
 */
function titled(body, src) {
  if (src.split('\n').every((l) => !l.trim() || HEADING_LINE.test(l))) return body;
  const at = body.indexOf(PAIR);
  const end = body.lastIndexOf('</div>');
  OPENING.lastIndex = at + PAIR.length;
  const heading = at < 0 ? null : OPENING.exec(body);
  if (!heading) return body;
  let rest = PAIR + body.slice(OPENING.lastIndex, end);
  if (rest.startsWith(EMPTY)) rest = rest.slice(EMPTY.length);
  return `${body.slice(0, at)}<header class="slide-title">\n${heading[0].trim()}\n</header>\n<div class="slide-body">\n${rest}</div>\n</div>`;
}

// Scaled to the window, and centered on it, like a projected slide. The
// `:root` prefix outranks the preview frame's own pane-sized rules.
const CSS = `
/* sized by the window's width, or its height when it's wider than 16:9 */
:root { --gm-base: clamp(14px, min(2.1vw, 3.73vh), 40px); }
:root body { overflow: hidden; }
:root .gm-doc {
  max-width: none; min-height: 100vh; margin: 0;
  padding: 6vh 8vw;
  display: flex; flex-direction: column; justify-content: safe center;
}
:root .gm-doc h1 { font-size: 2.6rem; line-height: 1.12; margin: 0 0 0.5em; }
:root .gm-doc h2 { font-size: 1.9rem; line-height: 1.15; margin: 0 0 0.6em; }
:root .gm-doc pre { font-size: 0.8rem; }
:root .gm-doc:not(:has(.gm-asides)) .gm-pair { grid-template-columns: 1fr; }
/* the title at the top, the rest in the middle of what's left */
:root .slide-body { flex: 1; display: flex; flex-direction: column; justify-content: safe center; }
:root .slide-title > * { margin-top: 0; }
:root .slide-title h3, :root .slide-title h4 { font-size: 1.4rem; }
/* one quote, image, headline, number or line of math alone on a slide: centered across it too */
:root .gm-pair:only-of-type > .gm-speaker > :only-child:is(figure, blockquote:not(.alert), .headline, .number) {
  width: fit-content; max-width: min(100%, 34em); margin-left: auto; margin-right: auto;
}
:root .gm-pair:only-of-type > .gm-speaker > figure:only-child { max-width: 100%; }
:root .gm-pair:only-of-type > .gm-speaker > figure:only-child img { max-height: 64vh; object-fit: contain; margin: 0 auto; }
:root .gm-pair:only-of-type > .gm-speaker > figure:only-child figcaption { text-align: center; }
:root .gm-pair:only-of-type > .gm-speaker > p.math-display:only-child { font-size: 1.6em; }
`;

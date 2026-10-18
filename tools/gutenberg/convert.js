/**
 * A Project Gutenberg book's HTML -> reader-markdown.
 *
 *   convert(html, book) -> { markdown, stats }
 *
 * `book` is its entry in books.js: what the front matter says, where the
 * work starts and ends in the page (`start`, `end`: CSS selectors, or
 * `text:` and the words a heading or paragraph starts with; the end not
 * included), and what kind of text it is (`kind`):
 *
 *   prose   paragraphs, each on a line of its own
 *   play    as prose, and a speech is its speaker in bold on a line of
 *           its own, then its lines; stage directions are in italics
 *   verse   lines kept as lines (a hard break, `\`, ends each), stanzas
 *           as paragraphs
 *
 * Whatever kind, a paragraph broken into lines (`<br>`) keeps them. The
 * printed page a passage was on is kept as `{p.12}` where the page turned.
 * Pictures, their captions, tables of contents and Gutenberg's own pages
 * are left out, as is anything named in `drop` (selectors). A drop cap
 * (`<span class="letra">I</span>T is`) is put back into its word.
 *
 * Text that reader would read as its own syntax at the start of a line --
 * an aside's `~`, an exchange's `Q:`, a definition's `!` -- or anywhere --
 * emphasis, brackets -- is escaped, so the book reads as it was printed.
 */

import { parse } from 'node-html-parser';

const HEADINGS = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };
const SKIP_TAGS = new Set(['IMG', 'TABLE', 'STYLE', 'SCRIPT', 'HR', 'NAV']);
const SKIP_CLASSES = ['figcenter', 'figleft', 'figright', 'caption', 'pg-boilerplate', 'toc'];
const DIRECTION_CLASSES = ['scenedesc', 'right', 'stage', 'stagedir'];

export function convert(html, book) {
  const root = parse(html, { comment: false, blockTextElements: { script: false, style: false } });
  const body = root.querySelector('body') ?? root;
  const start = book.start ? find(body, book.start) : null;
  const end = book.end ? find(body, book.end) : null;
  if (book.start && !start) throw new Error(`${book.slug}: start ${book.start} not found`);
  if (book.end && !end) throw new Error(`${book.slug}: end ${book.end} not found`);
  const dropped = new Set((book.drop ?? []).flatMap((s) => (s.startsWith('text:') ? [find(body, s)] : body.querySelectorAll(s))));

  const blocks = [];
  let on = !start;
  let turned = null;
  let done = false;
  // A verse's number on a paragraph of its own, for the lines after it.
  let held = null;
  // The chapter the verses are in (`verseChapters`), for a heading when it changes.
  let chapter = null;
  // Where the chapters numbered before their verses have got to (`chapters`).
  const count = { chapter: 0, verse: 0 };
  const stats = { headings: 0, paragraphs: 0, pages: 0, lines: 0 };

  const walk = (node) => {
    for (const el of node.childNodes) {
      if (done) return;
      if (el.nodeType !== 1) continue;
      if (end && holds(el, end)) {
        if (el === end) { done = true; return; }
        walk(el);
        continue;
      }
      if (!on && start && holds(el, start)) {
        if (el === start || HEADINGS[el.tagName] || el.tagName === 'P') {
          on = true;
          // The page the work starts on, turned just before it.
          if (turned) {
            blocks.push(turned);
            stats.pages++;
          }
        } else {
          walk(el);
          continue;
        }
      }
      if (!on) {
        turned = el.tagName === 'P' && el.text.trim() && el.querySelectorAll('.pagenum').length && el.text.trim() === el.querySelector('.pagenum').text.trim()
          ? pageOf(el.querySelector('.pagenum')) : null;
        continue;
      }
      if (!skipped(el, dropped)) {
        block(el);
        continue;
      }
      // What's left out may still be where a page turned.
      for (const n of el.querySelectorAll('.pagenum')) {
        blocks.push(pageOf(n));
        stats.pages++;
      }
    }
  };

  const block = (el) => {
    const tag = el.tagName;
    if (HEADINGS[tag]) {
      const text = inline(el, { heading: true }).replace(/\s*\n\s*/g, ' ').trim().replace(/(?<!\.)\.$/, '');
      if (!text) return;
      const level = Math.min(6, Math.max(2, HEADINGS[tag] + (book.headingShift ?? 0)));
      // A page number in a heading goes before it.
      const pages = text.match(/\{p\.[^}]+\}/g) ?? [];
      if (pages.length) blocks.push(pages.join(' '));
      stats.pages += pages.length;
      blocks.push(`${'#'.repeat(level)} ${text.replace(/\s*\{p\.[^}]+\}\s*/g, ' ').trim()}`);
      stats.headings++;
      chapter = null;
      return;
    }
    if (tag === 'P') return paragraph(el);
    if (tag === 'PRE') return poem(el);
    if (tag === 'BLOCKQUOTE' || el.classList.contains('blockquot')) {
      const inner = [];
      const saved = blocks.splice(0);
      walk(el);
      inner.push(...blocks.splice(0));
      blocks.push(...saved, ...inner.map((b) => b.split('\n').map((l) => `> ${l}`).join('\n')));
      return;
    }
    if (tag === 'UL' || tag === 'OL') {
      el.querySelectorAll('li').forEach((li, k) => {
        const text = inline(li, {}).trim();
        if (text) blocks.push(`${tag === 'OL' ? `${k + 1}.` : '-'} ${text}`);
      });
      return;
    }
    // Anything else holds blocks of its own, or is a paragraph by another name.
    if (el.childNodes.some((c) => c.nodeType === 1 && (HEADINGS[c.tagName] || ['P', 'DIV', 'BLOCKQUOTE', 'UL', 'OL'].includes(c.tagName)))) walk(el);
    else paragraph(el);
  };

  const paragraph = (el) => {
    const direction = book.kind === 'play' && DIRECTION_CLASSES.some((c) => el.classList.contains(c));
    let text = inline(el, { italic: direction, indent: book.kind === 'verse' });
    let lines = text.split('\n').map(trim).filter(Boolean);
    if (!lines.length) return;
    if (lines.length === 1 && /^\d+\.$/.test(lines[0])) {
      held = held ? `${held} ${lines[0]}` : lines[0];
      return;
    }
    lines = numbered(lines);
    // A page turning between paragraphs stands on its own line.
    if (lines.length === 1 && /^\{p\.[^}]+\}$/.test(lines[0])) {
      blocks.push(lines[0]);
      stats.pages++;
      return;
    }
    stats.pages += (text.match(/\{p\.[^}]+\}/g) ?? []).length;
    if (direction) {
      blocks.push(`*${lines.join(' ').replace(/\*/g, '')}*`);
      return;
    }
    if (book.kind === 'play' && lines.length > 1 && /^[^a-z]+\.?$/.test(lines[0].replace(/\{p\.[^}]+\}/g, ''))) {
      // A speech: who speaks, then what they say, line by line.
      const [who, ...said] = lines;
      lines = [`**${who.replace(/\.$/, '')}**`, ...said.map(escapeLineStart)];
      stats.lines += said.length;
    } else {
      lines = lines.map(escapeLineStart);
      if (lines.length > 1) stats.lines += lines.length;
    }
    text = lines.join('\\\n');
    blocks.push(text);
    stats.paragraphs++;
  };

  /** A `<pre>`: a poem, its lines kept, indented as they were, a blank line between stanzas. */
  const poem = (el) => {
    const raw = inline(el, { pre: true }).split('\n');
    const margin = Math.min(...raw.filter((l) => l.trim()).map((l) => /^ */.exec(l)[0].length));
    const stanzas = raw.map((l) => (l.trim() ? '\u00a0'.repeat(/^ */.exec(l)[0].length - margin) + l.trim().replace(/[ \t]+/g, ' ') : ''))
      .join('\n').split(/\n{2,}/).map((st) => st.split('\n').filter(Boolean)).filter((st) => st.length);
    stanzas.forEach((st, k) => {
      const lines = (k ? st : numbered(st)).map(escapeLineStart);
      stats.lines += lines.length;
      stats.paragraphs++;
      blocks.push(lines.join('\\\n'));
    });
  };

  /**
   * The first of a paragraph's lines with the number held for it, and the
   * heading of the chapter it starts, if it starts one: written in it
   * (`chapters`), or counted from its verses' numbers (`verseChapters`).
   */
  const numbered = (lines) => {
    let first = lines[0];
    const rest = lines.slice(1);
    if (held) {
      first = `${held} ${first}`;
      held = null;
    }
    // Chapters numbered before their verses (`chapters`): `Ch. 1. 1. The Tao`,
    // `2. 1. All in the world`, or, for a chapter of one verse, `11. The
    // thirty spokes` -- told from verse 11 by counting: one more than the
    // chapter, not one more than the verse.
    const n = book.chapters && /^(?:Ch\. )?(\d+)\. (?:(\d+)\. )?/.exec(first);
    if (n) {
      const [k, v] = [Number(n[1]), n[2] && Number(n[2])];
      if (v === 1 || (k === count.chapter + 1 && k !== count.verse + 1)) {
        count.chapter = k;
        count.verse = v ?? -1;
        blocks.push(`### ${book.chapters} ${k}`);
        stats.headings++;
        first = v === 1 ? first.slice(n[0].length - 3) : first.slice(n[0].length);
      } else {
        count.verse = k;
      }
    }
    const verse = book.verseChapters && /^(\d+):\d+ /.exec(first);
    if (verse && verse[1] !== chapter) {
      chapter = verse[1];
      blocks.push(`### Chapter ${chapter}`);
      stats.headings++;
    }
    return [first, ...rest];
  };

  walk(body);

  const matter = ['-----', `title: ${book.title}`];
  if (book.author) matter.push(`author: ${book.author}`);
  if (book.translator) matter.push(`translator: ${book.translator}`);
  if (book.published) matter.push(`published: ${book.published}`);
  if (book.edition) matter.push(`edition: ${book.edition}`);
  matter.push(`cite: ${book.cite}`, '-----');
  const markdown = `${matter.join('\n')}\n\n${blocks.join('\n\n')}\n`;
  return { markdown, stats };
}

/**
 * The element a `start` or `end` names: a CSS selector, or `text:` and the
 * words the first heading, paragraph or division starting with them does.
 */
function find(body, spec) {
  if (!spec.startsWith('text:')) return body.querySelector(spec);
  const words = spec.slice(5);
  const starts = (el) => el.text.trim().replace(/\s+/g, ' ').startsWith(words);
  // Headings first: a table of contents names them too.
  return body.querySelectorAll('h1, h2, h3, h4, h5, h6').find(starts) ?? body.querySelectorAll('p, div').find(starts) ?? null;
}

/** A line without the spaces at its ends, keeping an indent of no-break spaces. */
const trim = (line) => line.replace(/^[ \t\n]+|[ \t\n]+$/g, '');

/** Whether `el` is `target` or holds it. */
function holds(el, target) {
  for (let at = target; at; at = at.parentNode) if (at === el) return true;
  return false;
}

function skipped(el, dropped) {
  if (dropped.has(el)) return true;
  if (SKIP_TAGS.has(el.tagName)) return true;
  return SKIP_CLASSES.some((c) => el.classList.contains(c));
}

/**
 * An element's text as markdown: emphasis, page numbers, a drop cap put
 * back, `<br>` as a newline; markdown's own characters escaped.
 */
function inline(el, { italic = false, heading = false, pre = false, indent = false } = {}) {
  let out = '';
  let dropcap = false;
  const visit = (node, em) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) {
        let t = c.text;
        if (indent && out.endsWith('\n')) {
          // A verse line set in from the margin after a break.
          t = t.replace(/^\n?([ \t]*)/, (m, sp) => '\u00a0'.repeat(sp.length));
        }
        if (!pre) t = t.replace(/[ \t\n\r\f]+/g, ' ');
        if (dropcap) {
          t = t.replace(/^[A-Z]+/, (m) => m.toLowerCase());
          dropcap = false;
        }
        out += escape(t);
        continue;
      }
      if (c.nodeType !== 1) continue;
      const tag = c.tagName;
      if (tag === 'BR') { out += '\n'; continue; }
      if (SKIP_TAGS.has(tag) || SKIP_CLASSES.some((k) => c.classList.contains(k))) continue;
      if (c.classList.contains('pagenum')) {
        out += pageOf(c) ?? '';
        continue;
      }
      if (c.classList.contains('letra')) {
        out += escape(c.text.trim());
        dropcap = true;
        continue;
      }
      if (tag === 'SUP' && c.querySelector('a')) continue;
      // A heading is bold already.
      const mark = tag === 'I' || tag === 'EM' || tag === 'CITE' ? '*' : (tag === 'B' || tag === 'STRONG') && !heading ? '**' : '';
      if (mark && !(italic && mark === '*') && !em.includes(mark)) {
        const before = out.length;
        visit(c, [...em, mark]);
        const inner = out.slice(before);
        out = out.slice(0, before) + wrap(inner, mark);
      } else {
        visit(c, em);
      }
    }
  };
  visit(el, []);
  if (pre) return out;
  return out.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/^[ \t\n]+|[ \t\n]+$/g, '');
}

/** `inner` in `mark`, with the spaces at its ends outside it: ` *word* `. */
function wrap(inner, mark) {
  const m = /^(\s*)([^]*?)(\s*)$/.exec(inner);
  if (!m[2]) return inner;
  // Emphasis can't run over a line break; each line gets its own.
  return m[1] + m[2].split('\n').map((l) => (l.trim() ? `${mark}${l.trim()}${mark}` : l)).join('\n') + m[3];
}

/** A page number's span -> `{p.12}`, or null. */
function pageOf(span) {
  const n = span.text.replace(/[{}[\]\s]|Pg|p\./gi, '');
  return n ? `{p.${n}}` : null;
}

/**
 * Markdown's characters, and reader's, as text. Brackets only where they
 * could start something: a link or image, a style (`]{`), a reference, or
 * a scheme's (`scripture:[`); on their own, `[Exit.]` reads as written.
 */
function escape(t) {
  return t.replace(/[\\`*_~<]/g, '\\$&').replace(/(?<=[:!])\[|\](?=[({[:])/g, '\\$&');
}

/**
 * Escapes what reader would read at the start of a line as its own
 * syntax: a heading, a quote, a list, an aside, a definition, an exchange
 * or a retro card, a vote, a field, a style block or a pane.
 */
export function escapeLineStart(line) {
  return LINE_START.test(line) ? `\\${line}` : line;
}

const LINE_START = /^(?:\[[^\]]*\]:|#{1,6}[ \t]|>|[-+*][ \t]|\d+[.)][ \t]|!|@[ \t]|:::|\+\+\+|\+1\b|-{3,}\s*$|(?:Q|A|Good|Bad|Try)(?:[ \t]*\([^)]*\))?:)/;

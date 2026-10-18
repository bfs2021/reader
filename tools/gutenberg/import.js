#!/usr/bin/env node
/**
 * Brings the books in books.js in from Project Gutenberg as reader-markdown.
 *
 *   node tools/gutenberg/import.js <cache> <library> [id ...]
 *
 * Each book's HTML is fetched once into `<cache>/<id>/`, then converted
 * (convert.js) and written to `<library>/<slug>.md`. Every book is then
 * rendered as reader renders it, and anything reader would read as its own
 * syntax rather than the book's text -- a list, an aside, an exchange -- is
 * reported, with how many words, headings, paragraphs, pages and lines it
 * came to.
 */

import fs from 'node:fs';
import path from 'node:path';
import { BOOKS } from './books.js';
import { convert } from './convert.js';
import { render } from '../../src/render.js';

const [cache, library, ...ids] = process.argv.slice(2);
if (!cache || !library) {
  console.error('usage: import.js <cache> <library> [id ...]');
  process.exit(2);
}

// Rendered, a book should be headings, paragraphs and quotes, and nothing of reader's own.
const STRANGE = {
  list: /<(?:ul|ol)\b/g,
  aside: /class="gm-aside-cell/g,
  definition: /class="defs"/g,
  exchange: /class="qa\b/g,
  field: /class="field\b/g,
  code: /<code\b/g,
  link: /<a\b/g,
  rule: /<hr\b/g,
};

const books = ids.length ? BOOKS.filter((b) => ids.includes(String(b.id))) : BOOKS;
let fetched = false;
for (const book of books) {
  const file = path.join(cache, String(book.id), `pg${book.id}.html`);
  if (!fs.existsSync(file)) {
    // Gently: one book at a time, a pause between them.
    if (fetched) await new Promise((r) => setTimeout(r, 2000));
    const url = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}-images.html`;
    const res = await fetch(url, { headers: { 'User-Agent': 'reader-library import (one-off, 10 books)' } });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await res.text());
    fetched = true;
  }

  const { markdown, stats } = convert(fs.readFileSync(file, 'utf8'), book);
  const out = path.join(library, `${book.slug}.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, markdown);

  const { body } = render(markdown, { file: `${book.slug}.md` });
  const strange = Object.entries(STRANGE)
    .map(([what, re]) => [what, (body.match(re) ?? []).length])
    .filter(([, n]) => n);
  const words = markdown.split(/\n-----\n/).slice(1).join('').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  console.log(`${book.slug}: ${words} words, ${stats.headings} headings, ${stats.paragraphs} paragraphs, ${stats.pages} pages, ${stats.lines} lines`
    + (strange.length ? `\n  !! ${strange.map(([w, n]) => `${n} ${w}`).join(', ')}` : ''));
}

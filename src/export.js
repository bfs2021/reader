/**
 * A document as one HTML file, to keep or send: the page the preview shows,
 * with its stylesheet and the images it takes from the content directory
 * inside it, so it reads the same wherever it's opened.
 *
 * Nothing in the file draws. A diagram is in it as the preview frame drew
 * it, when the app sends that along (`drawn`, see render.js), and is
 * otherwise left as the text it was written as, as a puzzle is; a field or
 * a checkbox shows what the file says.
 */

import fs from 'node:fs';
import path from 'node:path';
import { render } from './render.js';
import { escapeHtml, escapeAttr } from '../features/source.js';

const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

const IMG_SRC = /(<img\b[^>]*?\ssrc=")([^"]*)(")/g;
// The backdrop's image (background.js), its quotes escaped for the attribute.
const BACKDROP_URL = /(background-image: url\(&quot;)(.*?)(&quot;\))/g;

// The preview frame's `ink()`: light text on a dark background.
const INK = `<script>
(() => {
  const bg = document.querySelector('.gm-bg');
  const rgb = bg && getComputedStyle(bg).backgroundColor.match(/[\\d.]+/g)?.map(Number);
  const dark = Boolean(rgb) && (rgb[3] ?? 1) > 0.5 && (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 < 140;
  document.documentElement.classList.toggle('gm-dark', dark);
})();
</script>
`;

/**
 * `{ name, html, missing }` for the document at `file`: the name to save it
 * under, the page, and the images it names from the directory that aren't
 * there, left as links. `content` is the content directory (content.js), and `drawn`
 * what the preview frame drew of the document, if it was asked.
 */
export function exportHtml(content, file, drawn) {
  const read = (rel) => content.read(rel).text;
  const out = render(content.read(file).text, { file, read, drawn });
  const missing = [];
  const inline = (m, before, src, after) => `${before}${dataUrl(content, file, src, missing) ?? src}${after}`;
  const body = out.body.replace(IMG_SRC, inline).replace(BACKDROP_URL, inline);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(out.title)}</title>
<style>
${out.css.replace(/<\/(?=style)/gi, '<\\/')}
</style>
</head>
<body>
${body}
${body.includes('class="gm-bg"') ? INK : ''}</body>
</html>
`;
  return { name: `${path.basename(file, path.extname(file))}.html`, html, missing };
}

/**
 * The image at `src`, as written in the page of the document at `file`, as
 * a `data:` URL; or null when it isn't a file of the content directory's (a
 * URL, a missing file) and stays as it is. A missing file goes on `missing`.
 */
function dataUrl(content, file, src, missing) {
  const ref = src.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<');
  if (!ref || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(ref)) return null;
  let rel;
  try {
    rel = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURIComponent(ref.replace(/[?#].*$/, ''))));
    const type = IMAGE_TYPES[path.extname(rel).toLowerCase()];
    if (!type) return null;
    const { abs } = content.statFile(rel);
    return escapeAttr(`data:${type};base64,${fs.readFileSync(abs).toString('base64')}`);
  } catch {
    if (rel && !missing.includes(rel)) missing.push(rel);
    return null;
  }
}

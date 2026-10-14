/**
 * HTTP API and static files.
 *
 *   GET  /api/info             content root and name
 *   GET  /api/tree             listable files, newest first
 *   GET  /api/file?path=       { text, mtime }
 *   PUT  /api/file             { path, text, baseMtime, force?, explicit? }
 *   POST /api/new              { name? }
 *   POST /api/branch           { from, to } -> a copy of a document, as another version
 *   POST /api/promote          { path, base } -> { path, moved: [{ from, to }] }
 *   POST /api/rename           { moves: [{ from, to }] } -> { moved }
 *   POST /api/trash            { path } -> { path, trash }: set aside in .reader/trash/
 *   POST /api/restore          { trash } -> { path }: and back
 *   GET  /api/export?path=     the document as one HTML file, to save
 *   POST /api/export           { path, drawn? } -> the same, with what the preview frame drew set into it
 *   POST /api/render           { text, path? } -> { css, body, deck }
 *                              { text, path?, pages: true } -> for a deck, { css, deck, pages: [{ body, line }] }
 *   POST /api/slides           { text, path? } -> { css, title, slides: [{ body, notes, notesHtml, line, at, budget, plan, transition }], end }
 *   GET  /content/<path>       raw bytes (PDFs, images a note links to)
 *
 * Local unless told otherwise: the server refuses requests whose Host isn't
 * loopback, or a name it was started with (`allowHosts`), which is what
 * stops DNS rebinding; and mutating requests that aren't JSON (a cross-site form post
 * can't set that content type without a CORS preflight, which we never
 * answer).
 *
 * Files from the content directory are served sandboxed: an HTML or SVG file
 * there, opened from a link in a note, would otherwise run its scripts as
 * this app and could read and write every file through the API.
 *
 * Each page has a Content-Security-Policy (PAGE_POLICIES): no page runs an
 * inline script, so markup that slipped into a rendered note couldn't either.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContent, DOC_EXTS, PathError } from './content.js';
import { render } from './render.js';
import { slides, pages, isDeck } from './slides.js';
import { exportHtml } from './export.js';
import { FEATURES } from '../features/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const STATIC_DIR = path.join(HERE, '..', 'static');

const MAX_BODY = 20 * 1024 * 1024;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
  '.markdown': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

// The scripts features draw into the preview frame, in order, and those it
// loads when it needs them, served from their own directories, and nothing
// else from there.
const FEATURES_DIR = fileURLToPath(new URL('../features/', import.meta.url));
const served = (key) => FEATURES.flatMap((f) => [f[key] ?? []].flat())
  .map((file) => [`/features/${path.relative(FEATURES_DIR, file).split(path.sep).join('/')}`, file]);
const FEATURE_SCRIPTS = new Map([...served('preview'), ...served('lazy')]);
const PREVIEW_SCRIPTS = served('preview').map(([src]) => `<script src="${src}"></script>`).join('\n');

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

// What each page may load. Nothing inline runs anywhere: every script is a
// file of the app's own. The preview may take inline styles, since the
// rendered document brings its own (the theme, a ::: block's colors, an
// image's size), and images from anywhere a note points; it fetches
// nothing, and only the app may frame it. Neither the app nor the speaker
// view may be framed at all. The page a document is printed from takes the
// exported file written into it, which brings its styles and images inline
// and runs nothing.
const POLICY = (directives) => Object.entries(directives).map(([k, v]) => `${k} ${v}`).join('; ');
const LOCKED = {
  'default-src': "'none'",
  'base-uri': "'none'",
  'form-action': "'none'",
  'object-src': "'none'",
};
const PAGE_POLICIES = {
  'index.html': POLICY({
    ...LOCKED,
    'script-src': "'self'",
    'style-src': "'self'",
    'img-src': "'self' data:",
    'font-src': "'self' data:",
    'connect-src': "'self'",
    'frame-src': "'self'",
    'worker-src': "'self'",
    'frame-ancestors': "'none'",
  }),
  'speaker.html': POLICY({
    ...LOCKED,
    'script-src': "'self'",
    'style-src': "'self'",
    'img-src': "'self' data:",
    'frame-src': "'self'",
    'frame-ancestors': "'none'",
  }),
  'preview.html': POLICY({
    ...LOCKED,
    // A note's links and images resolve from the content directory.
    'base-uri': "'self'",
    'script-src': "'self'",
    'style-src': "'self' 'unsafe-inline'",
    'img-src': '* data: blob:',
    'font-src': "'self' data:",
    'frame-ancestors': "'self'",
  }),
  'print.html': POLICY({
    ...LOCKED,
    'style-src': "'unsafe-inline'",
    'img-src': 'data:',
    'font-src': 'data:',
    'frame-ancestors': "'self'",
  }),
};

// No scripts, no forms, and an opaque origin, for anything opened straight
// from /content/. PDFs are left out: browsers won't show one in a sandbox,
// and a PDF can't reach the API anyway.
const CONTENT_SANDBOX = { 'Content-Security-Policy': 'sandbox' };

export function createServer({ root, allowHosts = [] }) {
  const content = createContent(root);
  const hosts = new Set([...LOOPBACK, ...allowHosts.map((h) => h.toLowerCase())]);

  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status === 500) console.error(err);
      sendJson(res, { error: err.message, mtime: err.mtime }, status);
    }
  });

  // A puzzle's board kept in a file of its own, read from the content root.
  const read = (rel) => content.read(rel).text;

  async function handle(req, res) {
    const host = (req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
    if (!hosts.has(host)) return send(res, 403, 'forbidden host', 'text/plain');

    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname;

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (route === '/api/info') {
        return sendJson(res, { root: content.root, name: path.basename(content.root) });
      }
      if (route === '/api/tree') return sendJson(res, { files: content.list() });
      if (route === '/api/file') return sendJson(res, content.read(url.searchParams.get('path')));
      if (route === '/api/export') return sendExport(res, url.searchParams.get('path') || '');
      if (FEATURE_SCRIPTS.has(route)) return sendFile(res, FEATURE_SCRIPTS.get(route));
      if (route.startsWith('/content/')) {
        const rel = decodeURIComponent(route.slice('/content/'.length));
        const { abs } = content.statFile(rel);
        return sendFile(res, abs, path.extname(abs).toLowerCase() === '.pdf' ? {} : CONTENT_SANDBOX);
      }
      return serveStatic(res, route);
    }

    if (!['POST', 'PUT'].includes(req.method)) return send(res, 405, 'method not allowed', 'text/plain');
    if (!(req.headers['content-type'] || '').startsWith('application/json')) {
      return send(res, 415, 'expected application/json', 'text/plain');
    }
    const body = await readJson(req);

    if (route === '/api/render' && req.method === 'POST') {
      // A deck being worked through is drawn a page to a slide.
      if (body.pages && isDeck(body.text)) {
        const { css, pages: list } = pages(body.text, { file: body.path, read });
        if (list.length) return sendJson(res, { css, pages: list, deck: true });
      }
      return sendJson(res, { ...render(body.text, { file: body.path, read, lines: true }), deck: isDeck(body.text) });
    }
    if (route === '/api/slides' && req.method === 'POST') {
      return sendJson(res, slides(body.text, { file: body.path, read }));
    }
    if (route === '/api/file' && req.method === 'PUT') {
      const result = content.write(body.path, body.text, {
        baseMtime: body.baseMtime,
        force: Boolean(body.force),
        explicit: Boolean(body.explicit),
      });
      return sendJson(res, result);
    }
    if (route === '/api/export' && req.method === 'POST') return sendExport(res, body.path, body.drawn);
    if (route === '/api/new' && req.method === 'POST') {
      return sendJson(res, content.create(body.name));
    }
    if (route === '/api/branch' && req.method === 'POST') return sendJson(res, content.branch(body.from, body.to));
    if (route === '/api/promote' && req.method === 'POST') return sendJson(res, content.promote(body.path, body.base));
    if (route === '/api/rename' && req.method === 'POST') return sendJson(res, content.rename(body.moves));
    if (route === '/api/trash' && req.method === 'POST') return sendJson(res, content.trash(body.path));
    if (route === '/api/restore' && req.method === 'POST') return sendJson(res, content.restore(body.trash));
    if (route === '/api/extract' && req.method === 'POST') return sendJson(res, content.extract(body.path, body));
    if (route === '/api/unextract' && req.method === 'POST') return sendJson(res, content.unextract(body.path, body));
    return send(res, 404, 'not found', 'text/plain');
  }

  function sendExport(res, rel, drawn) {
    if (!DOC_EXTS.has(path.extname(String(rel)).toLowerCase())) throw new PathError(`not a document: ${rel}`);
    const { name, html } = exportHtml(content, rel, drawn);
    // Saved, never shown here: it carries a script of its own.
    return send(res, 200, html, TYPES['.html'], {
      ...CONTENT_SANDBOX,
      'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    });
  }

  function serveStatic(res, route) {
    const rel = route === '/' ? 'index.html' : decodeURIComponent(route).replace(/^\/+/, '');
    const abs = path.resolve(STATIC_DIR, rel);
    if (!abs.startsWith(STATIC_DIR + path.sep) || !fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      return send(res, 404, 'not found', 'text/plain');
    }
    const policy = PAGE_POLICIES[rel] ? { 'Content-Security-Policy': PAGE_POLICIES[rel] } : {};
    if (rel === 'preview.html') {
      const html = fs.readFileSync(abs, 'utf8').replace('<!-- scripts -->', PREVIEW_SCRIPTS);
      return send(res, 200, html, TYPES['.html'], policy);
    }
    return sendFile(res, abs, policy);
  }

  return { server, content };
}

function send(res, status, body, type, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(res.req?.method === 'HEAD' ? undefined : buf);
}

function sendJson(res, obj, status = 200) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function sendFile(res, abs, headers) {
  const type = TYPES[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  send(res, 200, fs.readFileSync(abs), type, headers);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('request too large'), { status: 413 }));
        req.destroy();
      } else {
        chunks.push(c);
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('bad json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

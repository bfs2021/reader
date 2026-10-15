import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createServer } from '../src/server.js';

let server, base, root;

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-srv-'));
  fs.writeFileSync(path.join(root, 'note.md'), '# Note\n\n* a point\n\n~ my aside\n');
  fs.writeFileSync(path.join(root, 'page.html'), '<script>fetch("/api/tree")</script>');
  fs.writeFileSync(path.join(root, 'pic.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  fs.writeFileSync(path.join(root, 'doc.pdf'), '%PDF-1.4\n');
  ({ server } = createServer({ root }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const json = (method, url, body) =>
  fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('serves the UI and the tree', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /<textarea id="editor"/);
  const { files } = await (await fetch(base + '/api/tree')).json();
  assert.deepEqual(files.map((f) => f.path).sort(), ['doc.pdf', 'note.md']);
});

test('render puts asides in the gutter column', async () => {
  const res = await json('POST', '/api/render', { text: '* a point\n\n~ my aside\n', path: 'note.md' });
  const out = await res.json();
  assert.match(out.body, /gm-aside-cell/);
  assert.match(out.body, /my aside/);
  assert.match(out.body, /<h1 class="gm-title">note<\/h1>/);
  assert.match(out.css, /--gm-aside-col/);
  assert.equal(out.asides, 1);
  assert.equal(out.deck, false);
});

test('render says whether the text is a deck, for the Present button', async () => {
  const out = await (await json('POST', '/api/render', { text: '---\ntitle: x\n---\n\n# One\n\n---\n\n# Two\n' })).json();
  assert.equal(out.deck, true);
});

test('render gives a deck being worked through as pages, and a document as itself', async () => {
  const deck = await (await json('POST', '/api/render', { text: '# One\n\n---\n\n# [x] Two\n', pages: true })).json();
  assert.equal(deck.deck, true);
  assert.deepEqual(deck.pages.map((p) => p.line), [0, 3]);
  assert.match(deck.pages[1].body, /<h1 class="task-heading"/);
  const doc = await (await json('POST', '/api/render', { text: '# One\n', pages: true })).json();
  assert.equal(doc.pages, undefined);
  assert.match(doc.body, /One/);
});

test('slides splits a deck and lifts its notes', async () => {
  const res = await json('POST', '/api/slides', { text: '# One\n\n<!-- hi -->\n\n---\n\n# Two\n', path: 'deck.md' });
  const out = await res.json();
  assert.equal(out.slides.length, 2);
  assert.equal(out.slides[0].notes, 'hi');
  assert.match(out.slides[1].body, /Two/);
});

test('save round-trips and reports conflicts as 409', async () => {
  const f = await (await fetch(base + '/api/file?path=note.md')).json();
  let res = await json('PUT', '/api/file', { path: 'note.md', text: 'edited\n', baseMtime: f.mtime });
  assert.equal(res.status, 200);
  assert.equal(fs.readFileSync(path.join(root, 'note.md'), 'utf8'), 'edited\n');

  res = await json('PUT', '/api/file', { path: 'note.md', text: 'stale\n', baseMtime: f.mtime - 1000 });
  assert.equal(res.status, 409);
});

test('refuses escapes, non-JSON writes and foreign hosts', async () => {
  let res = await fetch(base + '/api/file?path=' + encodeURIComponent('../x.md'));
  assert.equal(res.status, 400);
  res = await fetch(base + '/content/..%2F..%2Fetc%2Fpasswd');
  assert.equal(res.status, 400);
  res = await fetch(base + '/api/file', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(res.status, 415);

  const http = await import('node:http');
  const status = await new Promise((resolve) => {
    http.get(base + '/api/tree', { headers: { Host: 'evil.example:80' } }, (r) => resolve(r.statusCode));
  });
  assert.equal(status, 403);
});

test('exports a document as one HTML file, its images inside it', async () => {
  fs.writeFileSync(path.join(root, 'dot.png'), Buffer.from('iVBORw0KGgo=', 'base64'));
  fs.writeFileSync(path.join(root, 'out.md'), '---\ntitle: Out & about\nbackground: dot.png navy\n---\n\n![a dot](dot.png)\n\n![far](https://example.com/far.png)\n');
  const res = await fetch(`${base}/api/export?path=out.md`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.equal(res.headers.get('content-disposition'), `attachment; filename="out.html"; filename*=UTF-8''out.html`);
  const html = await res.text();
  assert.match(html, /<title>Out &amp; about<\/title>/);
  assert.match(html, /<style>[\s\S]*--gm-aside-col/);
  assert.match(html, /<img src="data:image\/png;base64,iVBORw0KGgo="/);
  assert.match(html, /background-image: url\(&quot;data:image\/png;base64,iVBORw0KGgo=&quot;\)/);
  assert.match(html, /<img src="https:\/\/example\.com\/far\.png"/);
  assert.doesNotMatch(html, /data-line=/);

  fs.writeFileSync(path.join(root, 'chart.md'), '```mermaid\ngraph TD\n```\n');
  const drawn = await json('POST', '/api/export', { path: 'chart.md', drawn: { mermaid: { 'graph TD': '<svg id="m1"></svg>' } } });
  assert.equal(drawn.status, 200);
  assert.match(drawn.headers.get('content-disposition'), /filename="chart\.html"/);
  assert.match(await drawn.text(), /<div class="mermaid drawn"><pre>[\s\S]*<\/pre><div class="mermaid-figure"><svg id="m1"><\/svg><\/div><\/div>/);
  assert.doesNotMatch(await (await fetch(`${base}/api/export?path=chart.md`)).text(), /mermaid-figure"/);
  assert.equal((await json('POST', '/api/export', { path: 'doc.pdf' })).status, 400);

  assert.equal((await fetch(`${base}/api/export?path=doc.pdf`)).status, 400);
  assert.equal((await fetch(`${base}/api/export?path=gone.md`)).status, 404);
  assert.equal((await fetch(`${base}/api/export?path=${encodeURIComponent('../x.md')}`)).status, 400);
});

test('serves content files sandboxed, so their scripts never run as the app', async () => {
  for (const file of ['page.html', 'pic.svg', 'note.md']) {
    const res = await fetch(`${base}/content/${file}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-security-policy'), 'sandbox', file);
  }
  const pdf = await fetch(`${base}/content/doc.pdf`);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-security-policy'), null);
});

test('the preview loads a script for each kind of puzzle and each feature that has one', async () => {
  const html = await (await fetch(base + '/preview.html')).text();
  assert.match(html, /<script src="\/features\/puzzles\/preview\.js"><\/script>/);
  for (const kind of ['sudoku', 'tracks', 'wordsearch', 'coord', 'maze']) {
    assert.match(html, new RegExp(`<script src="/features/puzzles/kinds/${kind}\\.js"></script>`));
    assert.equal((await fetch(`${base}/features/puzzles/kinds/${kind}.js`)).status, 200);
  }
  // The core comes before the kinds that register with it.
  assert.ok(html.indexOf('/features/puzzles/preview.js') < html.indexOf('/features/puzzles/kinds/'));
  for (const name of ['fields', 'tasks', 'qa']) {
    assert.match(html, new RegExp(`<script src="/features/${name}/preview\\.js"></script>`));
    const res = await fetch(`${base}/features/${name}/preview.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /javascript/);
  }
  assert.doesNotMatch(html, /<!-- scripts -->/);
  // Only the scripts features name are served from there.
  for (const other of ['/features/fields/index.js', '/features/qa/index.js', '/features/index.js', '/features/puzzles/index.js', '/puzzles/sudoku.js']) {
    assert.equal((await fetch(base + other)).status, 404, other);
  }
});

test('each page says what it may load: its own scripts only, nothing inline', async () => {
  const policy = async (url) => (await fetch(base + url)).headers.get('content-security-policy');
  for (const page of ['/', '/speaker.html', '/preview.html']) {
    const csp = await policy(page);
    assert.match(csp, /default-src 'none'/, page);
    assert.match(csp, /script-src 'self'(;|$)/, page);
    assert.match(csp, /object-src 'none'/, page);
  }
  assert.match(await policy('/'), /frame-ancestors 'none'/);
  assert.match(await policy('/'), /style-src 'self'(;|$)/);
  assert.match(await policy('/preview.html'), /frame-ancestors 'self'/);
  assert.match(await policy('/preview.html'), /style-src 'self' 'unsafe-inline'/);
  const print = await policy('/print.html');
  assert.match(print, /default-src 'none'/);
  assert.doesNotMatch(print, /script-src/);
  assert.match(print, /style-src 'unsafe-inline'/);
  for (const page of ['index.html', 'speaker.html', 'preview.html', 'print.html']) {
    const html = await (await fetch(`${base}/${page}`)).text();
    assert.doesNotMatch(html, /<script>|<script(?![^>]*\bsrc=)[^>]*>|\son[a-z]+=/, `${page} has no inline script`);
  }
});

test('a request addressed to another host is refused, unless the server was started with its name', async () => {
  const ask = (port, host) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: '/api/info', headers: { Host: host } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    }).on('error', reject);
  });
  assert.equal(await ask(server.address().port, 'my-nas:8734'), 403);
  const named = createServer({ root, allowHosts: ['My-NAS'] }).server;
  await new Promise((r) => named.listen(0, '127.0.0.1', r));
  try {
    assert.equal(await ask(named.address().port, 'my-nas:8734'), 200);
    assert.equal(await ask(named.address().port, 'localhost'), 200);
    assert.equal(await ask(named.address().port, 'evil.example'), 403);
  } finally {
    named.close();
  }
});

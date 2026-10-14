import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { findBrowser } from '../src/browser.js';

const READER = path.join(import.meta.dirname, '..', 'bin', 'reader.js');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

function dir(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-export-'));
  for (const [name, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), body);
  }
  return root;
}

const reader = (cwd, ...args) => promisify(execFile)(process.execPath, [READER, 'export', ...args], { cwd });

test('export saves each document beside itself, its images inside it', async () => {
  const root = dir({ 'a.md': '# A\n\n![](pic.png)\n', 'deck/b.md': '# B\n', 'pic.png': PNG });
  const { stdout, stderr } = await reader(root, 'a.md', 'deck/b.md', '--no-draw');
  assert.match(stdout, /a\.md -> a\.html/);
  assert.match(stdout, /deck\/b\.md -> deck\/b\.html/);
  assert.equal(stderr, '');
  assert.match(fs.readFileSync(path.join(root, 'a.html'), 'utf8'), /src="data:image\/png;base64,/);
  assert.match(fs.readFileSync(path.join(root, 'deck', 'b.html'), 'utf8'), /<title>b<\/title>/);
});

test('export says which images it could not find', async () => {
  const root = dir({ 'a.md': '![](gone.png)\n![](https://example.com/x.png)\n' });
  const { stderr } = await reader(root, 'a.md', '--out', 'elsewhere.html', '--no-draw');
  assert.match(stderr, /a\.md: no gone\.png, so it's left as a link/);
  assert.doesNotMatch(stderr, /example\.com/);
  assert.match(fs.readFileSync(path.join(root, 'elsewhere.html'), 'utf8'), /src="gone\.png"/);
  assert.ok(!fs.existsSync(path.join(root, 'a.html')));
});

test('export refuses what it cannot save', async () => {
  const root = dir({ 'a.md': '', 'b.md': '', 'doc.pdf': '' });
  await assert.rejects(reader(root, 'gone.md'), /no such file: gone\.md/);
  await assert.rejects(reader(root, 'doc.pdf'), /not a document/);
  await assert.rejects(reader(root, '../x.md'), /isn't under/);
  await assert.rejects(reader(root, 'a.md', 'b.md', '--out', 'x.html'), /--out is for one document/);
  await assert.rejects(reader(root), /which document/);
});

test('export draws diagrams with a browser', { skip: !findBrowser() && 'no Chrome or Chromium here', timeout: 60000 }, async () => {
  const root = dir({ 'a.md': '```mermaid\nflowchart LR\n  draft --> publish\n```\n' });
  await reader(root, 'a.md');
  const html = fs.readFileSync(path.join(root, 'a.html'), 'utf8');
  assert.match(html, /<div class="mermaid-figure"><svg/);
  assert.match(html, /draft/);
});

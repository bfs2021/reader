import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFiles, folderView, filtered, groupOf } from '../static/app/versions.js';

const files = (...paths) => paths.map((path, i) => ({ path, type: path.endsWith('.pdf') ? 'pdf' : 'md', mtime: i }));
const shape = (rows) => rows.map((r) => (r.kind === 'group' ? [r.name, r.versions.map((v) => v.variant)] : r.name));

test('versions group under the file they share a name with, the main one first', () => {
  const rows = groupFiles(files('slides.sketch.md', 'slides.md', 'slides.arc1-2.md', 'slides.arc1.md', 'research-brief.md'));
  assert.deepEqual(shape(rows), ['research-brief', ['slides', ['', 'arc1', 'arc1-2', 'sketch']]]);
  assert.equal(rows[1].main.path, 'slides.md');
  assert.equal(rows[1].opens.path, 'slides.md');
});

test('a dotted name is a version only beside its main file or another version', () => {
  assert.deepEqual(shape(groupFiles(files('v1.2-notes.md'))), ['v1.2-notes']);
  assert.deepEqual(shape(groupFiles(files('v1.2-notes.md', 'v1.md'))), [['v1', ['', '2-notes']]]);
  assert.deepEqual(shape(groupFiles(files('pruned.before-review.md', 'pruned.md'))), [['pruned', ['', 'before-review']]]);
});

test('versions with no main file group, and open the one edited last', () => {
  const [row] = groupFiles(files('talk.a.md', 'talk.b.md'));
  assert.deepEqual(shape([row]), [['talk', ['a', 'b']]]);
  assert.equal(row.main, null);
  assert.equal(row.opens.path, 'talk.b.md');
});

test('a version of a version is one more version of the main file', () => {
  assert.deepEqual(shape(groupFiles(files('a.md', 'a.b.md', 'a.b.c.md'))), [['a', ['', 'b', 'b.c']]]);
  // With no a.md, the longest shared name wins.
  assert.deepEqual(shape(groupFiles(files('a.b.c.md', 'a.b.d.md'))), [['a.b', ['c', 'd']]]);
});

test('a document comes before a PDF by the same name', () => {
  assert.deepEqual(groupFiles(files('report.pdf', 'report.md'))[0].versions.map((v) => v.file.path), ['report.md', 'report.pdf']);
});

test('a folder shows its own files by name, then the folders under it', () => {
  const all = files('b.md', 'a.md', 'experiments/specs/x.md', 'experiments/y.md', 'archive/z.md');
  const root = folderView(all, '');
  assert.deepEqual(shape(root.rows), ['a', 'b']);
  assert.deepEqual(root.folders, ['archive', 'experiments']);
  const sub = folderView(all, 'experiments');
  assert.deepEqual(shape(sub.rows), ['y']);
  assert.deepEqual(sub.folders, ['specs']);
});

test('filtering is flat, keeps a group as one row, and matches any of its versions', () => {
  const all = files('slides.md', 'slides.arc1.md', 'notes.md', 'experiments/arc.md');
  const rows = filtered(all, 'arc');
  assert.deepEqual(rows.map((r) => [r.dir, r.name]), [['', 'slides'], ['experiments', 'arc']]);
});

test('finds the group a file belongs to', () => {
  const all = files('x/slides.md', 'x/slides.arc1.md', 'x/other.md');
  assert.equal(groupOf(all, 'x/slides.arc1.md').name, 'slides');
  assert.equal(groupOf(all, 'x/other.md'), null);
});

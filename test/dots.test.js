import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout } from '../static/app/dots.js';

const pages = (marks) => marks.filter((m) => 'page' in m).map((m) => m.page);
const blocks = (marks) => marks.filter((m) => 'from' in m).map((m) => [m.from, m.to]);

test('a workbook of a couple of blocks or fewer has a dot a page', () => {
  assert.deepEqual(pages(layout(20, 13)), [...Array(20).keys()]);
  assert.deepEqual(blocks(layout(20, 13)), []);
});

test('a longer one goes in blocks of ten, with the showing page\'s block opened out', () => {
  const marks = layout(78, 43);
  assert.deepEqual(pages(marks), [40, 41, 42, 43, 44, 45, 46, 47, 48, 49]);
  assert.deepEqual(blocks(marks), [[0, 10], [10, 20], [20, 30], [30, 40], [50, 60], [60, 70], [70, 78]]);
  assert.deepEqual(marks[4], { page: 40 }, 'the opened block stands where it would');
});

test('the last block can be short, and opens out like the others', () => {
  assert.deepEqual(pages(layout(78, 77)), [70, 71, 72, 73, 74, 75, 76, 77]);
  assert.deepEqual(pages(layout(78, 0)), [...Array(10).keys()]);
});

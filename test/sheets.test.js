import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asPrinted } from '../static/app/sheets.js';

test('a page laid out to print has its print styles on and its screen styles off', () => {
  const html = '<style>@media print { a { b: c; } } @media screen and (max-width: 46rem) { d { e: f; } } @media (min-width: 1px) {}</style>';
  assert.equal(asPrinted(html), '<style>@media all { a { b: c; } } @media speech and (max-width: 46rem) { d { e: f; } } @media (min-width: 1px) {}</style>');
});

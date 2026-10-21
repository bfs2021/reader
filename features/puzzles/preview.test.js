import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { preview } from '../../test/dom.js';

const SUDOKU = `\`\`\`sudoku
5 3 . | . 7 . | . . .
6 . . | 1 9 5 | . . .
. 9 8 | . . . | . 6 .
8 . . | . 6 . | . . 3
4 . . | 8 . 3 | . . 1
7 . . | . 2 . | . . 6
. 6 . | . . . | 2 8 .
. . . | 4 1 9 | . . 5
. . . | . 8 . | . 7 9
\`\`\`
`;

/** The preview frame showing `markdown`'s puzzle: `press(key)` presses it there. */
function playing(markdown) {
  const p = preview();
  p.show(render(markdown).body);
  const host = p.document.querySelector('.puzzle');
  const press = (key, opts = {}) => {
    const e = new p.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts });
    (p.document.activeElement ?? host).dispatchEvent(e);
    return e;
  };
  const said = () => p.document.querySelector('.puzzle-said')?.textContent.trim() ?? '';
  return { ...p, host, press, said };
}

test('a puzzle is an application named by its kind, and its board is named too', () => {
  const { host } = playing(SUDOKU);
  assert.equal(host.getAttribute('role'), 'application');
  assert.equal(host.getAttribute('aria-label'), 'Sudoku');
  const board = host.querySelector('.sudoku-grid');
  assert.equal(board.getAttribute('role'), 'img');
  assert.equal(board.getAttribute('aria-label'), 'Sudoku board');
});

test('a key a puzzle takes says where it left it, and nothing is said while it isn\'t played', () => {
  const { host, press, said } = playing(SUDOKU);
  assert.equal(said(), '');
  host.focus();
  press('ArrowRight');
  assert.equal(said(), 'Row 1, column 4: empty');
  press('6', { code: 'Digit6' });
  assert.equal(said(), 'Row 1, column 4: 6');
  press('7', { code: 'Digit7' });
  assert.equal(said(), 'Row 1, column 4: 7, repeated');
  press('ArrowLeft');
  press('ArrowLeft');
  assert.equal(said(), 'Row 1, column 2: 3, given');
});

test('Esc hands the keys back but keeps the puzzle in focus, and Enter takes them again', () => {
  const { document, host, press, said } = playing(SUDOKU);
  host.focus();
  assert.ok(press('Escape').defaultPrevented);
  assert.equal(document.activeElement, host);
  assert.equal(said(), 'Keys handed back. Enter to play');
  // The page has them now: an arrow isn't the puzzle's, nor another Esc.
  assert.ok(!press('ArrowRight').defaultPrevented);
  assert.ok(!press('Escape').defaultPrevented);
  assert.ok(press('Enter').defaultPrevented);
  assert.ok(press('ArrowRight').defaultPrevented);
  assert.equal(said(), 'Row 1, column 4: empty');
});

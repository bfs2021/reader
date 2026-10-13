/**
 * Blocks side by side: a `:::` block named `columns`, each block in it a
 * column, all the same width:
 *
 *   ::: columns
 *   ```number
 *   15%
 *   daily code change
 *   ```
 *
 *   ```number
 *   26%
 *   weekly code change
 *   ```
 *   :::
 *
 * A column of more than one block is written between `+++` lines, which
 * then are the only things that start a column:
 *
 *   ::: columns
 *   ### Before
 *   * slow
 *   +++
 *   ### After
 *   * fast
 *   :::
 *
 * The other names on the fence are styles for what's in it, as on any `:::`
 * block (`::: columns avenir-next`), and blocks nest, columns in a column
 * too. The styles feature reads the fences, leaving this block's as the
 * lines in marks.js; the rule here parses what's between them.
 */

import fs from 'node:fs';
import { OPEN, DIVIDER, CLOSE } from './marks.js';

export function columns(md) {
  md.block.ruler.before('fence', 'columns', rule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
}

function rule(state, startLine, endLine, silent) {
  const text = (n) => state.src.slice(state.bMarks[n], state.eMarks[n]);
  if (text(startLine) !== OPEN) return false;
  if (silent) return true;

  // To the closing that's this block's own, past any block inside it; one
  // that's never closed runs to the end.
  const cuts = [];
  let depth = 0;
  let end = startLine + 1;
  for (; end < endLine; end++) {
    const line = text(end);
    if (line === OPEN) depth++;
    else if (line === CLOSE && !depth--) break;
    else if (line === DIVIDER && !depth) cuts.push(end);
  }

  const open = state.push('columns_open', 'div', 1);
  open.attrs = [['class', 'columns']];
  open.block = true;
  open.map = [startLine, Math.min(end + 1, endLine)];
  // An aside written in it or after it is about all of it (asides/split.js).
  open.meta = { whole: true };

  const { lineMax, parentType } = state;
  state.parentType = 'columns';
  const edges = [startLine, ...cuts, end];
  for (let k = 0; k + 1 < edges.length; k++) {
    const from = state.tokens.length;
    state.level += 1;
    state.lineMax = edges[k + 1];
    state.md.block.tokenize(state, edges[k] + 1, edges[k + 1]);
    state.level -= 1;
    // With `+++` lines, what's between two is a column; without, each block is.
    const inner = state.tokens.splice(from);
    for (const blocks of cuts.length ? [inner] : each(inner)) {
      if (!blocks.length) continue;
      const column = state.push('column_open', 'div', 1);
      column.attrs = [['class', 'column']];
      column.block = true;
      column.map = [blocks[0].map?.[0] ?? edges[k] + 1, edges[k + 1]];
      state.tokens.push(...blocks);
      state.push('column_close', 'div', -1).block = true;
    }
  }
  state.lineMax = lineMax;
  state.parentType = parentType;

  state.push('columns_close', 'div', -1).block = true;
  state.line = Math.min(end + 1, endLine);
  return true;
}

/** `tokens`, a block at a time. */
function each(tokens) {
  const out = [];
  let block = [];
  let depth = 0;
  for (const t of tokens) {
    block.push(t);
    depth += t.nesting;
    if (depth) continue;
    out.push(block);
    block = [];
  }
  return out;
}

export default {
  name: 'columns',
  plugin: columns,
  css: fs.readFileSync(new URL('./columns.css', import.meta.url), 'utf8'),
};

/**
 * Layouts: `:::` blocks named `columns`, `tabs` or `compare`, which set the
 * blocks in them out as panes -- side by side, or one at a time. Each block
 * in one is a pane, unless `+++` lines are written in it; then what's between
 * two is, and a word after the `+++` names the pane that follows:
 *
 *   ::: tabs
 *   +++ Maven
 *   ```xml
 *   ...
 *   ```
 *   +++ Gradle
 *   ```groovy
 *   ...
 *   ```
 *   :::
 *
 * The styles feature reads the fences and leaves each line that's a
 * layout's as a mark of its own: the opening, the mark and the layout's
 * name; each `+++`, the mark and its label; the closing. A private-use
 * character each, which markdown passes through untouched and nothing else
 * writes. A layout's rule finds its own opening and splits what's in it
 * into panes with `panes()`.
 */

export const LAYOUTS = ['columns', 'tabs', 'compare'];

export const OPEN = '\uE021';
export const DIVIDER = '\uE022';
export const CLOSE = '\uE023';

/** Whether `line` of the source opens a `name` layout. */
export function opens(state, line, name) {
  return state.src.slice(state.bMarks[line], state.eMarks[line]) === OPEN + name;
}

/**
 * Parses the layout opening at `startLine` into panes, as `{ end, panes }`:
 * the line it closes on (or `endLine`, never closed), and each pane's
 * `{ label, tokens, map }`, its label the one on the `+++` before it, if
 * any. Its tokens are one level in from the caller's, for the caller to
 * wrap in a pane of its own.
 */
export function panes(state, startLine, endLine, name) {
  const text = (n) => state.src.slice(state.bMarks[n], state.eMarks[n]);

  // To the closing that's this block's own, past any block inside it.
  const cuts = [];
  let depth = 0;
  let end = startLine + 1;
  for (; end < endLine; end++) {
    const line = text(end);
    if (line.startsWith(OPEN)) depth++;
    else if (line === CLOSE && !depth--) break;
    else if (line.startsWith(DIVIDER) && !depth) cuts.push(end);
  }

  const out = [];
  const { lineMax, parentType } = state;
  state.parentType = name;
  const edges = [startLine, ...cuts, end];
  for (let k = 0; k + 1 < edges.length; k++) {
    const from = state.tokens.length;
    state.level += 1;
    state.lineMax = edges[k + 1];
    state.md.block.tokenize(state, edges[k] + 1, edges[k + 1]);
    state.level -= 1;
    // With `+++` lines, what's between two is a pane; without, each block is.
    const inner = state.tokens.splice(from);
    const label = k ? text(edges[k]).slice(DIVIDER.length).trim() : '';
    for (const tokens of cuts.length ? [inner] : each(inner)) {
      if (!tokens.length) continue;
      out.push({ label, tokens, map: [tokens[0].map?.[0] ?? edges[k] + 1, edges[k + 1]] });
    }
  }
  state.lineMax = lineMax;
  state.parentType = parentType;
  return { end, panes: out };
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

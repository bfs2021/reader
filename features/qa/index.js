/**
 * `Q:` and `A:` at the start of a line make an exchange: each its own item
 * in a list, labelled, with the asker's or answerer's name beside the label
 * when given (`Q (audience):`). A second `A:` in a row, unnamed or naming the
 * same person, continues the answer as a new paragraph rather than starting
 * another; likewise `Q:`. Any other line at the margin ends the exchange,
 * and `\A:` keeps a line that starts that way as typed.
 *
 *   Q (audience): Is this a pendulum swing or an integration?
 *   A (Thomas): An integration.
 *
 * A retro's cards are exchanges too: `Good:`, `Bad:` and `Try:` each start
 * one, labelled G, B and T, and are never continued -- the next is another
 * card. `+1` under a card or a question, named or not and with a comment
 * after a colon or not, is a vote for it: an item of its own, counted on
 * the card.
 *
 *   Bad (Josh): We were surprised by the deadline
 *   +1 (Rob)
 *   A (Rob): Plan them against the calendar.
 *
 * Before anything else reads the source -- the asides included, so
 * that an aside ends where an exchange's line begins -- each such line
 * becomes a `+` list item (so it never joins a `-` or `*` list above it), and
 * one that carries on the item before it is indented into that item. Who
 * spoke is kept, by line, in `env.qa`; once the text is parsed, the items on
 * those lines are labelled, finding their lines through the asides feature's
 * `env.sourceLines`.
 */

import fs from 'node:fs';
import { beforeAsides, addClass } from '../source.js';

// A name may hold a link, whose address is in parentheses of its own.
const QA = /^\\?(Q|A|Good|Bad|Try)(?:[ \t]*\(((?:[^()\n]|\([^()\n]*\))*)\))?:[ \t]+(?=\S)/;
const VOTE = /^\+1(?:[ \t]*\(((?:[^()\n]|\([^()\n]*\))*)\))?(?::[ \t]+(?=\S)|:?[ \t]*$)/;
const LABELS = { Good: 'G', Bad: 'B', Try: 'T', '+1': '+1' };
const CARDS = new Set(['Good', 'Bad', 'Try']);
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

export function qa(md) {
  beforeAsides(md, 'qa_lines', lines);
  // Last, after markdown's own rules: a paragraph split off here has no
  // source text of its own for them to check before they'd run.
  md.core.ruler.push('qa_items', items);
  md.renderer.rules.qa_label = (tokens, i) => {
    const { who, name, votes } = tokens[i].meta;
    const tally = votes ? `<span class="qa-tally">+${votes}</span>` : '';
    // A name is markdown like the rest of the line: *emphasis*, quotes.
    return `<span class="qa-label">${LABELS[who] ?? who}</span>${tally}${name ? `<span class="qa-name">${md.renderInline(name)}</span>` : ''}`;
  };
  md.renderer.rules.qa_para = () => '<span class="qa-para"></span>';
}

/**
 * Rewrites `Q:`, `A:`, card and vote lines as list items, noting who spoke
 * on each. A vote keeps its `+1` as the item's text, so the item is never
 * empty (an empty one would join the line before); labelling takes it off.
 */
function lines(state) {
  // An aside is a thought of the reader's own, not part of an exchange.
  if (state.inlineMode || state.env.__aside) return;
  const said = new Map();
  let open = null;
  // The question or card a vote is for.
  let head = null;
  let fence = null;
  const out = state.src.split('\n').map((line, n) => {
    const f = FENCE.exec(line);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      return line;
    }
    if (f) {
      fence = f[1];
      open = head = null;
      return line;
    }
    const v = head && VOTE.exec(line);
    if (v) {
      const text = line.slice(v[0].length);
      head.votes++;
      open = { who: '+1' };
      said.set(n, { who: '+1', name: v[1]?.trim() ?? '', bare: !text });
      return `+ +1 ${text}`;
    }
    const q = QA.exec(line);
    if (!q || q[0].startsWith('\\')) {
      const rest = q ? line.slice(1) : line;
      if (/^\S/.test(rest)) open = head = null;
      return rest;
    }
    const [m, who] = q;
    const name = q[2]?.trim() ?? '';
    const text = line.slice(m.length);
    if (open && open.who === who && !CARDS.has(who) && (!name || name === open.name)) {
      said.set(n, { more: true });
      return `  ${text}`;
    }
    open = { who, name };
    const item = { who, name, votes: 0 };
    if (who !== 'A') head = item;
    said.set(n, item);
    return `+ ${text}`;
  });
  // An escaped `\A:` loses its backslash even when nothing else changed.
  state.src = out.join('\n');
  if (said.size) state.env.qa = said;
}

/**
 * Labels the list items on lines that held a `Q:` or `A:`, and starts a new
 * paragraph where an item carries on from the line before.
 */
function items(state) {
  if (!state.env.qa || state.env.__aside) return;
  // Lines the parser saw -> lines as written, before asides were taken out.
  const source = state.env.sourceLines;
  const said = { get: (n) => state.env.qa.get(source?.[n] ?? n) };
  const tokens = state.tokens;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'list_item_open' && t.markup === '+' && said.get(t.map?.[0])?.who) {
      const { who, name, votes, bare } = said.get(t.map[0]);
      const kind = who === '+1' ? `vote${bare ? ' qa-bare' : ''}` : `${CARDS.has(who) ? 'card qa-' : ''}${who.toLowerCase()}`;
      addClass(t, `qa qa-${kind}`);
      let k = i + 1;
      while (k < tokens.length && tokens[k].type !== 'inline') k++;
      const inline = tokens[k];
      if (who === '+1') {
        const first = inline.children[0];
        first.content = first.content.replace(/^\+1 ?/, '');
      }
      const label = new state.Token('qa_label', '', 0);
      label.meta = { who, name, votes };
      inline?.children.unshift(label);
    } else if (t.type === 'inline' && t.map) {
      i = carryOn(state, i, said);
    }
  }
}

/**
 * An answer carried on straight after the line before landed in that line's
 * paragraph: split it off into a paragraph of its own, or, in a tight list
 * where paragraphs aren't shown, mark the break. Returns where to go on from.
 */
function carryOn(state, i, said) {
  const tokens = state.tokens;
  const inline = tokens[i];
  const [start, end] = inline.map;
  // The k-th line break in the paragraph comes before its line start + k.
  const breaks = inline.children.flatMap((c, at) => (c.type === 'softbreak' ? [at] : []));
  const cuts = breaks.filter((at, k) => said.get(start + k + 1)?.more && start + k + 1 < end);
  if (!cuts.length) return i;
  const open = tokens[i - 1];
  const close = tokens[i + 1];
  if (open.hidden) {
    for (const at of cuts) inline.children.splice(at, 1, new state.Token('qa_para', '', 0));
    return i;
  }
  const pieces = [];
  let from = 0;
  for (const at of [...cuts, inline.children.length]) {
    const piece = new state.Token('inline', '', 0);
    piece.children = inline.children.slice(from, at);
    piece.content = '';
    piece.level = inline.level;
    pieces.push(piece);
    from = at + 1;
  }
  const copy = (t) => Object.assign(new state.Token(t.type, t.tag, t.nesting), t, { attrs: t.attrs?.map((a) => [...a]) ?? null });
  const run = pieces.flatMap((piece, k) => (k === 0 ? [piece] : [copy(close), copy(open), piece]));
  tokens.splice(i, 1, ...run);
  return i + run.length - 1;
}

export default {
  name: 'qa',
  plugin: qa,
  css: fs.readFileSync(new URL('./qa.css', import.meta.url), 'utf8'),
};

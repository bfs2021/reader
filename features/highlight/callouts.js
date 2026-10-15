/**
 * Callouts: notes on the lines of a code fence, as AsciiDoc writes them. A
 * line ends in a marker, and the paragraph right after the fence says what
 * each marker is about:
 *
 *   ```java
 *   numbers.stream()
 *     .gather(Gatherers.scan(() -> 0, Integer::sum)) <1>
 *     .forEach(System.out::println); // <2>
 *   ```
 *   <1> `scan()` emits the partial, intermediate results
 *   <2> - one line per running sum
 *
 * A marker is `<N>` at the end of a line, after a space, with a note for N
 * after the fence; anything else (`List<1>`) is code. A comment it's alone
 * in (`// <2>`, `# <2>`, `<!-- <2> -->`) goes with it, so the code copies
 * clean. A note runs from its `<N>` to the next, a `-` after the marker
 * read as part of it.
 *
 * The fence and its notes are drawn as one block (`.callouts`), each line a
 * marker's on saying so (`data-callout`). Each callout is a step of the
 * fence's highlight, after one where none stands out, unless the info
 * string picks out its own (`{1|3}`); a note shows with the first step its
 * lines stand out in (`data-focus`).
 */

import { parseInfo } from './index.js';

const NOTE = /^<(\d+)>\s*(?:-\s+)?(.*)$/;
const MARKS = /(\S)\s+((?:<\d+>\s*)+)$/;
const ALONE = /(?:^|\s+)(?:\/\/|#|--)$/;
const BLOCK = /(\S)\s+(?:\/\*|<!--)\s*((?:<\d+>\s*)+)(?:\*\/|-->)\s*$/;

/** The notes a paragraph's text makes, if it opens with one: `[{ n, text }]`. */
export function readNotes(text) {
  const notes = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const m = NOTE.exec(line);
    if (m) notes.push({ n: Number(m[1]), text: m[2] });
    else if (notes.length) notes.at(-1).text += `\n${line}`;
    else return [];
  }
  return notes;
}

/**
 * `code` with the markers of `known` numbers taken off its lines ->
 * `{ code, marks }`, `marks` holding each marked line's numbers by line,
 * counted from 1. A line with a marker not known is left as it is.
 */
export function takeMarks(code, known) {
  const marks = new Map();
  const lines = code.split('\n').map((line, k) => {
    const block = BLOCK.exec(line);
    const m = block || MARKS.exec(line);
    if (!m) return line;
    const ns = m[2].match(/\d+/g).map(Number);
    if (!ns.every((n) => known.has(n))) return line;
    marks.set(k + 1, ns);
    const kept = line.slice(0, m.index + 1);
    return block ? kept : kept.replace(ALONE, '');
  });
  return { code: lines.join('\n'), marks };
}

/** A core rule: each fence followed by notes on its lines becomes one block. */
export function callouts(state) {
  const tokens = state.tokens;
  for (let i = tokens.length - 4; i >= 0; i--) {
    const fence = tokens[i];
    const open = tokens[i + 1];
    if (fence.type !== 'fence' || open.type !== 'paragraph_open' || open.level !== fence.level) continue;
    const notes = readNotes(tokens[i + 2].content);
    if (!notes.length) continue;
    const { code, marks } = takeMarks(fence.content, new Set(notes.map((note) => note.n)));
    if (!marks.size) continue;
    fence.content = code;

    // Each callout's lines, a step each after one with none, unless the
    // fence picks its own.
    const linesOf = (n) => new Set([...marks].filter(([, ns]) => ns.includes(n)).map(([line]) => line));
    const picked = parseInfo(fence.info ? state.md.utils.unescapeAll(fence.info) : '').groups;
    const order = [...new Set(notes.map((note) => note.n))].filter((n) => linesOf(n).size);
    const groups = picked.length ? picked : [new Set(), ...order.map(linesOf)];
    fence.meta = { ...fence.meta, callouts: marks, groups };

    const Token = state.Token;
    const make = (type, tag, nesting, attrs = []) => {
      const t = new Token(type, tag, nesting);
      t.block = true;
      t.level = fence.level;
      t.attrs = attrs;
      return t;
    };
    const wrap = make('callouts_open', 'div', 1, [['class', 'callouts']]);
    wrap.map = [fence.map[0], open.map[1]];
    wrap.meta = { whole: true };
    const list = make('callout_notes_open', 'ol', 1, [['class', 'callout-notes']]);
    list.map = open.map;
    const items = notes.flatMap((note) => {
      const lines = linesOf(note.n);
      const steps = groups.flatMap((g, j) => ([...lines].some((line) => g.has(line)) ? [j + 1] : []));
      const li = make('callout_note_open', 'li', 1, [['data-callout', String(note.n)]]);
      if (steps.length) li.attrPush(['data-focus', steps.join(' ')]);
      const inline = make('inline', '', 0);
      inline.content = note.text;
      inline.children = [];
      return [li, inline, make('callout_note_close', 'li', -1)];
    });
    tokens.splice(i, 4, wrap, fence, list, ...items, make('callout_notes_close', 'ol', -1), make('callouts_close', 'div', -1));
  }
}

/** Each note opens with its number, drawn by the stylesheet so it doesn't copy. */
export function renderNote(tokens, i, opts, env, self) {
  const n = tokens[i].attrGet('data-callout');
  return `<li${self.renderAttrs(tokens[i])}><span class="callout" data-n="${n}"></span><span>`;
}

export const renderNoteClose = () => '</span></li>\n';

/** Hovering a line marks its notes, and a note its lines, for numbers up to `max`. */
export function hoverCss(max = 20) {
  const rules = [];
  for (let n = 1; n <= max; n++) {
    const on = `[data-callout~="${n}"]`;
    rules.push(`.callouts:has(${on}:hover) ${on}`);
  }
  return `${rules.join(',\n')} { background: var(--callout-hover); }\n`;
}

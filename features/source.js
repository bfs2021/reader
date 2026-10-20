/**
 * Helpers for features that read the source as written.
 *
 * Some syntax has to be found in the file before anything else reads it --
 * a checkbox or a field remembers the line it was written on, and the line
 * as written, to be edited later -- even when it ends up in an aside, which
 * is parsed apart from the rest. Such a feature reads each line first
 * (`readLines`, as a core rule before the asides feature's `aside_extract`), keeps
 * what it found on `env`, and leaves a placeholder in the text: a number
 * between two private-use characters, which markdown passes through
 * untouched. Once the text is parsed, it turns its placeholders into tokens
 * (`splitText`).
 */

// A fence's opening line, after the `>` of any blockquotes it's in and the
// markers of any list items; and the line that closes it.
const FENCE = /^((?:[ \t]*>)*)([ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+)*)(`{3,}|~{3,})/;
const QUOTES = /^(?:[ \t]*>)*/;
const CLOSING = /^[ \t]*(`{3,}|~{3,})[ \t]*$/;

/**
 * Adds `rule` to read the source before the asides come out, or after
 * normalizing it when the asides feature isn't in use.
 */
export function beforeAsides(md, name, rule) {
  try {
    md.core.ruler.before('aside_extract', name, rule);
  } catch {
    md.core.ruler.after('normalize', name, rule);
  }
}

/**
 * Keeps the source's lines as written in `env.written`, ahead of every
 * feature that reads the lines and may change them, for a feature that
 * writes one back.
 */
export function keepWritten(md) {
  if (md.core.ruler.__find__('written') >= 0) return;
  md.core.ruler.after('normalize', 'written', (state) => {
    if (!state.inlineMode && !state.env.__aside) state.env.written = state.src.split('\n');
  });
}

/**
 * Runs `fn(line, n, lines, i)` over each line of the source outside fenced
 * code, and puts back what it returns; `lines` are the source's lines as
 * they were, `i` this one's index among them. Skipped for an aside's own parse (its lines
 * were read with the rest) and for inline rendering. The line numbers count
 * from `env.lineBase`, the line of the file the text starts on.
 */
export function readLines(state, fn) {
  if (state.inlineMode || state.env.__aside) return;
  const base = state.env.lineBase ?? 0;
  const code = fenced();
  const lines = state.src.split('\n');
  state.src = lines.map((line, n) => (code(line) ? line : fn(line, base + n, lines, n))).join('\n');
}

/**
 * A reader of lines in turn, saying whether each is fenced code: a fence's
 * opening line, what's in it, or its closing line. A fence may be in a
 * blockquote or a list item, and ends with it: at a line with fewer `>`, or,
 * in a list item, at one indented less than the fence. A line indented as
 * code that reads as a fence is taken for one too, which it is, as code.
 */
export function fenced() {
  let fence = null;
  return (line) => {
    const quotes = (QUOTES.exec(line)[0].match(/>/g) ?? []).length;
    if (fence) {
      const rest = line.replace(QUOTES, '');
      const indent = /^[ \t]*/.exec(rest)[0].length;
      const out = quotes < fence.quotes || (fence.column != null && rest.trim() && indent < fence.column);
      if (!out) {
        const c = CLOSING.exec(rest);
        if (c && quotes === fence.quotes && c[1][0] === fence.mark[0] && c[1].length >= fence.mark.length) fence = null;
        return true;
      }
      fence = null;
    }
    const f = FENCE.exec(line);
    if (!f) return false;
    // Out of a list and not indented as code, a fence's lines may be indented less than it is.
    const inList = f[2].length > 3 || /[-*+\d]/.test(f[2]);
    fence = { mark: f[3], quotes, column: inList ? f[2].length : null };
    return true;
  };
}

/** The placeholder for item `k`, between `open` and `close`. */
export const placeholder = (open, close, k) => `${open}${k}${close}`;

/**
 * Splits each text child of each inline token at the placeholders `pattern`
 * finds (a global regex whose first group is the number), putting
 * `make(k, state)` in their place: a token, or null to leave the text.
 */
export function splitText(state, pattern, make) {
  for (const block of state.tokens) {
    if (block.type !== 'inline' || !block.children) continue;
    const out = [];
    for (const child of block.children) {
      pattern.lastIndex = 0;
      const found = child.type === 'text' && pattern.test(child.content);
      // matchAll starts from where test() left off.
      pattern.lastIndex = 0;
      if (!found) {
        out.push(child);
        continue;
      }
      let last = 0;
      for (const m of child.content.matchAll(pattern)) {
        const token = make(Number(m[1]), state);
        if (!token) continue;
        if (m.index > last) out.push(text(state, child.content.slice(last, m.index)));
        out.push(token);
        last = m.index + m[0].length;
      }
      if (last < child.content.length) out.push(text(state, child.content.slice(last)));
    }
    block.children = out;
  }
}

function text(state, content) {
  const t = new state.Token('text', '', 0);
  t.content = content;
  return t;
}

/** `&`, `<`, `>` and `"` escaped, for text. */
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * `&`, `"`, `<` and `>` escaped, for an attribute's value. A raw `>` would be
 * valid there, but later passes find tags with `<[^>]*>` and would end the
 * tag at it.
 */
export const escapeAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Adds `name` to a token's classes, after any it has; a token that had none
 * gets its class attribute first, as markdown writes it.
 */
export function addClass(token, name) {
  const had = token.attrGet('class');
  if (had) token.attrSet('class', `${had} ${name}`);
  else token.attrs = [['class', name], ...(token.attrs || [])];
}

/**
 * The sections of a parse, as its headings make them: `list` holds each,
 * `{ level, title, line, end, parent }`, the document's own first (level 0,
 * from its first line); `of[i]` is the section token `i` is in, a heading in
 * its own. `line` is where the section starts in the file and `end` where
 * the next heading at its level or above does (Infinity for none).
 */
export function sections(state) {
  const base = state.env.lineBase ?? 0;
  const lineOf = (t) => base + (state.env.sourceLines?.[t.map[0]] ?? t.map[0]);
  const top = { level: 0, title: '', line: base, end: Infinity, parent: null };
  const list = [top];
  const of = [];
  let at = top;
  state.tokens.forEach((t, i) => {
    if (t.type === 'heading_open' && t.map) {
      const level = Number(t.tag.slice(1));
      const line = lineOf(t);
      for (; at.level >= level; at = at.parent) at.end = line;
      const title = (state.tokens[i + 1]?.content ?? '').replace(/[\uE000-\uF8FF]\d*[\uE000-\uF8FF]?/g, '').trim();
      at = { level, title, line, end: Infinity, parent: at };
      list.push(at);
    }
    of[i] = at;
  });
  return { list, of };
}

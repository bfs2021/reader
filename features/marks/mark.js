/**
 * Reading a mark from the names in a style's braces (features/styles):
 * `[quick]{a}`, `[quick]{circle}`, `[quick]{a highlight}`. A topic's alias
 * marks the text in the topic's colour and style; a style names how it's
 * drawn. Kept apart from the marks feature itself so the styles feature
 * can read them without taking in the rest.
 */

import { STYLES } from '../asides/key.js';

/**
 * The names in braces -> `{ style, topic, rest }`, the names that aren't
 * the mark's left in `rest`; or null when none of them is a mark's. A
 * topic is a declared one's alias, one character, so `{a}` without a key
 * is a font, as it always was.
 */
export function marking(names, key) {
  let style = null;
  let topic = null;
  const rest = [];
  for (const name of names.trim().split(/\s+/)) {
    const entry = [...name].length === 1 ? key?.get(name) : null;
    if (STYLES.includes(name.toLowerCase())) style ??= name.toLowerCase();
    else if (entry?.kind === 'topic') topic ??= entry;
    else rest.push(name);
  }
  if (!style && !topic) return null;
  return { style: style ?? topic?.style ?? 'underline', topic, rest };
}

/**
 * Makes `token`, a span's opening, the mark: drawn in `style`, in `color` if
 * there is one. It's a mark to a screen reader, and its topic, if it has one,
 * is said with it and shows on hover, not only by its colour and pen.
 */
export function markSpan(token, { style, color, topic }) {
  token.attrJoin('class', `mk mk-${style}`);
  token.attrSet('role', 'mark');
  if (topic) token.attrSet('title', topic);
  if (color) token.attrSet('style', `--mk: ${color}`);
  token.meta = { ...token.meta, mark: { style, color } };
}

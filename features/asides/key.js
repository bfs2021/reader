/**
 * Who an aside is from, and what it's about: a document's key of one-
 * character aliases, declared in its front matter, one per line,
 *
 *   -----
 *   reviewer #: Josh
 *   reviewer m: Maria, teal
 *   topic c: Coherence
 *   topic v: Verbs, teal, circle
 *   -----
 *
 * and used in a run straight after an aside's `~`, in any order:
 *
 *   ~#c This contradicts §2.        Josh, about Coherence
 *
 * A colour after the name (a CSS name or `#hex`) is the alias's own, a
 * common name drawn in the family's hue for it (see `inFamily`), and a
 * topic can name how it marks the words its asides choose (`circle`,
 * `underline` or `highlight`; see features/marks); the
 * rest are dealt from a palette in the order they're declared, reviewers
 * from its start and topics from its end, so the two don't look paired. A run counts when its aliases are
 * declared, all but one at most: that one is taken for a slip of the
 * finger and shown as not declared. So `~word` in a document without a
 * key, or prose that happens to start with a `~` (`~approximately`), is
 * left as it was.
 */

const ENTRY = /^\s*(reviewer|topic)\s+(\S)\s*:\s*(.+?)\s*$/i;
const COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]+)$/i;

/** How a mark can be drawn: features/marks. */
export const STYLES = ['circle', 'underline', 'dotted', 'wavy', 'highlight'];

// The family's hues (src/columns.css), which read as text on the page,
// light or dark, and the page on them.
const PALETTE = Array.from({ length: 8 }, (_, i) => `var(--gm-key-${i + 1})`);

// The colour names an author is likely to write, each to the family's hue
// nearest it. The family's green is a teal, so a plain green is its moss.
const FAMILY = {
  red: ['red', 'crimson', 'maroon'],
  amber: ['amber', 'orange', 'gold', 'yellow', 'brown'],
  moss: ['moss', 'green', 'lime', 'olive'],
  green: ['teal', 'cyan', 'turquoise'],
  blue: ['blue', 'navy'],
  violet: ['violet', 'purple', 'indigo'],
  rose: ['rose', 'pink', 'magenta'],
  slate: ['slate', 'grey', 'gray'],
};
const HUES = new Map(Object.entries(FAMILY).flatMap(([hue, names]) => names.map((n) => [n, `var(--gm-${hue})`])));

/**
 * A colour an author names -> the family's hue for it, which reads as text
 * in light and dark (`gold` -> `var(--gm-amber)`); any other, a `#hex` or a
 * name not listed, as it's written, for the page to keep readable
 * (src/columns.css).
 */
export function inFamily(color) {
  return (color && HUES.get(color.toLowerCase())) || color;
}

/** A front matter line declaring an alias -> `{ kind, alias, name, color, style }`, or null. */
export function readEntry(line) {
  const m = ENTRY.exec(line);
  if (!m || m[2] === '~') return null;
  const [name, ...after] = m[3].split(/\s*,\s*/);
  if (!name) return null;
  let color = null;
  let style = null;
  for (const a of after) {
    if (STYLES.includes(a.toLowerCase())) style ??= a.toLowerCase();
    else if (COLOR.test(a)) color ??= a;
  }
  return { kind: m[1].toLowerCase(), alias: m[2], name, color, style };
}

/** Entries -> the key: each alias to its entry, with every colour filled in. */
export function makeKey(entries) {
  const key = new Map();
  const dealt = { reviewer: 0, topic: 0 };
  for (const e of entries) {
    if (key.has(e.alias)) continue;
    const k = dealt[e.kind]++ % PALETTE.length;
    key.set(e.alias, { ...e, color: inFamily(e.color) || PALETTE[e.kind === 'reviewer' ? k : PALETTE.length - 1 - k] });
  }
  return key;
}

/**
 * The run after an aside's `~` -> `{ who, topics, unknown }`: the first
 * reviewer named, the topics, and the alias not in the key, if one isn't;
 * or null when it isn't a run of aliases.
 */
export function attribute(run, key) {
  if (!run || !key?.size) return null;
  const chars = [...run];
  const declared = chars.filter((c) => key.has(c)).length;
  if (!declared || chars.length - declared > 1) return null;
  let who = null;
  const topics = [];
  const unknown = [];
  for (const c of chars) {
    const e = key.get(c);
    if (!e) unknown.push(c);
    else if (e.kind === 'reviewer') who ??= e;
    else if (!topics.includes(e)) topics.push(e);
  }
  return { who, topics, unknown };
}

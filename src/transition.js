/**
 * How one slide gives way to the next: `transition:` in the front matter,
 * for the whole deck, or in a slide's notes, for how that slide leaves, so
 * it's written just above the `---` it's about:
 *
 *   ---
 *   transition: fade
 *   ---
 *
 *   # First slide
 *
 *   <!-- transition: up -->
 *
 *   ---
 *
 *   # Second slide
 *
 * `up`, `down`, `left` and `right` are the way the slides move; `fade`; and
 * `none`, which is what a deck that doesn't say gets. Anything else isn't a
 * transition, so a note that reads "transition: now the demo" stays a note.
 * Going back plays it the other way round (`reversed`).
 */

const KINDS = new Set(['up', 'down', 'left', 'right', 'fade', 'none']);
const BACK = { up: 'down', down: 'up', left: 'right', right: 'left' };
const DIRECTIVE = /^[ \t]*transition[ \t]*:[ \t]*(.+?)[ \t]*$/i;

/** `up`, `Fade`, `"none"` -> the transition, or null when it isn't one. */
export function readTransition(value) {
  const text = String(value ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').toLowerCase();
  return KINDS.has(text) ? text : null;
}

/**
 * A slide's notes without their `transition:` line, and what it said:
 * `{ notes, transition }`, `transition` undefined when no line did.
 */
export function liftTransition(notes) {
  let transition;
  const kept = notes.split('\n').filter((line) => {
    const m = DIRECTIVE.exec(line);
    const read = m && readTransition(m[1]);
    if (!read) return true;
    transition = read;
    return false;
  });
  return { notes: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), transition };
}

/** `transition`, played backwards. */
export const reversed = (transition) => BACK[transition] ?? transition;

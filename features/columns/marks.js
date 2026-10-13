/**
 * The lines a `::: columns` block is left as, once the styles feature has
 * read the `:::` fences: its opening, each `+++` in it, and its closing. A
 * private-use character each, which markdown passes through untouched and
 * nothing else writes.
 */
export const OPEN = '\uE021';
export const DIVIDER = '\uE022';
export const CLOSE = '\uE023';

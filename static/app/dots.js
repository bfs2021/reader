/**
 * How a workbook's dots are laid out. A dot each, up to a few blocks' worth;
 * past that the pages go in blocks of ten, each drawn as one mark, with the
 * block the showing page is in opened out into its dots.
 */

export const BLOCK = 10;

/**
 * The marks for `count` pages with page `index` showing, in order: a page as
 * `{ page }`, a closed block as `{ from, to }` (`to` exclusive).
 */
export function layout(count, index, size = BLOCK) {
  if (count <= 2 * size) return Array.from({ length: count }, (_, page) => ({ page }));
  const open = Math.floor(index / size) * size;
  const marks = [];
  for (let from = 0; from < count; from += size) {
    const to = Math.min(count, from + size);
    if (from === open) for (let page = from; page < to; page++) marks.push({ page });
    else marks.push({ from, to });
  }
  return marks;
}

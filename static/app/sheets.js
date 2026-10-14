/**
 * Sheets: a deck's pages sized to fill the paper they're printed on.
 *
 * Exported, a deck's pages are drawn at reading size, a page to a sheet
 * (src/export.js), so a short page leaves most of its sheet empty. Before
 * it's printed, each page is scaled up, as a slide is fitted to its screen,
 * until it fills the sheet, so the boards are bigger and there's room to
 * write. One too long for its sheet runs on as it is.
 *
 * The page is laid out here as it will print -- its print styles applied,
 * in a window the size of the sheet inside its margins (src/columns.css),
 * for what's sized by the window -- since a frame can't be measured as it
 * prints.
 */

const INCH = 96;
// Letter, in inches inside its margins: 0.7 each side, 0.75 above, 0.85 below.
const UPRIGHT = [8.5 - 1.4, 11 - 1.6];
const TURNED = [11 - 1.4, 8.5 - 1.6];
// How far a page is scaled up to fill its sheet. Not down: a page is
// broken onto sheets by its size before it's scaled, so one scaled down
// would still run on.
const MOST = 2;

/** `html`, with its print styles always on and its screen styles off. */
export function asPrinted(html) {
  return html.replace(/@media\s+screen\b/g, '@media speech').replace(/@media\s+print\b/g, '@media all');
}

/** Whether the deck in `doc` prints its sheets turned, landscape. */
export function landscape(doc) {
  return [...doc.querySelectorAll('style')].some((s) => /@page numbered \{ size: landscape; \}/.test(s.textContent));
}

/**
 * Scales each page of the deck in `doc`, whose window is the size of
 * `sheet(doc)`, up to fill its sheet. A page scaled is laid out narrower by
 * as much, to keep to the sheet's width, and a sheet tall, so printing has
 * nothing in it to break. (With a transform, not `zoom`: Chrome fails to
 * print some decks of zoomed pages.)
 */
export function fill(doc) {
  const { width, height } = sheet(doc);
  // A little short of the sheet, for rounding.
  const room = height * 0.98;
  for (const page of doc.querySelectorAll('.gm-page')) {
    const fits = (scale) => {
      page.style.width = `${width / scale}px`;
      return page.offsetHeight * scale <= room;
    };
    if (!fits(1)) {
      // Too long for one sheet: it runs on, as it is.
      page.style.width = '';
      continue;
    }
    // The most it can be scaled and fit.
    let [lo, hi] = [1, MOST];
    if (fits(hi)) lo = hi;
    for (let k = 0; k < 7 && lo < hi; k++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    const scale = lo;
    page.style.width = `${width / scale}px`;
    page.style.height = `${room / scale}px`;
    // Nothing of it drawn on another sheet: a mark floated over its top
    // edge, say, onto the bottom of the one before.
    page.style.overflow = 'clip';
    page.style.transformOrigin = '0 0';
    page.style.transform = `scale(${scale})`;
  }
}

/** The sheet inside its margins, in CSS pixels. */
export function sheet(doc) {
  const [width, height] = landscape(doc) ? TURNED : UPRIGHT;
  return { width: width * INCH, height: height * INCH };
}

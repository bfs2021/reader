/**
 * Amounts as a cook writes them -- `2`, `1/2`, `1 1/2`, `½`, `1½`, `0.75`,
 * a range `1–2` -- read, multiplied, and written back the same way.
 */

const VULGAR = { '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4, '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5, '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };
const GLYPHS = Object.keys(VULGAR).join('');

// One number: a mixed fraction, a fraction, a decimal or a whole one.
const ONE = `(?:\\d+[ \\u00a0]\\d+/\\d+|\\d+/\\d+|\\d*[${GLYPHS}]|\\d+(?:\\.\\d+)?|\\.\\d+)`;
/** An amount at the start of a string: a number, or two with a dash between. */
export const AMOUNT = new RegExp(`^(${ONE})(?:([ \\u00a0]?[-–—][ \\u00a0]?|[ \\u00a0]to[ \\u00a0])(${ONE}))?(?![\\d/${GLYPHS}])`);

/** One number as written -> { value, kind } ('whole', 'fraction', 'glyph', 'decimal'), or null. */
export function readNumber(s) {
  let m;
  if ((m = /^(\d+)[ \u00a0](\d+)\/(\d+)$/.exec(s))) return Number(m[3]) ? { value: Number(m[1]) + Number(m[2]) / Number(m[3]), kind: 'fraction' } : null;
  if ((m = /^(\d+)\/(\d+)$/.exec(s))) return Number(m[2]) ? { value: Number(m[1]) / Number(m[2]), kind: 'fraction' } : null;
  if ((m = new RegExp(`^(\\d*)([${GLYPHS}])$`).exec(s))) return { value: Number(m[1] || 0) + VULGAR[m[2]], kind: 'glyph' };
  if (/^\d*\.\d+$/.test(s)) return { value: Number(s), kind: 'decimal' };
  if (/^\d+$/.test(s)) return { value: Number(s), kind: 'whole' };
  return null;
}

/** `value` written as `kind` was: a whole number or a fraction a cook measures, or a decimal. */
export function writeNumber(value, kind) {
  if (kind === 'decimal') return String(Math.round(value * 100) / 100);
  for (const d of [1, 2, 3, 4, 8]) {
    const n = Math.round(value * d);
    if (Math.abs(n / d - value) > 0.01 || !n) continue;
    const whole = Math.floor(n / d);
    const part = n % d;
    if (!part) return String(whole);
    if (kind === 'glyph') {
      const glyph = Object.keys(VULGAR).find((g) => Math.abs(VULGAR[g] - part / d) < 1e-9);
      return `${whole || ''}${glyph}`;
    }
    return whole ? `${whole} ${part}/${d}` : `${part}/${d}`;
  }
  return String(Math.round(value * 100) / 100);
}

/** An amount, `[low, dash, high]` as `AMOUNT` matched it, times `by`. */
export function multiply(m, by) {
  const one = (s) => {
    const n = readNumber(s.replace(/\u00a0/g, ' '));
    // A whole number halved is a fraction.
    return writeNumber(n.value * by, n.kind === 'whole' ? 'fraction' : n.kind);
  };
  return m[3] ? `${one(m[1])}${m[2]}${one(m[3])}` : one(m[1]);
}

/**
 * A multiplier's choices, as written in its brackets (`1/2, 2, 4`, `2x`),
 * -> [{ by, label }] in order, 1 among them; null if one isn't a number.
 * None written is 1, 2 and 3.
 */
export function readChoices(text) {
  const written = text.split(/[,\s]+/).map((s) => s.replace(/[x×]$/i, '')).filter(Boolean);
  const read = written.length ? written.map(readNumber) : [1, 2, 3].map((value) => ({ value, kind: 'whole' }));
  if (read.some((n) => !n || n.value <= 0)) return null;
  const values = [...new Set([1, ...read.map((n) => n.value)])].sort((a, b) => a - b);
  return values.map((by) => ({ by, label: `${writeNumber(by, 'glyph')}×` }));
}

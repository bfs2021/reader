/**
 * The features the renderer is built from, in the order their markdown-it
 * plugins are applied. Each is a directory here holding what it needs:
 *
 *   { name, plugin?, html?, css?, raw?, preview?, lazy? }
 *
 * - `plugin`: a markdown-it plugin.
 * - `html`: a pass over the finished page's HTML, for what the tokens don't
 *   reach (the masthead, say).
 * - `css`: added to the rendered page's stylesheet.
 * - `raw`: applied before render.js's own source pass, which the rest come
 *   after: a feature that reads the file as written, or asides, whose rule
 *   the others place theirs by.
 * - `preview`: the path of a script the server loads into the preview frame,
 *   where it can use static/preview-api.js, or a list of them, loaded in
 *   order.
 * - `lazy`: the path of a script, or a list of them, served for the preview
 *   frame to load itself, when a page needs it: a big one, say, that most
 *   pages don't.
 */

import asides from './asides/index.js';
import fields from './fields/index.js';
import tasks from './tasks/index.js';
import qa from './qa/index.js';
import sizes from './sizes/index.js';
import alerts from './alerts/index.js';
import attributions from './attributions/index.js';
import styles from './styles/index.js';
import date from './date/index.js';
import scripture from './scripture/index.js';
import scriptureLds from './scripture-lds/index.js';
import search from './search/index.js';
import social from './social/index.js';
import arrows from './arrows/index.js';
import math from './math/index.js';
import emoji from './emoji/index.js';
import puzzles from './puzzles/index.js';
import highlight from './highlight/index.js';
import mermaid from './mermaid/index.js';
import headline from './headline/index.js';

// styles comes after qa and attributions: a `:::` block marks a line after
// qa has made it a list item, and after an attribution's dash is marked, as
// it does any other. highlight comes before puzzles, which wraps the fence
// rule it finds, as mermaid and headline do. date comes after fields and tasks, so the lines
// they keep are as written, without its marks.
export const FEATURES = [asides, fields, tasks, qa, sizes, alerts, attributions, styles, date, scripture, scriptureLds, search, social, math, arrows, emoji, highlight, mermaid, headline, puzzles];

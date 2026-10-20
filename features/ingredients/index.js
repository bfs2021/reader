/**
 * Ingredients tied to the steps that use them. `!word` in a list item
 * names the item's key, as a definition's `!` names a term:
 *
 *   ### Ingredients
 *   * [ ] count:1 small yellow !onion, diced
 *
 *   ### Steps
 *   1) [ ] Add the diced onion and cook until soft.
 *
 * Elsewhere in the recipe the word is found on its own, as written or
 * plural or singular (onion, onions), without a `!`: it's marked, and
 * hovering it shows its item. An item whose key nothing else names is
 * flagged, as a step missing it is easy to miss.
 *
 * The recipe is the section around the list: the one with a multiplier
 * (features/count), or else the section the list's heading is under, if
 * it's under one deeper than the document's top headings (`## Akara` for
 * `### Ingredients`), or else the list's own. A `!` before a word a
 * definition defines is that definition's (features/definitions), and
 * `\!` keeps one as typed.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sections, escapeHtml, escapeAttr, addClass, textToken } from '../source.js';

const KEY = /(?<![\p{L}\p{N}_])!(\p{L}[\p{L}\p{N}'’-]*)/gu;

/** The ways `key` is written: as is, plural, singular. */
export function forms(key) {
  const k = key.toLowerCase();
  const all = new Set([k, `${k}s`, `${k}es`]);
  if (k.endsWith('y')) all.add(`${k.slice(0, -1)}ies`);
  if (k.endsWith('ies')) all.add(`${k.slice(0, -3)}y`);
  if (k.endsWith('es')) all.add(k.slice(0, -2));
  if (k.endsWith('s')) all.add(k.slice(0, -1));
  return [...all];
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function ingredients(md) {
  // Before an escaped `\!` joins the text after it, and after a defined
  // term's `!` has become its definition's (definitions runs first).
  md.core.ruler.before('text_join', 'ingredients', (state) => {
    if (state.inlineMode || state.env.__aside) return;
    const tokens = state.tokens;
    const { list, of } = sections(state);
    const top = Math.min(...list.filter((s) => s.level).map((s) => s.level));
    const scaled = new Set();
    tokens.forEach((t, i) => {
      if (t.type === 'inline' && t.children?.some((c) => c.type === 'multiplier')) scaled.add(of[i]);
    });
    const recipeOf = (section) => {
      for (let s = section; s; s = s.parent) if (scaled.has(s)) return s;
      return section.parent && section.level > top ? section.parent : section;
    };

    // The keys, each in the item it's written in.
    const items = [];
    const open = [];
    tokens.forEach((t, i) => {
      if (t.type === 'list_item_open') open.push({ token: t, i, keys: [] });
      else if (t.type === 'list_item_close') {
        const item = open.pop();
        if (item.keys.length) items.push(item);
      } else if (t.type === 'inline' && open.length) {
        const item = open.at(-1);
        eachText(t, (child) => split(state, child, KEY, (m) => {
          item.keys.push(m[1]);
          const key = new state.Token('ingredient_key', 'span', 0);
          key.content = m[1];
          return key;
        }));
      }
    });
    if (!items.length) return;

    const recipes = new Map();
    for (const item of items) {
      const recipe = recipeOf(of[item.i]);
      item.recipe = recipe;
      if (!recipes.has(recipe)) recipes.set(recipe, []);
      recipes.get(recipe).push(item);
      addClass(item.token, 'ingredient');
      item.token.attrSet('data-ingredient', item.keys.map((k) => k.toLowerCase()).join(' '));
      item.token.attrSet('data-recipe', String(recipe.line));
    }

    // The words elsewhere in each recipe, out of the items with keys.
    const inItem = new Set();
    for (const item of items) {
      let depth = 0;
      for (let j = item.i; j < tokens.length; j++) {
        if (tokens[j].type === 'list_item_open') depth++;
        if (tokens[j].type === 'list_item_close' && --depth === 0) break;
        inItem.add(j);
      }
    }
    const within = (s, recipe) => {
      for (; s; s = s.parent) if (s === recipe) return true;
      return false;
    };
    for (const [recipe, keyed] of recipes) {
      const byForm = new Map();
      for (const item of keyed) for (const key of item.keys) for (const f of forms(key)) byForm.set(f, key.toLowerCase());
      const find = new RegExp(`(?<![\\p{L}\\p{N}_!])(?:${[...byForm.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
      const used = new Set();
      tokens.forEach((t, i) => {
        if (t.type !== 'inline' || inItem.has(i) || !within(of[i], recipe)) return;
        eachText(t, (child) => split(state, child, find, (m) => {
          const key = byForm.get(m[0].toLowerCase());
          used.add(key);
          const use = new state.Token('ingredient_use', 'span', 0);
          use.content = m[0];
          use.meta = { key, recipe: recipe.line };
          return use;
        }));
      });
      for (const item of keyed) {
        if (item.keys.some((k) => used.has(k.toLowerCase()))) continue;
        addClass(item.token, 'ingredient-unused');
        item.token.attrSet('title', 'No step names this');
      }
    }
  });

  md.renderer.rules.ingredient_key = (tokens, i) => `<span class="ingredient-key">${escapeHtml(tokens[i].content)}</span>`;
  md.renderer.rules.ingredient_use = (tokens, i) => {
    const { key, recipe } = tokens[i].meta;
    return `<span class="ingredient-use" tabindex="0" data-ingredient="${escapeAttr(key)}" data-recipe="${recipe}">${escapeHtml(tokens[i].content)}</span>`;
  };
}

/** Calls `fn` on each text child of `inline` outside a link, putting in its place what it returns. */
function eachText(inline, fn) {
  const out = [];
  let link = 0;
  for (const child of inline.children ?? []) {
    if (child.type === 'link_open') link++;
    if (child.type === 'link_close') link--;
    out.push(...(child.type === 'text' && !link ? fn(child) : [child]));
  }
  inline.children = out;
}

/** `child`'s text split at each match of `pattern`, `make(m)` in its place. */
function split(state, child, pattern, make) {
  const out = [];
  let last = 0;
  for (const m of child.content.matchAll(pattern)) {
    const made = make(m);
    if (!made) continue;
    if (m.index > last) out.push(textToken(state, child.content.slice(last, m.index)));
    out.push(made);
    last = m.index + m[0].length;
  }
  if (!last) return [child];
  if (last < child.content.length) out.push(textToken(state, child.content.slice(last)));
  return out;
}

export default {
  name: 'ingredients',
  plugin: ingredients,
  css: fs.readFileSync(new URL('./ingredients.css', import.meta.url), 'utf8'),
  preview: fileURLToPath(new URL('./preview.js', import.meta.url)),
};

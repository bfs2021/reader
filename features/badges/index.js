/**
 * An ordered list written with `1)` in place of `1.` has its numbers drawn
 * as badges, as a code fence's callouts are:
 *
 *   1) Clone the repo
 *   2) Run `npm install`
 *
 * It numbers itself as any list does, from where its first item says. Each
 * item carries its number, so a list the asides cut in two keeps counting.
 */

import fs from 'node:fs';
import { addClass } from '../source.js';

export function badges(md) {
  md.core.ruler.push('badges', (state) => {
    // The next number of each list we're in, or null for one that isn't badges.
    const lists = [];
    for (const t of state.tokens) {
      if (t.type === 'ordered_list_open' || t.type === 'bullet_list_open') {
        const badged = t.type === 'ordered_list_open' && t.markup === ')';
        if (badged) addClass(t, 'badges');
        lists.push(badged ? Number(t.attrGet('start') ?? 1) : null);
      } else if (t.type === 'ordered_list_close' || t.type === 'bullet_list_close') {
        lists.pop();
      } else if (t.type === 'list_item_open' && lists.at(-1) != null) {
        t.attrSet('data-n', String(lists[lists.length - 1]++));
      }
    }
  });
}

export default {
  name: 'badges',
  plugin: badges,
  css: fs.readFileSync(new URL('./badges.css', import.meta.url), 'utf8'),
};

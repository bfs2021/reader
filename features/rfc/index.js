/**
 * `rfc:` links to the RFC Editor: `rfc:9110[]` and `rfc:9110#section-15.5[]`
 * are labelled "RFC 9110" and "RFC 9110 §15.5" unless the brackets say
 * otherwise.
 */

import { schemeLinks } from '../scheme.js';

const RFC_EDITOR = 'https://www.rfc-editor.org/rfc';

/** `path` is what follows the colon: the number, then any `#anchor`. */
export function rfcLink(path, label) {
  const [num, anchor] = path.split('#');
  const n = String(Number(num));
  const text = label.trim();
  const href = `${RFC_EDITOR}/rfc${n}.html${anchor ? `#${anchor}` : ''}`;
  if (text) return { href, label: text };
  const section = anchor && /^(section|appendix)-(.+)$/i.exec(anchor);
  if (!section) return { href, label: `RFC ${n}` };
  const where = section[1].toLowerCase() === 'section' ? `§${section[2]}` : `Appendix ${section[2]}`;
  return { href, label: `RFC ${n} ${where}` };
}

export function rfc(md) {
  schemeLinks(md, {
    name: 'rfc',
    scheme: 'rfc',
    path: /\d{1,5}(?:#[\w.-]+)?/,
    link: rfcLink,
  });
}

export default {
  name: 'rfc',
  plugin: rfc,
};

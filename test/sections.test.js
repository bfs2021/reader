import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outline, flatten, find } from '../static/app/sections.js';

const shape = (entries) => entries.map((e) => (e.children.length ? [e.title, shape(e.children)] : e.title));

const day = `---
title: DevNexus day 1
---

# Keynote: The Future of Java

Notes on the keynote.

---

# Spring Security 7

## Passkeys

They're in.

## Authorization changes

\`\`\`
# not a heading
---
\`\`\`

---

Lunch ideas, written down
- soup
`;

test('parts between --- are entries, named by their first heading or line, with headings under them', () => {
  const { entries, parts, talk } = outline(day);
  assert.equal(talk, false);
  assert.equal(parts.length, 3);
  assert.deepEqual(shape(entries), [
    'Keynote: The Future of Java',
    ['Spring Security 7', ['Passkeys', 'Authorization changes']],
    'Lunch ideas, written down',
  ]);
  const [keynote, security] = entries;
  assert.deepEqual([keynote.line, keynote.end], [3, 8]);
  // A heading runs to the next at its level, and not past its part.
  const [passkeys, authz] = security.children;
  assert.deepEqual([passkeys.line, passkeys.end], [12, 16]);
  assert.equal(authz.end, security.end);
});

test('without ---, the headings are the outline, nested by level', () => {
  const { entries } = outline('# Ideas\n\n## [x] One\n\ntext\n\n### Detail\n\n## **Two**\n\n#### too deep\n');
  assert.deepEqual(shape(entries), [['Ideas', [['One', ['Detail']], 'Two']]]);
  const two = entries[0].children[1];
  assert.equal(two.end, 12);
});

test('in a talk, slides are entries, gathered under a section\'s title slide', () => {
  const talk = [
    '# Opening', '', '## not listed', '<!-- hello -->',
    '---', '# Part one',
    '---', '# Slide A', 'text',
    '---', 'An image slide',
    '---', '# Part two', '<!-- a note -->',
    '---', '## Slide B',
  ].join('\n');
  const { entries, talk: isTalk } = outline(talk);
  assert.equal(isTalk, true);
  assert.deepEqual(shape(entries), ['Opening', ['Part one', ['Slide A', 'An image slide']], ['Part two', ['Slide B']]]);
  assert.deepEqual([entries[1].line, entries[1].end], [5, 11]);
});

test('a heading in a note or a code fence is not an entry', () => {
  const { entries } = outline('# One\n<!--\n# hidden\n-->\n```md\n# code\n```\n# Two\n');
  assert.deepEqual(shape(entries), ['One', 'Two']);
});

test('find puts the start of a title first, then a word in it, then letters in order', () => {
  const { entries } = outline('# Authorization\n# Spring Security\n# Security\n# Something Else Close\n');
  assert.deepEqual(find(entries, 'sec').map((e) => e.title), ['Security', 'Spring Security', 'Something Else Close']);
  assert.equal(flatten(entries).length, 4);
});

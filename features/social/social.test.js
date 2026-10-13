import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';
import { socialLink } from './index.js';

test('each site has its address, and its way of writing a name', () => {
  assert.deepEqual(socialLink('linkedin', 'jzheaux', ''), { href: 'https://www.linkedin.com/in/jzheaux', label: 'linkedin.com/in/jzheaux' });
  assert.deepEqual(socialLink('linkedin', 'company/vmware', ''), { href: 'https://www.linkedin.com/company/vmware', label: 'linkedin.com/company/vmware' });
  assert.deepEqual(socialLink('bluesky', 'jzheaux', ''), { href: 'https://bsky.app/profile/jzheaux.bsky.social', label: '@jzheaux.bsky.social' });
  assert.deepEqual(socialLink('bluesky', '@jzheaux.dev', ''), { href: 'https://bsky.app/profile/jzheaux.dev', label: '@jzheaux.dev' });
  assert.deepEqual(socialLink('gh', 'jzheaux', ''), { href: 'https://github.com/jzheaux', label: 'github.com/jzheaux' });
  assert.deepEqual(socialLink('fb', 'jzheaux', ''), { href: 'https://www.facebook.com/jzheaux', label: 'facebook.com/jzheaux' });
  assert.deepEqual(socialLink('insta', 'jzheaux', ''), { href: 'https://www.instagram.com/jzheaux', label: '@jzheaux' });
  assert.deepEqual(socialLink('yt', '@jzheaux', ''), { href: 'https://www.youtube.com/@jzheaux', label: '@jzheaux' });
  assert.deepEqual(socialLink('gh', 'jzheaux', ' my GitHub '), { href: 'https://github.com/jzheaux', label: 'my GitHub' });
  assert.equal(socialLink('gh', '', ''), null);
});

test('a profile is a link marked with its site', () => {
  const { body } = render('Find me: linkedin:jzheaux[] and gh:jzheaux[*here*], not `yt:x[]`, sigh:x[] or gh:[]\n');
  assert.match(body, /<a class="social social-linkedin" href="https:\/\/www\.linkedin\.com\/in\/jzheaux">linkedin\.com\/in\/jzheaux<\/a>/);
  assert.match(body, /<a class="social social-gh" href="https:\/\/github\.com\/jzheaux"><em>here<\/em><\/a>/);
  assert.match(body, /<code>yt:x\[\]<\/code>, sigh:x\[\] or gh:\[\]/);
});

test('every site\'s mark is in the stylesheet', () => {
  const { css } = render('x\n');
  for (const scheme of ['linkedin', 'bluesky', 'gh', 'fb', 'insta', 'yt']) {
    assert.match(css, new RegExp(`a\\.social-${scheme}::before \\{ --mark: url\\("data:image/svg\\+xml,%3Csvg viewBox=%220 0 24 24%22`));
  }
  assert.match(css, /a\.social-gh::before \{ --mark: url\([^)]*\); \}/, 'GitHub\'s is the text\'s own color');
});

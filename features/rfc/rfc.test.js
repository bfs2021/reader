import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../src/render.js';

test('rfc: links to the RFC Editor', () => {
  const link = (src) => render(src).body.match(/<p>([\s\S]*?)<\/p>/)[1];
  assert.equal(link('rfc:9110[]'), '<a href="https://www.rfc-editor.org/rfc/rfc9110.html">RFC 9110</a>');
  assert.equal(
    link('rfc:9110#section-15.5[]'),
    '<a href="https://www.rfc-editor.org/rfc/rfc9110.html#section-15.5">RFC 9110 §15.5</a>',
  );
  assert.equal(
    link('rfc:6749#appendix-A[]'),
    '<a href="https://www.rfc-editor.org/rfc/rfc6749.html#appendix-A">RFC 6749 Appendix A</a>',
  );
  assert.equal(link('rfc:6749[OAuth *2.0*]'), '<a href="https://www.rfc-editor.org/rfc/rfc6749.html">OAuth <em>2.0</em></a>');
  for (const src of ['`rfc:9110[]`', 'rfc:9110 alone', 'xrfc:9110[]', '\\rfc:9110[]']) {
    assert.doesNotMatch(render(src).body, /rfc-editor/);
  }
  assert.doesNotMatch(render('```\nrfc:9110[]\n```\n').body, /rfc-editor/);
});

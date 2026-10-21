import { test } from 'node:test';
import assert from 'node:assert/strict';
import { file, globals } from './dom.js';

const { document } = globals(file('static/index.html'));
const { el } = await import('../static/app/state.js');
const { toggleSidebar, toggleHelp, wireDrawer } = await import('../static/app/modes.js');
wireDrawer();

test('☰ says whether the file list is showing', () => {
  assert.equal(el.sidebarToggle.getAttribute('aria-expanded'), 'true');
  toggleSidebar();
  assert.equal(el.sidebarToggle.getAttribute('aria-expanded'), 'false');
  toggleSidebar();
  assert.equal(el.sidebarToggle.getAttribute('aria-expanded'), 'true');
});

test('hiding the list with the keyboard in it leaves the keyboard on ☰', () => {
  el.filter.focus();
  toggleSidebar(true);
  assert.equal(document.activeElement, el.sidebarToggle);
  toggleSidebar(false);
});

test('what a control is called is said in words, not by a mark', () => {
  const name = (node) => node.getAttribute('aria-label') || node.textContent.trim();
  assert.equal(name(el.gutterToggle), 'Line numbers');
  assert.equal(name(el.sidebar), 'Files');
  assert.equal(name(el.newName), 'New file\'s name');
  assert.equal(name(el.editor), 'Editor');
  assert.equal(el.dirtyDot.querySelector(':not([aria-hidden])').textContent, 'Not saved');
});

test('Formatting says whether the help is showing', () => {
  assert.equal(el.helpToggle.getAttribute('aria-expanded'), 'false');
  toggleHelp();
  assert.equal(el.help.hidden, false);
  assert.equal(el.helpToggle.getAttribute('aria-expanded'), 'true');
  toggleHelp();
  assert.equal(el.help.hidden, true);
  assert.equal(el.helpToggle.getAttribute('aria-expanded'), 'false');
});

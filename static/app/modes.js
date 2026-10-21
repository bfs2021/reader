/**
 * The layout: the file list shown or hidden, and work mode.
 */

import { el, state, deck, dirty } from './state.js';
import { save } from './saving.js';
import { renderNow } from './render.js';
import { openAt } from './pages.js';

// At this width and under the list doesn't fit beside the panes, so ☰ and
// ⌘\ open it over them instead; picking a file, Esc or a click elsewhere
// closes it again.
const NARROW = matchMedia('(max-width: 900px)');

export function toggleSidebar(force) {
  if (NARROW.matches && force === undefined) return toggleDrawer();
  const hide = force ?? !el.split.classList.contains('no-sidebar');
  el.split.classList.toggle('no-sidebar', hide);
  // The keyboard isn't left in a list that's gone.
  if (hide && el.sidebar.contains(document.activeElement)) el.sidebarToggle.focus();
  listShown();
  try { localStorage.setItem('reader:sidebar', hide ? 'hidden' : 'shown'); } catch { /* ignore */ }
}

/** The list over the panes, open or not, at a narrow width. */
export function toggleDrawer(open = !el.split.classList.contains('list-open')) {
  el.split.classList.toggle('list-open', open);
  listShown();
  if (open) el.filter.focus();
  else if (el.sidebar.contains(document.activeElement)) el.sidebarToggle.focus();
}

/** ☰ says whether the list is showing: beside the panes, or over them at a narrow width. */
function listShown() {
  const shown = NARROW.matches ? el.split.classList.contains('list-open') : !el.split.classList.contains('no-sidebar');
  el.sidebarToggle.setAttribute('aria-expanded', String(shown));
}

export function toggleHelp(show = el.help.hidden) {
  el.help.hidden = !show;
  el.helpToggle.setAttribute('aria-expanded', String(show));
}

export function wireDrawer() {
  const close = () => {
    if (el.split.classList.contains('list-open')) toggleDrawer(false);
  };
  NARROW.addEventListener('change', () => {
    close();
    listShown();
  });
  el.sidebar.addEventListener('click', (e) => {
    if (e.target.closest('.file')) close();
  });
  el.sidebar.addEventListener('keydown', (e) => {
    // Heard before the filter clears itself on Esc: only an empty one closes the list.
    if (e.key === 'Escape' && !(e.target.matches('input') && e.target.value)) close();
  }, { capture: true });
  document.addEventListener('pointerdown', (e) => {
    if (!el.sidebar.contains(e.target) && !el.sidebarToggle.contains(e.target)) close();
  });
  listShown();
}

export function restoreLayout() {
  try {
    if (localStorage.getItem('reader:sidebar') === 'hidden') toggleSidebar(true);
    if (localStorage.getItem('reader:help') === 'shown') toggleHelp(true);
    // 'read' is what work mode was called.
    if (['work', 'read'].includes(localStorage.getItem('reader:mode'))) setWorking(true);
    deck.notes = localStorage.getItem('reader:notes') === 'shown';
  } catch { /* ignore */ }
}

/**
 * Work mode: the rendered page full width, to read and to fill in, the
 * editor out of reach. A deck is a workbook there, a page at a time
 * (pages.js), opened on the page the cursor was on.
 */
export function setWorking(on) {
  const changed = state.working !== on;
  state.working = on;
  el.split.classList.toggle('work-mode', on);
  el.editor.readOnly = on || deck.open;
  el.workBtn.textContent = on ? 'Edit' : 'Work';
  el.workBtn.title = on ? 'Back to editing (⌘. or Esc)' : 'Work through it without editing (⌘.)';
  if (changed) {
    if (on) openAt(el.editor.value.slice(0, el.editor.selectionStart).split('\n').length - 1);
    renderNow();
  }
  if (on) {
    if (document.activeElement === el.editor) el.editor.blur();
    if (dirty()) save();
  } else if (state.current?.type === 'md' && !deck.open) {
    el.editor.focus({ preventScroll: true });
  }
  try { localStorage.setItem('reader:mode', on ? 'work' : 'edit'); } catch { /* ignore */ }
}

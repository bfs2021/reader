/**
 * The layout: the file list shown or hidden, and work mode.
 */

import { el, state, deck, dirty } from './state.js';
import { save } from './saving.js';
import { renderNow } from './render.js';
import { openAt } from './pages.js';

export function toggleSidebar(force) {
  const hide = force ?? !el.split.classList.contains('no-sidebar');
  el.split.classList.toggle('no-sidebar', hide);
  try { localStorage.setItem('reader:sidebar', hide ? 'hidden' : 'shown'); } catch { /* ignore */ }
}

export function restoreLayout() {
  try {
    if (localStorage.getItem('reader:sidebar') === 'hidden') toggleSidebar(true);
    if (localStorage.getItem('reader:help') === 'shown') el.help.hidden = false;
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

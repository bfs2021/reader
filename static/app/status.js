/**
 * The bits of status around the editor: saved or not, word count, where the cursor is, toasts.
 */

import { el, state, dirty } from './state.js';

let stateTimer = 0;
export function setSaveState(text, cls = '') {
  el.saveState.textContent = text;
  el.saveState.className = `save-state ${cls}`;
  clearTimeout(stateTimer);
  if (cls === 'ok') stateTimer = setTimeout(() => { el.saveState.textContent = ''; }, 1800);
}

export function updateDirty() {
  el.dirtyDot.hidden = !dirty();
}

export function updateCounts() {
  const text = el.editor.value;
  const words = (text.match(/\S+/g) || []).length;
  const asides = (text.match(/^\s*~(\s|$)/gm) || []).length;
  el.counts.textContent = state.current?.type === 'md'
    ? `${words} word${words === 1 ? '' : 's'}${asides ? ` · ${asides} aside${asides === 1 ? '' : 's'}` : ''}`
    : '';
  updateCursor();
}

/** The line and character the cursor is at, both counted from 1; of a selection, the end that moves. */
export function updateCursor() {
  const t = el.editor;
  if (state.current?.type !== 'md') {
    el.cursor.textContent = '';
    return;
  }
  const at = t.selectionDirection === 'backward' ? t.selectionStart : t.selectionEnd;
  const before = t.value.slice(0, at);
  const lineStart = before.lastIndexOf('\n') + 1;
  const line = (before.match(/\n/g) || []).length + 1;
  el.cursor.textContent = `line ${line}, character ${at - lineStart + 1}`;
}

let toastTimer = 0;
export function toast(msg, isError = false, action = null) {
  el.toast.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.addEventListener('click', () => {
      el.toast.hidden = true;
      action.run();
    });
    el.toast.append(' ', b);
  }
  el.toast.className = `toast${isError ? ' err' : ''}`;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, isError || action ? 6000 : 2800);
}

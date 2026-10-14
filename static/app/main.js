/**
 * The app: a sidebar of files, the editor, the rendered page beside it, and
 * work mode and presenting. Each part is a module here; this one starts it
 * and connects the page's events and keys to them.
 */

import { el, state, deck, dirty } from './state.js';
import { api } from './api.js';
import { dirOf } from './versions.js';
import { loadTree, drawTree, visiblePaths, step, open, createFile, showNewForm, go, reveal, rememberedDir, onListKey, onListDoubleClick } from './files.js';
import { whenReady, showEmpty } from './render.js';
import { save, reloadFromDisk, checkDisk } from './saving.js';
import { toast, updateCursor } from './status.js';
import { replaceSelection, wrap, insertLink, toLineEdge, applyEdit, onEditorInput } from './editing.js';
import { toggleSidebar, restoreLayout, setWorking } from './modes.js';
import { wirePages, paged, turn } from './pages.js';
import { present, back, next, deckKey, onSpeakerMessage } from './deck.js';
import { wireFit } from './fit.js';
import { wireSync } from './sync.js';
import { printDocument } from './exporting.js';
import { wireLines, copyLines, goToLines } from './lines.js';

state.previewReady = whenReady(el.preview);
deck.stageReady = whenReady(el.stage);

init().catch((err) => toast(`startup: ${err.message}`, true));

async function init() {
  wire();
  restoreLayout();
  const info = await api('GET', '/api/info');
  state.rootName = info.name;
  state.root = info.root;
  el.rootName.textContent = info.name;
  el.rootName.title = info.root;
  await loadTree();
  go(rememberedDir(), null, { focus: false });

  // The file in the address, or the one last changed in the folder last shown.
  // The address can name lines too, as a copied one does: `#notes/talk.md:13-18`.
  const [, wanted, line, last] = decodeURIComponent(location.hash.slice(1)).match(/^(.*?)(?::(\d+)(?:-(\d+))?)?$/);
  const under = state.files.filter((f) => dirOf(f.path) === state.dir);
  const first = state.files.find((f) => f.path === wanted)
    || under.find((f) => f.type === 'md') || state.files.find((f) => f.type === 'md') || state.files[0];
  if (first) {
    reveal(first.path);
    await open(first.path);
    if (first.path === wanted && line) goToLines(Number(line), Number(last || line));
  } else showEmpty('No markdown files here yet. Press New to start one.');
}

function wire() {
  el.editor.addEventListener('input', onEditorInput);
  // Heard on the document, where every browser reports the editor's cursor moving.
  document.addEventListener('selectionchange', updateCursor);
  window.addEventListener('message', (e) => {
    // The stage takes the mouse, for image previews, so it hands back the
    // keys and clicks that drive the deck.
    if (deck.open && e.source === el.stage.contentWindow) {
      if (e.data?.type === 'key') deckKey(e.data);
      else if (e.data?.type === 'click') (e.data.left ? back : next)();
      else if (e.data?.type === 'edit') applyEdit(e.data, { fromStage: true });
      return;
    }
    if (e.source !== el.preview.contentWindow) return;
    if (e.data?.type === 'edit') applyEdit(e.data);
    else if (e.data?.type === 'swipe') turn(e.data.by);
    else if (e.data?.type === 'key') onKey({ ...e.data, preventDefault() {} });
  });

  el.workBtn.addEventListener('click', () => setWorking(!state.working));
  wirePages();
  wireFit();
  el.presentBtn.addEventListener('click', present);
  el.deck.addEventListener('click', (e) => {
    if (e.target.closest('.deck-notes, .deck-foot')) return;
    (e.clientX < window.innerWidth / 3 ? back : next)();
  });
  if ('BroadcastChannel' in window) {
    deck.channel = new BroadcastChannel('reader-deck');
    deck.channel.addEventListener('message', onSpeakerMessage);
  }
  wireSync();
  wireLines();

  el.filter.addEventListener('input', drawTree);
  el.files.addEventListener('keydown', onListKey);
  el.files.addEventListener('dblclick', onListDoubleClick);
  el.filter.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      el.files.querySelector('.file, .folder')?.focus();
    } else if (e.key === 'Enter') {
      const first = visiblePaths()[0];
      if (first) open(first);
    } else if (e.key === 'Escape') {
      el.filter.value = '';
      drawTree();
    }
  });

  el.newBtn.addEventListener('click', () => {
    if (el.newForm.hidden) showNewForm();
    else el.newForm.hidden = true;
  });
  el.newForm.addEventListener('submit', (e) => {
    e.preventDefault();
    createFile(el.newName.value.trim());
  });
  el.newName.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') el.newForm.hidden = true;
  });

  el.sidebarToggle.addEventListener('click', () => toggleSidebar());
  el.helpToggle.addEventListener('click', () => {
    el.help.hidden = !el.help.hidden;
    try { localStorage.setItem('reader:help', el.help.hidden ? 'hidden' : 'shown'); } catch { /* ignore */ }
  });

  el.reloadBtn.addEventListener('click', () => reloadFromDisk().catch((e) => toast(e.message, true)));
  el.overwriteBtn.addEventListener('click', () => save({ explicit: true, force: true }));

  window.addEventListener('focus', checkDisk);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && dirty()) save();
    else if (document.visibilityState === 'visible') checkDisk();
  });
  window.addEventListener('beforeunload', (e) => {
    if (!dirty() || state.conflict) return;
    // Best effort: a keepalive request outlives the page.
    fetch('/api/file', {
      method: 'PUT',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: state.current.path, text: el.editor.value, baseMtime: state.mtime }),
    });
    e.preventDefault();
  });

  window.addEventListener('keydown', onKey);
}

/** Prints the open document, saved first, as its HTML file prints. */
async function print() {
  if (dirty()) {
    await save();
    if (dirty()) return toast('not saved, so not printed', true);
  }
  try {
    await printDocument(state.current.path);
  } catch (err) {
    toast(`print: ${err.message}`, true);
  }
}

function onKey(e) {
  const meta = e.metaKey || e.ctrlKey;
  const key = e.key.toLowerCase();
  if (deck.open) {
    if (deckKey(e)) e.preventDefault();
    return;
  }
  if (meta && !e.altKey && e.code === 'Period') {
    e.preventDefault();
    if (e.shiftKey) present();
    else setWorking(!state.working);
    return;
  }
  if (state.working && e.key === 'Escape') { setWorking(false); return; }
  if (paged() && e.altKey && !meta && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    turn(e.key === 'ArrowLeft' ? -1 : 1);
    return;
  }
  if (meta && !e.altKey && key === 's') { e.preventDefault(); save({ explicit: true }); return; }
  if (meta && !e.altKey && !e.shiftKey && key === 'p' && state.current?.type === 'md') { e.preventDefault(); print(); return; }
  if (meta && e.shiftKey && !e.altKey && key === 'c' && state.current?.type === 'md') { e.preventDefault(); copyLines(); return; }
  if (meta && e.key === '\\') { e.preventDefault(); toggleSidebar(); return; }
  if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); step(-1); return; }
  if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); step(1); return; }

  if (document.activeElement !== el.editor) return;
  if (meta && !e.shiftKey && key === 'b') { e.preventDefault(); wrap('**', '**'); return; }
  if (meta && !e.shiftKey && key === 'i') { e.preventDefault(); wrap('*', '*'); return; }
  if (meta && !e.shiftKey && key === 'k') { e.preventDefault(); insertLink(); return; }
  if ((e.key === 'Home' || e.key === 'End') && !meta && !e.altKey) {
    e.preventDefault();
    toLineEdge(e.key === 'End', e.shiftKey);
    return;
  }
  if (e.key === 'Tab' && !meta && !e.altKey && el.editor.selectionStart === el.editor.selectionEnd && !e.shiftKey) {
    e.preventDefault();
    replaceSelection('  ');
  }
}

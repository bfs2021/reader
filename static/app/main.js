/**
 * The app: a sidebar of files, the editor, the rendered page beside it, and
 * work mode and presenting. Each part is a module here; this one starts it
 * and connects the page's events and keys to them.
 */

import { el, state, deck, dirty } from './state.js';
import { api } from './api.js';
import { dirOf } from './versions.js';
import { loadTree, drawTree, visiblePaths, step, open, follow, createFile, showNewForm, go, reveal, rememberedDir, onListKey, onListDoubleClick } from './files.js';
import { whenReady, showEmpty } from './render.js';
import { save, saveFirst, saveOnLeave, reloadFromDisk, checkDisk } from './saving.js';
import { toast, updateCursor } from './status.js';
import { replaceSelection, wrap, insertLink, toLineEdge, applyEdit, onEditorInput } from './editing.js';
import { toggleSidebar, toggleDrawer, toggleHelp, wireDrawer, restoreLayout, setWorking } from './modes.js';
import { wirePages, paged, turn } from './pages.js';
import { present, back, next, deckKey, onSpeakerMessage } from './deck.js';
import { wireFit } from './fit.js';
import { wireSync } from './sync.js';
import { printDocument } from './exporting.js';
import { wireLines, copyLines, goToLines } from './lines.js';
import { wireOutline } from './outline.js';
import { wireGoTo, openGoTo, isGoTo } from './goto.js';

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
  const { wanted, line, last } = fromHash();
  const under = state.files.filter((f) => dirOf(f.path) === state.dir);
  const first = state.files.find((f) => f.path === wanted)
    || under.find((f) => f.type === 'md') || state.files.find((f) => f.type === 'md') || state.files[0];
  if (first) {
    reveal(first.path);
    await open(first.path);
    if (first.path === wanted && line) goToLines(line, last);
  } else showEmpty('No markdown files here yet. Press New to start one.');
  window.addEventListener('hashchange', followHash);
}

/**
 * The address can name a file and lines, as a copied one does: `#notes/talk.md:13-18`.
 * One that doesn't decode names nothing.
 */
function fromHash() {
  let hash;
  try {
    hash = decodeURIComponent(location.hash.slice(1));
  } catch {
    return {};
  }
  const [, wanted, line, last] = hash.match(/^(.*?)(?::(\d+)(?:-(\d+))?)?$/);
  return { wanted, line: line && Number(line), last: Number(last || line) };
}

/** An address changed after loading, by a link or by hand: open what it names. */
async function followHash() {
  const { wanted, line, last } = fromHash();
  if (!state.files.some((f) => f.path === wanted)) return;
  if (wanted !== state.current?.path) {
    reveal(wanted);
    await open(wanted);
  }
  if (wanted === state.current?.path && line) goToLines(line, last);
}

function wire() {
  el.editor.addEventListener('input', onEditorInput);
  // Heard on the document, where every browser reports the editor's cursor moving.
  document.addEventListener('selectionchange', updateCursor);
  window.addEventListener('message', (e) => {
    // The stage takes the mouse, for image previews, so it hands back the
    // keys and clicks that drive the deck.
    if (deck.open && e.source === el.stage.contentWindow) {
      if (e.data?.type === 'key') (isGoTo(e.data) ? openGoTo : deckKey)(e.data);
      else if (e.data?.type === 'click') (e.data.left ? back : next)();
      else if (e.data?.type === 'edit') applyEdit(e.data, { fromStage: true });
      else if (e.data?.type === 'untab') el.deck.focus();
      return;
    }
    if (e.source !== el.preview.contentWindow) return;
    if (e.data?.type === 'edit') applyEdit(e.data);
    else if (e.data?.type === 'swipe') turn(e.data.by);
    else if (e.data?.type === 'follow') follow(e.data.href);
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
  wireOutline();
  wireGoTo();
  wireDrawer();

  el.filter.addEventListener('input', drawTree);
  el.files.addEventListener('keydown', onListKey);
  el.files.addEventListener('dblclick', onListDoubleClick);
  el.filter.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      el.files.querySelector('.file, .folder')?.focus();
    } else if (e.key === 'Enter') {
      const first = visiblePaths()[0];
      if (first) {
        open(first);
        toggleDrawer(false);
      }
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
    if (e.key !== 'Escape') return;
    el.newForm.hidden = true;
    el.newBtn.focus();
  });

  el.sidebarToggle.addEventListener('click', () => toggleSidebar());
  el.helpToggle.addEventListener('click', () => {
    toggleHelp();
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
    if (!dirty()) return;
    e.preventDefault();
    // In a conflict the edits can't be saved over the other, only kept here.
    if (state.conflict) return;
    saveOnLeave();
  });

  window.addEventListener('keydown', onKey);
}

/** Prints the open document, saved first, as its HTML file prints. */
async function print() {
  if (!(await saveFirst())) return toast('not saved, so not printed', true);
  try {
    await printDocument(state.current.path);
  } catch (err) {
    toast(`print: ${err.message}`, true);
  }
}

let tabLeaves = false;

function onKey(e) {
  const meta = e.metaKey || e.ctrlKey;
  // Tab indents in the editor, unless it's just after Esc: then it goes on
  // to what's next, as Tab does elsewhere.
  const leaving = tabLeaves;
  tabLeaves = e.key === 'Escape' && !meta && !e.altKey && !e.shiftKey;
  const key = e.key.toLowerCase();
  if (isGoTo(e)) {
    e.preventDefault();
    openGoTo();
    return;
  }
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
  // ⌘⌥, not ⌥ alone, which moves by a paragraph where there's typing.
  if (meta && e.altKey && !e.shiftKey && e.key === 'ArrowUp') { e.preventDefault(); step(-1); return; }
  if (meta && e.altKey && !e.shiftKey && e.key === 'ArrowDown') { e.preventDefault(); step(1); return; }

  if (document.activeElement !== el.editor) return;
  if (meta && !e.shiftKey && key === 'b') { e.preventDefault(); wrap('**', '**'); return; }
  if (meta && !e.shiftKey && key === 'i') { e.preventDefault(); wrap('*', '*'); return; }
  if (meta && !e.shiftKey && key === 'k') { e.preventDefault(); insertLink(); return; }
  if ((e.key === 'Home' || e.key === 'End') && !meta && !e.altKey) {
    e.preventDefault();
    toLineEdge(e.key === 'End', e.shiftKey);
    return;
  }
  if (e.key === 'Tab' && !leaving && !meta && !e.altKey && el.editor.selectionStart === el.editor.selectionEnd && !e.shiftKey) {
    e.preventDefault();
    replaceSelection('  ');
  }
}

/**
 * The file list, a folder at a time, and opening, creating and branching
 * files. versions.js works out which files are versions of which.
 */

import { el, state, dirty } from './state.js';
import { api, exportUrl } from './api.js';
import { save, setConflict } from './saving.js';
import { exportDocument } from './exporting.js';
import { showPdf } from './pdf.js';
import { renderNow, showPreview } from './render.js';
import { setSaveState, updateCounts, toast } from './status.js';
import { updatePresentable } from './deck.js';
import { folderView, filtered, findGroup, groupOf, hasFolder, dirOf, splitPath } from './versions.js';

export async function loadTree() {
  const { files } = await api('GET', '/api/tree');
  state.files = files;
  drawTree();
}

/**
 * One folder at a time, its files by name and then the folders under it;
 * or one file's versions; or, while filtering, every match in one flat list.
 */
export function drawTree() {
  // Redrawn under the keyboard (the list reloads when the window gets focus),
  // the row that had focus keeps it.
  const had = el.files.contains(document.activeElement) ? document.activeElement : null;
  const same = had && (had.dataset.group ? `.group[data-group="${CSS.escape(had.dataset.group)}"]`
    : had.dataset.path ? `.file[data-path="${CSS.escape(had.dataset.path)}"]`
    : had.dataset.dir ? `.folder[data-dir="${CSS.escape(had.dataset.dir)}"]` : null);
  drawRows();
  if (same) el.files.querySelector(same)?.focus();
}

function drawRows() {
  const q = el.filter.value.trim().toLowerCase();
  while (!hasFolder(state.files, state.dir)) state.dir = dirOf(state.dir);
  if (state.group && !findGroup(state.files, state.dir, state.group)) state.group = null;
  el.files.replaceChildren();
  drawCrumbs(!q);

  if (q) {
    for (const row of filtered(state.files, q)) el.files.append(rowItem(row, { dir: row.dir }));
    return;
  }
  if (state.group) {
    const group = findGroup(state.files, state.dir, state.group);
    for (const v of group.versions) el.files.append(versionItem(group, v));
    return;
  }
  const { rows, folders } = folderView(state.files, state.dir);
  for (const row of rows) el.files.append(rowItem(row));
  for (const name of folders) el.files.append(folderItem(name));
}

function drawCrumbs(shown) {
  const parts = state.dir ? state.dir.split('/') : [];
  el.crumbs.hidden = !shown || (!parts.length && !state.group);
  el.crumbs.replaceChildren();
  if (el.crumbs.hidden) return;
  const steps = [{ label: state.rootName, dir: '', group: null }];
  parts.forEach((part, i) => steps.push({ label: part, dir: parts.slice(0, i + 1).join('/'), group: null }));
  if (state.group) steps.push({ label: state.group, dir: state.dir, group: state.group });
  steps.forEach((s, i) => {
    if (i) el.crumbs.append(Object.assign(document.createElement('span'), { className: 'sep', textContent: '›' }));
    const b = document.createElement('button');
    b.textContent = s.label;
    if (i === steps.length - 1) b.setAttribute('aria-current', 'location');
    else b.addEventListener('click', () => go(s.dir, s.group));
    el.crumbs.append(b);
  });
}

function button(cls, name, sub) {
  const b = document.createElement('button');
  b.className = cls;
  const n = document.createElement('span');
  n.className = 'name';
  n.textContent = name;
  b.append(n);
  if (sub) {
    const s = document.createElement('span');
    s.className = 'sub';
    s.textContent = sub;
    b.append(s);
  }
  return b;
}

/** A file, or a file and its versions, which opens the main one. */
function rowItem(row, { dir = '' } = {}) {
  const li = document.createElement('li');
  if (row.kind === 'file') {
    const f = row.file;
    const b = button('file', row.name, [dir, f.type === 'pdf' ? 'pdf' : ''].filter(Boolean).join(' · '));
    fileButton(b, f.path);
    li.append(b);
    if (f.type === 'md') li.append(exportLink(f.path));
    return li;
  }
  const b = button('file group', row.name, [dir, `${row.versions.length} versions`].filter(Boolean).join(' · '));
  fileButton(b, row.opens.path);
  b.dataset.group = row.name;
  b.dataset.dir = row.dir;
  if (row.versions.some((v) => v.file.path === state.current?.path)) b.classList.add('now');
  li.append(b, action('into', '›', `Versions of ${row.name}`, () => go(row.dir, row.name)));
  return li;
}

function versionItem(group, v) {
  const li = document.createElement('li');
  const when = new Date(v.file.mtime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const b = button('file', v.variant || 'main', [when, v.file.type === 'pdf' ? 'pdf' : ''].filter(Boolean).join(' · '));
  fileButton(b, v.file.path);
  li.append(b);
  if (v.file.type === 'md') {
    if (v.variant) li.append(action('promote', '★', `Make ${v.variant} the main version`, () => promote(v.file.path, group.name)));
    li.append(exportLink(v.file.path));
  }
  return li;
}

function folderItem(name) {
  const li = document.createElement('li');
  const dir = state.dir ? `${state.dir}/${name}` : name;
  const b = button('folder', name);
  b.dataset.dir = dir;
  b.addEventListener('click', () => go(dir, null));
  li.append(b);
  return li;
}

function fileButton(b, p) {
  b.dataset.path = p;
  b.title = p;
  if (state.current?.path === p) b.classList.add('now');
  b.addEventListener('click', () => open(p));
}

function action(cls, text, title, onClick) {
  const b = document.createElement('button');
  b.className = `row-action ${cls}`;
  b.textContent = text;
  b.title = title;
  b.setAttribute('aria-label', title);
  b.tabIndex = -1;
  b.addEventListener('click', onClick);
  return b;
}

/** Show a folder, or one file's versions in it, and remember the folder. */
export function go(dir, group = null, { focus = true } = {}) {
  const from = { dir: state.dir, group: state.group };
  state.dir = dir;
  state.group = group;
  try { localStorage.setItem(`reader:dir:${state.root}`, dir); } catch { /* ignore */ }
  drawTree();
  if (!focus) return;
  // Going up lands on the folder or the file just left.
  const back = from.group && !group ? `.group[data-group="${CSS.escape(from.group)}"]`
    : childOn(dir, from.dir) ? `.folder[data-dir="${CSS.escape(childOn(dir, from.dir))}"]`
    : null;
  ((back && el.files.querySelector(back)) || el.files.querySelector('.now') || rows()[0])?.focus();
}

/** The folder in `dir` that leads to `below`, if `below` is under it. */
function childOn(dir, below) {
  const prefix = dir ? `${dir}/` : '';
  if (below === dir || !below.startsWith(prefix)) return null;
  return prefix + below.slice(prefix.length).split('/')[0];
}

export function up() {
  if (state.group) go(state.dir, null);
  else if (state.dir) go(dirOf(state.dir), null);
}

export function rememberedDir() {
  try { return localStorage.getItem(`reader:dir:${state.root}`) || ''; } catch { return ''; }
}

/** Show the folder `p` is in, and its versions if it isn't the one its row opens. */
export function reveal(p) {
  const group = groupOf(state.files, p);
  go(dirOf(p), group && group.opens.path !== p ? group.name : null, { focus: false });
}

const rows = () => [...el.files.querySelectorAll('.file, .folder')];

/** Arrows move down the list; → goes into a folder or a file's versions, ← back out. */
export function onListKey(e) {
  const at = document.activeElement;
  const list = rows();
  const i = list.indexOf(at);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    list[Math.min(list.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  } else if (e.key === 'ArrowRight' && at?.matches('.folder, .group')) {
    e.preventDefault();
    go(at.dataset.dir, at.dataset.group || null);
  } else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && !el.filter.value.trim()) {
    e.preventDefault();
    up();
  }
}

async function promote(p, base) {
  try {
    if (dirty()) await save();
    const out = await api('POST', '/api/promote', { path: p, base });
    await loadTree();
    const moved = out.moved.find((m) => m.from === state.current?.path);
    if (moved) await open(moved.to);
    go(state.dir, state.group);
    const aside = out.moved.length > 1 ? `; the old one is now ${splitPath(out.moved[0].to).stem.slice(base.length + 1)}` : '';
    toast(`${splitPath(p).stem.slice(base.length + 1)} is the main version${aside}`);
  } catch (err) {
    toast(err.message, true);
  }
}

/**
 * Saves the document as an HTML file, as it is on disk: what's unsaved is
 * saved first. The link itself leads to the file with nothing drawn in it.
 */
function exportLink(p) {
  const a = document.createElement('a');
  a.className = 'export';
  a.href = exportUrl(p);
  a.download = '';
  a.title = 'Export as HTML';
  a.setAttribute('aria-label', `Export ${p} as HTML`);
  a.textContent = '↓';
  a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (state.current?.path === p && dirty()) {
      await save();
      if (dirty()) return toast('not saved, so not exported', true);
    }
    try {
      await exportDocument(p);
    } catch (err) {
      toast(`export: ${err.message}`, true);
    }
  });
  return a;
}

export function visiblePaths() {
  return [...el.files.querySelectorAll('.file')].map((b) => b.dataset.path);
}

export function step(delta) {
  const paths = visiblePaths();
  if (!paths.length) return;
  const i = paths.indexOf(state.current?.path);
  const next = paths[Math.min(paths.length - 1, Math.max(0, i + delta))];
  if (next && next !== state.current?.path) open(next);
}

export async function open(p) {
  const seq = ++state.openSeq;
  if (dirty()) await save();
  if (seq !== state.openSeq) return;

  const entry = state.files.find((f) => f.path === p);
  const type = entry?.type || (/\.pdf$/i.test(p) ? 'pdf' : 'md');
  setConflict(false);

  if (type === 'pdf') {
    state.current = { path: p, type };
    state.saved = '';
    el.editor.value = '';
    showPdf(p);
  } else {
    let file;
    try {
      file = await api('GET', `/api/file?path=${encodeURIComponent(p)}`);
    } catch (err) {
      return toast(err.message, true);
    }
    if (seq !== state.openSeq) return;
    state.current = { path: p, type };
    state.saved = file.text;
    state.mtime = file.mtime;
    el.editor.value = file.text;
    el.editor.disabled = false;
    el.editor.scrollTop = 0;
    el.editor.setSelectionRange(0, 0);
    showPreview();
    renderNow({ resetScroll: true });
  }

  history.replaceState(null, '', `#${encodeURIComponent(p)}`);
  document.title = `${p} — ${state.rootName}`;
  el.crumb.textContent = p;
  el.footPath.textContent = p;
  setSaveState('');
  updateCounts();
  updatePresentable();
  el.branchBtn.disabled = type !== 'md';
  drawTree();
  el.files.querySelector('.file.now')?.scrollIntoView({ block: 'nearest' });
}

export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.md`;
}

/** The New form, filled in for a new file in this folder, or a version of the open one. */
export function showNewForm(branching) {
  const prefix = state.dir ? `${state.dir}/` : '';
  let name = `${prefix}${today()}`;
  let pick = [prefix.length, name.length - 3];
  if (branching) {
    const p = state.current.path;
    const { dir, stem, ext } = splitPath(p);
    const base = groupOf(state.files, p)?.name || stem;
    name = `${dir ? dir + '/' : ''}${base}.draft${ext}`;
    pick = [name.length - ext.length - 'draft'.length, name.length - ext.length];
  }
  el.newForm.dataset.from = branching ? state.current.path : '';
  el.newForm.querySelector('button').textContent = branching ? 'Branch' : 'Create';
  el.newForm.hidden = false;
  el.newName.value = name;
  el.newName.focus();
  el.newName.setSelectionRange(...pick);
}

export async function createFile(name) {
  const from = el.newForm.dataset.from;
  try {
    if (from && dirty()) await save();
    const out = from ? await api('POST', '/api/branch', { from, to: name }) : await api('POST', '/api/new', { name });
    el.newForm.hidden = true;
    await loadTree();
    reveal(out.path);
    await open(out.path);
    if (!from && !out.created) toast(`${out.path} already exists — opened it`);
    el.editor.focus();
  } catch (err) {
    toast(err.message, true);
  }
}

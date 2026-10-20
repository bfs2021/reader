/**
 * Taking entries of the outline out into files of their own, beside the
 * file they were in, which keeps a link to each in its place (sections.js
 * works out the text). Undo is offered for as long as the toast is up:
 * after either file changes, undoing would mean merging the two.
 */

import { el, state, dirty } from './state.js';
import { api } from './api.js';
import { saveFirst, reloadFromDisk } from './saving.js';
import { toast } from './status.js';
import { loadTree } from './files.js';
import { extract, slug } from './sections.js';
import { dirOf, splitPath, joinPath } from './versions.js';

/** A name for each entry's file, from its title, that no file beside it has. */
export function namesFor(entries) {
  const dir = dirOf(state.current.path);
  const taken = new Set(state.files.map((f) => f.path));
  return entries.map((e) => {
    const stem = slug(e.title);
    let name = `${stem}.md`;
    for (let n = 2; taken.has(joinPath(dir, name)); n++) name = `${stem}-${n}.md`;
    taken.add(joinPath(dir, name));
    return name;
  });
}

/** Takes `entries` out of the open file into the files `names`, beside it. */
export async function extractEntries(entries, names) {
  const p = state.current?.path;
  if (!p || !entries.length) return;
  try {
    if (!(await saveFirst())) throw new Error('not saved, so left as it was');
    const before = el.editor.value;
    const { text, files } = extract(before, entries, names.map((n) => (splitPath(n).ext ? n : `${n}.md`)));
    const dir = dirOf(p);
    const out = await api('POST', '/api/extract', {
      path: p, text, baseMtime: state.mtime, files: files.map((f) => ({ path: joinPath(dir, f.name), text: f.text })),
    });
    if (state.current?.path === p) await reloadFromDisk();
    await loadTree();
    const what = out.files.length === 1 ? splitPath(out.files[0].path).name : `${out.files.length} files`;
    toast(`Extracted to ${what}`, false, { label: 'Undo', run: () => undo(p, before, out) });
  } catch (err) {
    toast(err.message, true);
  }
}

async function undo(p, before, out) {
  try {
    if (state.current?.path === p && dirty()) throw new Error(`${splitPath(p).name} has changed since, so it's left as it is`);
    await api('POST', '/api/unextract', { path: p, text: before, mtime: out.mtime, files: out.files });
    if (state.current?.path === p) await reloadFromDisk();
    await loadTree();
    toast('Put back');
  } catch (err) {
    toast(err.message, true);
  }
}

/**
 * The content directory: every read and write the server makes goes through
 * here, so this is the one place that decides what is inside the root.
 *
 *   list()                     files the UI can open, newest first
 *   read(rel)                  { text, mtime }
 *   write(rel, text, opts)     atomic, with a conflict check and backups
 *   create(name?)              a new file, today's date by default
 *   branch(from, to)           a copy of a document, as another version of it
 *   promote(rel, base)         make a version the main one, `base.ext`
 *   resolve(rel)               absolute path, or a PathError
 *
 * Paths crossing this boundary are always root-relative with `/` separators.
 */

import fs from 'node:fs';
import path from 'node:path';

export const DOC_EXTS = new Set(['.md', '.markdown']);
export const LISTED_EXTS = new Set([...DOC_EXTS, '.pdf']);

const STATE_DIR = '.reader';
const BACKUPS_KEPT = 10;
const BACKUP_EVERY_MS = 5 * 60 * 1000;

export class PathError extends Error {
  status = 400;
}
export class NotFoundError extends Error {
  status = 404;
}
export class ConflictError extends Error {
  status = 409;
  constructor(message, mtime) {
    super(message);
    this.mtime = mtime;
  }
}

export function createContent(rootDir) {
  const root = fs.realpathSync(rootDir);
  const backupRoot = path.join(root, STATE_DIR, 'backups');

  const inside = (abs) => abs === root || abs.startsWith(root + path.sep);
  const toRel = (abs) => path.relative(root, abs).split(path.sep).join('/');

  /** Root-relative path -> absolute path, refusing anything that escapes. */
  function resolve(rel) {
    if (typeof rel !== 'string' || !rel || rel.includes('\0')) {
      throw new PathError('missing or invalid path');
    }
    if (path.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) {
      throw new PathError(`absolute paths are not allowed: ${rel}`);
    }
    const parts = rel.split(/[\\/]+/);
    if (parts.some((p) => p === '..' || p.startsWith('.'))) {
      throw new PathError(`not allowed: ${rel}`);
    }
    const abs = path.resolve(root, rel);
    if (!inside(abs) || abs === root) throw new PathError(`outside the content directory: ${rel}`);

    // Lexically inside is not enough: a symlink can still point out. Check the
    // real location of the file, or of its nearest existing ancestor.
    let probe = abs;
    while (!fs.existsSync(probe)) probe = path.dirname(probe);
    if (!inside(fs.realpathSync(probe))) {
      throw new PathError(`outside the content directory: ${rel}`);
    }
    return abs;
  }

  function list() {
    const out = [];
    const walk = (dir) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const ent of entries) {
        if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
        const abs = path.join(dir, ent.name);
        let stat;
        try {
          // Follow symlinks only when they stay inside the root.
          if (!inside(fs.realpathSync(abs))) continue;
          stat = fs.statSync(abs);
        } catch {
          continue;
        }
        if (stat.isDirectory()) {
          walk(abs);
        } else if (stat.isFile()) {
          const ext = path.extname(ent.name).toLowerCase();
          if (!LISTED_EXTS.has(ext)) continue;
          out.push({
            path: toRel(abs),
            type: ext === '.pdf' ? 'pdf' : 'md',
            mtime: stat.mtimeMs,
            size: stat.size,
          });
        }
      }
    };
    walk(root);
    return out.sort((a, b) => b.mtime - a.mtime || a.path.localeCompare(b.path));
  }

  function statFile(rel) {
    const abs = resolve(rel);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      throw new NotFoundError(`no such file: ${rel}`);
    }
    if (!stat.isFile()) throw new NotFoundError(`not a file: ${rel}`);
    return { abs, stat };
  }

  function read(rel) {
    const { abs, stat } = statFile(rel);
    return { path: rel, text: fs.readFileSync(abs, 'utf8'), mtime: stat.mtimeMs };
  }

  /**
   * Save `text` to `rel`.
   *
   * `baseMtime` is the mtime the editor loaded; if the file has changed on
   * disk since then the write is refused with a ConflictError rather than
   * clobbering someone else's edit. Omit it (or pass `force`) to overwrite.
   *
   * `explicit` marks a deliberate save (⌘S): it always takes a backup, where
   * autosave only takes one every few minutes.
   */
  function write(rel, text, { baseMtime, force = false, explicit = false } = {}) {
    const abs = resolve(rel);
    if (!DOC_EXTS.has(path.extname(abs).toLowerCase())) {
      throw new PathError(`only markdown files can be edited: ${rel}`);
    }
    if (typeof text !== 'string') throw new PathError('text must be a string');

    let current = null;
    try {
      current = fs.statSync(abs);
    } catch {
      /* new file */
    }

    if (current && !force && baseMtime != null && current.mtimeMs !== baseMtime) {
      throw new ConflictError(`${rel} changed on disk`, current.mtimeMs);
    }

    if (current) {
      const previous = fs.readFileSync(abs, 'utf8');
      if (previous === text) return { path: rel, mtime: current.mtimeMs, unchanged: true };
      backup(rel, previous, explicit);
    }

    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const tmp = path.join(path.dirname(abs), `.${path.basename(abs)}.${process.pid}.tmp`);
    fs.writeFileSync(tmp, text, 'utf8');
    if (current) fs.chmodSync(tmp, current.mode & 0o777);
    fs.renameSync(tmp, abs);
    return { path: rel, mtime: fs.statSync(abs).mtimeMs };
  }

  function backup(rel, previous, explicit) {
    const dir = path.join(backupRoot, rel);
    fs.mkdirSync(dir, { recursive: true });
    const existing = fs.readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
    const newest = existing.at(-1);
    if (!explicit && newest) {
      const age = Date.now() - fs.statSync(path.join(dir, newest)).mtimeMs;
      if (age < BACKUP_EVERY_MS) return;
    }
    const ext = path.extname(rel) || '.md';
    // Two saves can land in the same millisecond; a sequence number keeps
    // both copies and keeps them in order.
    const at = stamp();
    let seq = 0;
    let file;
    do file = path.join(dir, `${at}-${String(seq++).padStart(2, '0')}${ext}`);
    while (fs.existsSync(file));
    fs.writeFileSync(file, previous, 'utf8');
    const all = fs.readdirSync(dir).filter((f) => !f.startsWith('.')).sort();
    for (const name of all.slice(0, -BACKUPS_KEPT)) fs.rmSync(path.join(dir, name));
  }

  /** Create a new markdown file; defaults to today's date, like a journal. */
  function create(name) {
    let rel = (name || '').trim() || `${today()}.md`;
    if (!path.extname(rel)) rel += '.md';
    const abs = resolve(rel);
    if (!DOC_EXTS.has(path.extname(abs).toLowerCase())) {
      throw new PathError(`new files must be markdown: ${rel}`);
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    let created = true;
    try {
      fs.writeFileSync(abs, '', { flag: 'wx' });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      created = false;
    }
    return { path: toRel(abs), created, mtime: fs.statSync(abs).mtimeMs };
  }

  /** Copy a document to a new name, to work on beside the original. */
  function branch(from, to) {
    const { abs: fromAbs } = statFile(from);
    const toAbs = resolve(to);
    if (!DOC_EXTS.has(path.extname(fromAbs).toLowerCase())) throw new PathError(`not a document: ${from}`);
    if (!DOC_EXTS.has(path.extname(toAbs).toLowerCase())) throw new PathError(`versions must be markdown: ${to}`);
    fs.mkdirSync(path.dirname(toAbs), { recursive: true });
    try {
      fs.copyFileSync(fromAbs, toAbs, fs.constants.COPYFILE_EXCL);
    } catch (err) {
      if (err.code === 'EEXIST') throw new ConflictError(`${to} already exists`);
      throw err;
    }
    return { path: toRel(toAbs), mtime: fs.statSync(toAbs).mtimeMs };
  }

  /**
   * Make `rel` (`slides.arc1.md`) the main version of `base` (`slides`): it
   * takes the name `slides.md`, and the file that had it becomes a version
   * named after the day it was last changed (`slides.oct13.md`).
   */
  function promote(rel, base) {
    const { abs } = statFile(rel);
    const ext = path.extname(abs);
    const stem = path.basename(abs, ext);
    if (!DOC_EXTS.has(ext.toLowerCase())) throw new PathError(`not a document: ${rel}`);
    if (typeof base !== 'string' || !stem.startsWith(base + '.') || base.includes('/')) {
      throw new PathError(`${rel} is not a version of ${base}`);
    }
    const dir = path.dirname(abs);
    const mainAbs = path.join(dir, base + ext);
    const moved = [];
    if (fs.existsSync(mainAbs)) {
      const day = monthDay(new Date(fs.statSync(mainAbs).mtimeMs));
      let aside = path.join(dir, `${base}.${day}${ext}`);
      for (let n = 2; fs.existsSync(aside); n++) aside = path.join(dir, `${base}.${day}-${n}${ext}`);
      moved.push(move(mainAbs, aside));
    }
    moved.push(move(abs, mainAbs));
    return { path: toRel(mainAbs), moved };
  }

  /** Rename a file, and its backups with it, never over another file. */
  function move(fromAbs, toAbs) {
    const from = toRel(fromAbs);
    const to = toRel(toAbs);
    resolve(to);
    if (fs.existsSync(toAbs)) throw new ConflictError(`${to} already exists`);
    fs.renameSync(fromAbs, toAbs);
    const oldBackups = path.join(backupRoot, from);
    const newBackups = path.join(backupRoot, to);
    if (fs.existsSync(oldBackups)) {
      if (!fs.existsSync(newBackups)) {
        fs.mkdirSync(path.dirname(newBackups), { recursive: true });
        fs.renameSync(oldBackups, newBackups);
      } else {
        // Left from an earlier file by this name: they're named by time, so they mix.
        for (const name of fs.readdirSync(oldBackups)) {
          const dest = path.join(newBackups, name);
          if (!fs.existsSync(dest)) fs.renameSync(path.join(oldBackups, name), dest);
        }
        fs.rmSync(oldBackups, { recursive: true, force: true });
      }
    }
    return { from, to };
  }

  return { root, resolve, list, read, write, create, branch, promote, statFile, backupRoot };
}

function pad(n, w = 2) {
  return String(n).padStart(w, '0');
}

function today(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function monthDay(d) {
  return `${MONTHS[d.getMonth()]}${d.getDate()}`;
}

function stamp(d = new Date()) {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(d.getMilliseconds(), 3)}`
  );
}

/**
 * The folders the desktop app has opened, most recent first, each with the
 * port it was served on. A folder keeps its port from one launch to the
 * next, since what the app remembers in the browser (the theme, the folder
 * the file list was in, work mode) is kept per origin, and the port is part
 * of the origin.
 */

import fs from 'node:fs';
import path from 'node:path';

export const FIRST_PORT = 8734;
const KEPT = 10;

/** `{ folders: [{ path, port }] }` from `file`; empty if it isn't there or can't be read. */
export function load(file) {
  try {
    const { folders } = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { folders: Array.isArray(folders) ? folders.filter(valid) : [] };
  } catch {
    return { folders: [] };
  }
}

export function save(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function valid(f) {
  return f && typeof f.path === 'string' && Number.isInteger(f.port) && f.port > 0 && f.port < 65536;
}

/** The ports to try for `dir`, in order: its own, if it has one; then each one no other folder has. */
export function* ports(data, dir) {
  const own = data.folders.find((f) => f.path === dir)?.port;
  if (own) yield own;
  const taken = new Set(data.folders.map((f) => f.port));
  for (let port = FIRST_PORT; port < 65536; port++) if (!taken.has(port)) yield port;
}

/** `data` with `dir` first, on `port`, keeping no more than ten. */
export function remember(data, dir, port) {
  const rest = data.folders.filter((f) => f.path !== dir && f.port !== port);
  return { folders: [{ path: dir, port }, ...rest].slice(0, KEPT) };
}

/** `data` without `dir`, or without any folders at all. */
export function forget(data, dir) {
  return { folders: dir === undefined ? [] : data.folders.filter((f) => f.path !== dir) };
}

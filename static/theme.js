/**
 * Light, dark, or the system's (`prefers-color-scheme`), as the reader
 * chooses in the help, kept in the browser; the system's until they do.
 * Loaded in the <head>, before the stylesheet, so the page is drawn in the
 * right one from the first: `<html data-theme>` is the look it came to,
 * `light` or `dark`, and `data-chosen` what was chosen, for the speaker
 * view, which is dark unless light is asked for.
 *
 * The app sends the preview frames whether to draw the document dark with
 * each render (app/render.js); an export, printed or saved, stays light.
 *
 *   Theme.chosen()        'light', 'dark' or 'system'
 *   Theme.dark()          whether the look came to dark
 *   Theme.choose(c)       chooses, keeps it, and applies it
 *   Theme.onChange(fn)    fn(dark, chosen), when either changes: chosen here
 *                         or in another window, or the system's changing
 */
window.Theme = (() => {
  const KEY = 'reader:theme';
  const CHOICES = ['light', 'dark', 'system'];
  const system = window.matchMedia?.('(prefers-color-scheme: dark)');
  const heard = [];

  const stored = () => {
    try {
      const c = localStorage.getItem(KEY);
      return CHOICES.includes(c) ? c : 'system';
    } catch {
      return 'system';
    }
  };
  // Where storage can't be had, as long as the page lasts.
  let chosen = stored();

  const dark = () => chosen === 'dark' || (chosen === 'system' && Boolean(system?.matches));

  let was = null;
  function apply() {
    const root = document.documentElement;
    root.dataset.theme = dark() ? 'dark' : 'light';
    root.dataset.chosen = chosen;
    const now = `${dark()} ${chosen}`;
    if (was !== null && was !== now) heard.forEach((fn) => fn(dark(), chosen));
    was = now;
  }

  function choose(c) {
    if (!CHOICES.includes(c)) return;
    chosen = c;
    try {
      localStorage.setItem(KEY, c);
    } catch {
      // kept, until the page goes
    }
    apply();
  }

  system?.addEventListener?.('change', apply);
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    chosen = stored();
    apply();
  });
  apply();

  return { chosen: () => chosen, dark, choose, onChange: (fn) => heard.push(fn) };
})();

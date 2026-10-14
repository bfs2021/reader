/**
 * The versions picked in `tabs` and `compare` blocks (features/tabs), latest
 * first, kept here for the preview frames, which, sandboxed, have no storage
 * of their own. A frame asks for them as it loads (`picks`) and tells of
 * each one picked (`pick`); every frame of the page is then told the new
 * list (`picked`), and through storage, every other window of the app's.
 */
(() => {
  const KEY = 'reader:tabs';
  const KEEP = 50;
  // Where storage can't be had, as long as the page lasts.
  let kept = [];

  const picked = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? kept;
    } catch {
      return kept;
    }
  };
  const frames = () => [...document.querySelectorAll('iframe')].map((f) => f.contentWindow);
  const tell = (frame) => frame?.postMessage({ type: 'picked', keys: picked() }, '*');

  window.addEventListener('message', (e) => {
    if (!frames().includes(e.source)) return;
    if (e.data?.type === 'picks') tell(e.source);
    else if (e.data?.type === 'pick' && typeof e.data.key === 'string') {
      kept = [e.data.key, ...picked().filter((k) => k !== e.data.key)].slice(0, KEEP);
      try {
        localStorage.setItem(KEY, JSON.stringify(kept));
      } catch {
        // kept, until the page goes
      }
      frames().forEach(tell);
    }
  });
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) frames().forEach(tell);
  });
  // A frame that asked before this was listening.
  frames().forEach(tell);
})();

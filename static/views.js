/**
 * How the reader has a document set to be seen, for the preview frames,
 * which, sandboxed, have no storage of their own: a recipe's multiplier,
 * say (features/count). Kept by key, the latest first and the oldest let
 * go. A frame asks for them as it loads (`views`) and tells of each one
 * set (`view`, a null value forgetting it); every frame of the page is
 * then told them all (`viewed`), and through storage, every other window
 * of the app's.
 */
(() => {
  const KEY = 'reader:views';
  const KEEP = 200;
  // Where storage can't be had, as long as the page lasts.
  let kept = [];

  const views = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) ?? kept;
    } catch {
      return kept;
    }
  };
  const frames = () => [...document.querySelectorAll('iframe')].map((f) => f.contentWindow);
  const tell = (frame) => frame?.postMessage({ type: 'viewed', views: Object.fromEntries(views()) }, '*');

  window.addEventListener('message', (e) => {
    if (!frames().includes(e.source)) return;
    if (e.data?.type === 'views') tell(e.source);
    else if (e.data?.type === 'view' && typeof e.data.key === 'string') {
      const { key, value } = e.data;
      kept = [...(value == null ? [] : [[key, value]]), ...views().filter(([k]) => k !== key)].slice(0, KEEP);
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

/**
 * Keeps the screen on while a preview frame asks (`awake`, `on`): steps
 * under way (features/steps), with hands too busy to wake it. The frames,
 * sandboxed, can't ask the browser themselves. A lock is let go when the
 * page is hidden, so it's asked for again when it's back. Where the
 * browser won't give one (not over https or localhost), the screen sleeps
 * as it would.
 */
(() => {
  const asking = new Set();
  let lock = null;

  const frames = () => [...document.querySelectorAll('iframe')].map((f) => f.contentWindow);

  async function hold() {
    const want = asking.size > 0 && document.visibilityState === 'visible';
    if (want && !lock && navigator.wakeLock) {
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } catch {
        lock = null;
      }
    } else if (!want && lock) {
      const was = lock;
      lock = null;
      await was.release().catch(() => {});
    }
  }

  window.addEventListener('message', (e) => {
    if (e.data?.type !== 'awake' || !frames().includes(e.source)) return;
    if (e.data.on) asking.add(e.source);
    else asking.delete(e.source);
    hold();
  });
  document.addEventListener('visibilitychange', hold);
})();

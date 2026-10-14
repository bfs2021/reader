/**
 * Mermaid diagrams in the rendered page.
 *
 * Each ```mermaid fence comes from the server as `<div class="mermaid">`
 * holding its code block, and is drawn here from that text: the diagram
 * goes in beside the code, which is then hidden. Text that Mermaid can't
 * read shows the code with what was wrong under it.
 *
 * Drawing takes a moment and a render comes with each keystroke, so what
 * each text drew is kept, and a diagram being changed goes on showing what
 * it last drew until the new one is ready. Its error, while the text is
 * half typed, shows under that, faded.
 *
 * What the page's diagrams drew is also handed back by their text
 * (`Preview.drawn()`), for an export, which has nothing to draw them.
 */
(() => {
  let loaded = null;

  /** Mermaid, loaded the first time it's wanted. */
  function load() {
    loaded ??= new Promise((done, failed) => {
      const script = document.createElement('script');
      script.src = '/features/mermaid/vendor/mermaid.min.js';
      script.onload = () => {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', suppressErrorRendering: true });
        done();
      };
      script.onerror = () => failed(new Error('Mermaid could not be loaded'));
      // Outside <body>, which every render replaces.
      document.head.append(script);
    });
    return loaded;
  }

  const drawn = new Map();  // text -> { svg } or { error }
  const last = [];          // the svg each diagram on the page last showed, in order
  let ids = 0;
  let queue = Promise.resolve();

  // Mermaid measures text as it draws, so it draws on the page, out of
  // sight. It finds what it drew under <body>, which every render replaces.
  const stage = document.createElement('div');
  stage.style.cssText = 'position: absolute; top: 0; left: -10000px; visibility: hidden;';

  const hosts = (root = document.body) => [...root.querySelectorAll('.mermaid')];
  const showing = (source) => hosts().some((host) => text(host) === source);
  // markdown leaves a code block ending in a newline the fence didn't have
  const text = (host) => (host.querySelector('pre code')?.textContent ?? '').replace(/\n$/, '');

  /** Puts what's known of diagram `k`'s text into its host. */
  function show(host, k) {
    host.querySelector('.mermaid-figure')?.remove();
    host.querySelector('.mermaid-error')?.remove();
    const got = drawn.get(text(host));
    const svg = got?.svg ?? last[k];
    if (got?.svg) last[k] = got.svg;
    host.classList.toggle('drawn', Boolean(svg));
    host.classList.toggle('stale', Boolean(got?.error && svg));
    if (svg) {
      const figure = document.createElement('div');
      figure.className = 'mermaid-figure';
      figure.innerHTML = svg;
      host.append(figure);
    }
    if (got?.error) {
      const error = document.createElement('pre');
      error.className = 'mermaid-error';
      error.textContent = got.error;
      host.append(error);
    }
  }

  /** Draws `source`, again if a render replaced the page meanwhile. */
  async function draw(source) {
    try {
      await load();
    } catch (err) {
      return drawn.set(source, { error: err.message });
    }
    while (showing(source)) {
      document.body.append(stage);
      let got;
      try {
        got = { svg: (await mermaid.render(`mermaid-${++ids}`, source, stage)).svg };
      } catch (err) {
        got = { error: String(err?.message ?? err).trim() };
      }
      const whole = stage.isConnected;
      stage.remove();
      stage.replaceChildren();
      if (whole) return drawn.set(source, got);
    }
  }

  function hydrate(root) {
    const all = hosts(root);
    last.length = all.length;
    all.forEach((host, k) => show(host, k));
    const wanted = new Set(all.map(text));
    for (const source of wanted) {
      if (drawn.has(source)) continue;
      // One at a time, and only what's still on the page by its turn: a
      // keystroke's text is usually gone by the next.
      queue = queue.then(async () => {
        await draw(source);
        hosts().forEach((host, k) => { if (text(host) === source) show(host, k); });
      });
      Preview.wait(queue);
    }
    // What each text drew is kept, for undoing back to it, until there are
    // a few hundred; then only what's on the page.
    if (drawn.size > 300) for (const source of drawn.keys()) if (!wanted.has(source)) drawn.delete(source);
  }

  Preview.register({
    restore: (root) => hydrate(root),
    drawn: () => ({ mermaid: Object.fromEntries(hosts().map((host) => [text(host), drawn.get(text(host))?.svg]).filter(([, svg]) => svg)) }),
  });
})();

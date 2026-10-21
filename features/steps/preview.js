/**
 * Following steps: in each group of them (`data-steps`), the step being
 * worked on is lit, once any is done or one is clicked. It's the first
 * not done, or the one clicked; marking it done lights the next not done
 * after it. `j` and `k` light the next and the one before, and `x` marks
 * the lit one done, or not, when the page has the keys. What's lit is only the
 * page's, not the file's, and holds across renders.
 *
 * While steps are under way -- begun and not all done -- the page around
 * the frame is asked to keep the screen awake (static/awake.js): hands
 * are busy. Runs in the preview frame.
 */
(() => {
  // A group's lit step, by its index, once one is clicked or done.
  const lit = new Map();
  let awake = false;

  const groups = (root = document) => {
    const found = new Map();
    for (const li of root.querySelectorAll('li.step[data-steps]')) {
      const g = li.dataset.steps;
      if (!found.has(g)) found.set(g, []);
      found.get(g).push(li);
    }
    return found;
  };
  const done = (li) => li.classList.contains('step-done');
  const boxOf = (li) => li.querySelector(':scope > .task-box, :scope > p > .task-box');
  /** The first step not done from `k` on, or else from the start; -1 for none. */
  const undone = (steps, k = 0) => {
    const after = steps.findIndex((li, j) => j >= k && !done(li));
    return after >= 0 ? after : steps.findIndex((li) => !done(li));
  };

  function show(root = document) {
    const all = groups(root);
    for (const g of lit.keys()) if (!all.has(g)) lit.delete(g);
    let underWay = false;
    for (const [g, steps] of all) {
      const begun = lit.has(g) || steps.some(done);
      const at = lit.has(g) ? lit.get(g) : begun ? undone(steps) : -1;
      steps.forEach((li, k) => li.classList.toggle('step-current', k === at));
      if (begun && !steps.every(done)) underWay = true;
    }
    // For what follows the lit steps (ingredients/preview.js).
    document.dispatchEvent(new Event('steps:lit'));
    if (underWay !== awake) {
      awake = underWay;
      window.parent.postMessage({ type: 'awake', on: awake }, '*');
    }
  }

  const place = (li) => {
    const g = li.dataset.steps;
    return { g, steps: groups().get(g), k: groups().get(g).indexOf(li) };
  };

  function light(g, k, scroll) {
    lit.set(g, k);
    show();
    if (scroll) groups().get(g)?.[k]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // Marking a step done (or not), before the render that follows.
  document.addEventListener('change', (e) => {
    const li = e.target.closest?.('li.step');
    if (!li || boxOf(li) !== e.target) return;
    li.classList.toggle('step-done', e.target.checked);
    const { g, steps, k } = place(li);
    if (!e.target.checked) light(g, k);
    else {
      const next = undone(steps, k + 1);
      if (next >= 0) light(g, next);
      else {
        lit.delete(g);
        show();
      }
    }
  });

  document.addEventListener('click', (e) => {
    // Starting a section over starts its steps over (tasks/preview.js).
    const reset = e.target.closest?.('.task-reset');
    if (reset) {
      const from = Number(reset.dataset.from);
      const to = reset.dataset.to ? Number(reset.dataset.to) : Infinity;
      const within = (g) => Number(g) >= from && Number(g) < to;
      for (const g of [...lit.keys()]) if (within(g)) lit.delete(g);
      for (const li of document.querySelectorAll('li.step-done')) if (within(li.dataset.steps)) li.classList.remove('step-done');
      show();
      return;
    }
    const li = e.target.closest?.('li.step');
    if (!li || Preview.deck || e.target.closest('a[href], input, button, .field, .def-use')) return;
    // Text being selected isn't a click on the step.
    if (String(window.getSelection?.() ?? '')) return;
    const { g, k } = place(li);
    light(g, k);
  });

  /** The group the keys move in: the one lit, or else the first. */
  const keyed = () => {
    const all = groups();
    const current = document.querySelector('li.step-current');
    const g = current?.dataset.steps ?? all.keys().next().value;
    return g == null ? null : { g, steps: all.get(g), k: current ? all.get(g).indexOf(current) : -1 };
  };

  document.addEventListener('keydown', (e) => {
    if (Preview.deck || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
    if (e.target.closest?.('input:not([type=checkbox], [type=radio]), textarea, [contenteditable], .puzzle, .field')) return;
    if (!['j', 'k', 'x'].includes(e.key)) return;
    const at = keyed();
    if (!at) return;
    e.preventDefault();
    const { g, steps, k } = at;
    if (e.key === 'j') light(g, Math.min(steps.length - 1, k + 1), true);
    else if (e.key === 'k') light(g, Math.max(0, k - 1), true);
    else if (k >= 0) boxOf(steps[k])?.click();
  });

  Preview.register({ restore: (root) => show(root) });
  show();
})();

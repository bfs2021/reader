/**
 * An ingredient named in a step: hovering or focusing the word shows its
 * item, amounts as multiplied; the lit step's (steps/preview.js) are lit,
 * and so are their items in the list. A step marked done that's the last
 * to name an ingredient marks it used, in the same edit: a staged box
 * filled, a plain one ticked. Runs in the preview frame.
 */
(() => {
  const itemOf = (use) => document.querySelector(`li.ingredient[data-recipe="${use.dataset.recipe}"][data-ingredient~="${CSS.escape(use.dataset.ingredient)}"]`);

  document.addEventListener('steps:lit', () => {
    for (const lit of document.querySelectorAll('.ingredient-use.lit, li.ingredient.lit')) lit.classList.remove('lit');
    for (const step of document.querySelectorAll('li.step-current')) {
      for (const use of step.querySelectorAll('.ingredient-use')) {
        use.classList.add('lit');
        itemOf(use)?.classList.add('lit');
      }
    }
  });

  // The item, shown by the word.
  const pop = document.createElement('div');
  pop.className = 'ingredient-pop';
  pop.setAttribute('role', 'tooltip');
  pop.hidden = true;
  let showing = null;

  function show(use) {
    const item = itemOf(use);
    if (!item) return;
    showing = use;
    const copy = item.cloneNode(true);
    copy.querySelectorAll('input, button, .stage-name, ul, ol').forEach((n) => n.remove());
    pop.textContent = copy.textContent.replace(/\s+/g, ' ').trim();
    // Outside <body>, which every render replaces.
    if (!pop.isConnected) document.documentElement.append(pop);
    pop.hidden = false;
    const r = use.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left, innerWidth - pop.offsetWidth - 8))}px`;
    pop.style.top = `${r.bottom + 6}px`;
  }
  function hide() {
    showing = null;
    pop.hidden = true;
  }
  document.addEventListener('mouseover', (e) => {
    const use = e.target.closest?.('.ingredient-use');
    if (use && use !== showing) show(use);
    else if (!use && showing) hide();
  });
  document.addEventListener('focusin', (e) => {
    const use = e.target.closest?.('.ingredient-use');
    if (use) show(use);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && showing) hide(); });
  window.addEventListener('scroll', hide, { passive: true });
  Preview.register({ restore: hide });

  // A step done: each ingredient it names that no step not done names is used.
  document.addEventListener('tasks:edits', (e) => {
    const { box, edits } = e.detail;
    const step = box.closest('li.step');
    if (!step || !box.checked) return;
    const pending = (use) => {
      const other = use.closest('li.step');
      return other && other !== step && !other.classList.contains('step-done');
    };
    const all = [...document.querySelectorAll('.ingredient-use')];
    const items = new Set();
    for (const use of step.querySelectorAll('.ingredient-use')) {
      const same = all.filter((u) => u.dataset.recipe === use.dataset.recipe && u.dataset.ingredient === use.dataset.ingredient);
      if (!same.some(pending)) items.add(itemOf(use));
    }
    for (const item of items) {
      const staged = item?.querySelector(':scope > .stage-box, :scope > p > .stage-box');
      const plain = item?.querySelector(':scope > .task-box, :scope > p > .task-box');
      if (staged && Number(staged.dataset.stage) < staged.children.length) {
        edits.push(Preview.stageLine(staged, staged.children.length));
        Preview.setStage(staged, staged.children.length);
      } else if (plain && !plain.defaultChecked) {
        const line = Number(plain.dataset.line);
        edits.push({ from: line, to: line + 1, before: [plain.dataset.off], after: [plain.dataset.on] });
        plain.checked = plain.defaultChecked = true;
      }
    }
  });
})();

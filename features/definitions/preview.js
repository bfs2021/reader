/**
 * Esc hides a term's meaning while it's hovered or focused, so it can be
 * put away without moving the mouse or the focus; once neither is on the
 * term, it shows again. Caught on the way down, ahead of the app's own Esc.
 * Runs in the preview frame.
 */
(() => {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.metaKey || e.ctrlKey || e.altKey) return;
    const shown = [...document.querySelectorAll('.def-use:hover, .def-use:focus')].filter((u) => !u.classList.contains('def-hushed'));
    if (!shown.length) return;
    for (const u of shown) u.classList.add('def-hushed');
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  const unhush = (e) => {
    const use = e.target.closest?.('.def-use');
    if (!use || use.contains(e.relatedTarget)) return;
    // Still shown the other way, by the mouse or by the focus, it stays put away.
    if (use.matches(e.type === 'mouseout' ? ':focus' : ':hover')) return;
    use.classList.remove('def-hushed');
  };
  document.addEventListener('mouseout', unhush);
  document.addEventListener('focusout', unhush);
})();

/*
 * Generic accessible dropdown/disclosure for a theme-index row that groups
 * several sub-topics under one heading (first use: "Verbos", grouping
 * Presente/Pasado/Futuro/etc. on exercises.html instead of listing each
 * tense as its own top-level row).
 *
 * Works three ways at once, all kept in sync through the same open/close
 * functions and the same aria-expanded state:
 *   - Click/tap the toggle button (works everywhere, including touch)
 *   - Keyboard: Enter/Space toggles (native <button> behavior), Escape
 *     closes and returns focus to the toggle
 *   - Desktop mouse: hovering the whole component opens it, matching how
 *     dropdown menus usually behave — this is purely additive, the
 *     click/keyboard path underneath is what makes it actually accessible
 *
 * Markup expected: a wrapper with class "theme-menu-wrapper" containing a
 * ".theme-menu-toggle" button (aria-expanded + aria-controls) and the menu
 * itself (a <ul id="...">, referenced by aria-controls) as a sibling.
 */
(function () {
  function setup(wrapper) {
    const toggle = wrapper.querySelector('.theme-menu-toggle');
    const menu = wrapper.querySelector('.theme-menu');
    if (!toggle || !menu) return;

    function open() {
      wrapper.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function close() {
      wrapper.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }

    function toggleOpen() {
      if (wrapper.classList.contains('is-open')) {
        close();
      } else {
        open();
      }
    }

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      toggleOpen();
    });

    // Desktop pointer convenience only — mouseleave fires when the pointer
    // actually leaves the wrapper's box, so moving down from the button
    // into the menu itself (a child of the same wrapper) doesn't close it.
    wrapper.addEventListener('mouseenter', open);
    wrapper.addEventListener('mouseleave', close);

    document.addEventListener('click', (event) => {
      if (!wrapper.contains(event.target)) close();
    });

    wrapper.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close();
        toggle.focus();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.theme-menu-wrapper').forEach(setup);
  });
})();

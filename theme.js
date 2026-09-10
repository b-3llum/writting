/* theme.js — light/dark/system theme toggle.
   Runs synchronously in <head> to set data-theme before paint, then injects a toggle. */
(function () {
  var STORAGE_KEY = 'bellums-theme';
  var root = document.documentElement;

  // --- early init: apply saved theme before paint ---
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      root.setAttribute('data-theme', saved);
    }
  } catch (e) { /* localStorage blocked */ }

  function getEffective() {
    var attr = root.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(mode) {
    if (mode === 'system') {
      root.removeAttribute('data-theme');
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    } else {
      root.setAttribute('data-theme', mode);
      try { localStorage.setItem(STORAGE_KEY, mode); } catch (e) {}
    }
    syncButtons();
  }

  // --- toggle button injection ---
  function makeButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.innerHTML =
      '<svg class="t-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
      '<svg class="t-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn.addEventListener('click', function (ev) {
      var current = getEffective();
      var next = current === 'dark' ? 'light' : 'dark';
      var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Modern path: circular reveal expanding from the toggle button.
      if (!reduceMotion && typeof document.startViewTransition === 'function') {
        var rect = btn.getBoundingClientRect();
        var x = rect.left + rect.width / 2;
        var y = rect.top + rect.height / 2;
        var endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );
        var t = document.startViewTransition(function () { setTheme(next); });
        t.ready.then(function () {
          document.documentElement.animate(
            { clipPath: [
              'circle(0 at ' + x + 'px ' + y + 'px)',
              'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)'
            ] },
            { duration: 900, easing: 'cubic-bezier(0.2, 0, 0.2, 1)',
              pseudoElement: '::view-transition-new(root)' }
          );
        }).catch(function () {});
        return;
      }

      // Fallback: temporary cross-fade class drives color transitions ~800ms.
      if (!reduceMotion) {
        root.classList.add('theme-transition');
        setTheme(next);
        setTimeout(function () { root.classList.remove('theme-transition'); }, 850);
      } else {
        setTheme(next);
      }
    });
    return btn;
  }

  function syncButtons() {
    var effective = getEffective();
    document.querySelectorAll('.theme-toggle').forEach(function (b) {
      b.setAttribute('data-mode', effective);
      b.setAttribute('aria-label',
        effective === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }

  function inject() {
    var nav = document.getElementById('siteNav');
    if (nav && !nav.querySelector('.theme-toggle')) {
      nav.appendChild(makeButton());
    }
    syncButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }

  // react to system changes when in 'system' mode
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncButtons);
  }
})();

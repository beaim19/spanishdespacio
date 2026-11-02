/*
 * Spanish Despacio — shared site behavior.
 * Loads the header/footer partials so nav only lives in one place,
 * wires up the mobile menu toggle, and marks the current page in nav.
 *
 * Note: fetch() of local partials requires the page to be served over
 * http(s) — it will not work if you open index.html directly from disk
 * (file://). For local preview run a tiny server, e.g.:
 *   python3 -m http.server 8000
 * then visit http://localhost:8000
 */

async function includePartial(placeholderId, url) {
  const el = document.getElementById(placeholderId);
  if (!el) return;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    el.innerHTML = await res.text();
  } catch (err) {
    console.error('Could not load partial', url, err);
  }
}

function markCurrentNavItem() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.main-nav a').forEach((link) => {
    const linkPath = link.getAttribute('href').split('/').pop();
    if (linkPath === path) {
      link.setAttribute('aria-current', 'page');
    }
  });
}

function wireMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
}

// Shrinks the (fixed) header once the page is scrolled a bit. Two different
// thresholds (shrink past 60px, grow back only under 20px) so it can't
// flicker back and forth around a single scroll position.
function wireHeaderShrink() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  let ticking = false;
  function update() {
    const y = window.scrollY;
    if (y > 60) header.classList.add('is-scrolled');
    else if (y < 20) header.classList.remove('is-scrolled');
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }, { passive: true });
  update(); // the browser may restore a mid-page scroll position on reload
}

// On narrow screens the expanded header can be taller than the CSS minimum
// (wrapped tagline, etc.) and would cover the top of the page (e.g. the
// "Volver" link). Size the placeholder to the header's real expanded height.
function wireHeaderSpacer() {
  const header = document.querySelector('.site-header');
  const spacer = document.getElementById('site-header-placeholder');
  if (!header || !spacer) return;
  function measure() {
    if (header.classList.contains('is-scrolled')) return;
    const nav = header.querySelector('.main-nav');
    if (nav && nav.classList.contains('is-open')) return;
    spacer.style.minHeight = header.offsetHeight + 'px';
  }
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
}

function setFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', async () => {
  await includePartial('site-header-placeholder', '/partials/header.html');
  await includePartial('site-footer-placeholder', '/partials/footer.html');
  markCurrentNavItem();
  wireMobileNav();
  wireHeaderShrink();
  wireHeaderSpacer();
  setFooterYear();
});

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

function setFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

document.addEventListener('DOMContentLoaded', async () => {
  await includePartial('site-header-placeholder', '/partials/header.html');
  await includePartial('site-footer-placeholder', '/partials/footer.html');
  markCurrentNavItem();
  wireMobileNav();
  setFooterYear();
});

/*
 * Spanish Despacio — cookie consent + gated GA4 loading.
 *
 * GDPR / ePrivacy (EU), UK GDPR, LGPD (Brazil), and similar laws require
 * asking before non-essential cookies (like analytics) run. This script:
 *   1. Sets Google's Consent Mode to "denied" by default, before anything loads.
 *   2. Shows a banner if the visitor hasn't chosen yet.
 *   3. Only loads the GA4 script, and only updates consent to "granted",
 *      after the visitor clicks "Accept".
 *   4. Remembers the choice in localStorage so we don't ask every visit.
 *
 * Replace GA_MEASUREMENT_ID below with your real GA4 ID (starts with "G-").
 */

const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';
const CONSENT_KEY = 'sd_cookie_consent'; // 'accepted' | 'declined'

window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }

// Default: deny analytics/ads storage until the visitor says otherwise.
// This must run before the GA4 script tag is ever added to the page.
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});

function loadGA4() {
  if (document.getElementById('ga4-script')) return; // already loaded
  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
}

function grantConsent() {
  gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  loadGA4();
}

function applyStoredConsent() {
  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === 'accepted') grantConsent();
  return stored;
}

function showBanner() {
  const banner = document.getElementById('consent-banner');
  if (!banner) return;
  banner.hidden = false;

  const acceptBtn = document.getElementById('consent-accept');
  const declineBtn = document.getElementById('consent-decline');

  acceptBtn?.addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    grantConsent();
    banner.hidden = true;
  });

  declineBtn?.addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    banner.hidden = true;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const stored = applyStoredConsent();
  if (!stored) showBanner();
});

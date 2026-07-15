# Spanish Despacio

Static site (no build step) for practicing Spanish: podcasts, exercises, and an
embedded R Shiny app for DELE A2 exam practice. Hosted on GitHub Pages,
custom domain `spanishdespacio.com` via Porkbun DNS.

## Structure

```
index.html          Home page
podcasts.html        Spotify for Creators embeds
exercises.html        Practice activities
dele.html             DELE A2 Shiny app (iframe)
about.html            About / contact
privacy.html          Privacy & cookies policy (GDPR etc.)
css/styles.css        All site styles (colors match the DELE app)
js/main.js            Shared header/footer injection, mobile nav
partials/header.html  Shared nav, injected by main.js
partials/footer.html  Shared footer, injected by main.js
```

## Local preview

Fetching the header/footer partials requires the page to be served over
http(s) — opening `index.html` directly from disk (`file://`) will leave the
nav empty. Run a local server from this folder instead:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Before going live

- No analytics is used on this site by design — nothing to configure there.
- Confirm the DELE Shiny app allows being embedded in an iframe from
  `spanishdespacio.com` (no blocking `X-Frame-Options` / CSP
  `frame-ancestors` header on its side).
- Replace the Spotify embed placeholder in `podcasts.html` with real episode
  IDs.

## Deploying

Push to `main` on GitHub, then enable GitHub Pages in the repo's
Settings > Pages (source: `main` branch, root). Point Porkbun DNS at GitHub
Pages once Pages is live.

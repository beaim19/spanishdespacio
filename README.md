# Spanish Despacio

Static site (no build step) for practicing Spanish: podcasts, exercises, and an
embedded R Shiny app for DELE A2 exam practice. Hosted on GitHub Pages,
custom domain `spanishdespacio.com` via Porkbun DNS.

## Structure

```
index.html               Home page
podcasts.html             Podcasts, organized by theme (anchor-nav index)
exercises.html            Exercises, organized by grammar topic (anchor-nav index)
exercises/*.html          One page per exercise (e.g. ser-estar-1.html)
dele.html                 DELE A2 Shiny app (iframe)
about.html                About / contact
privacy.html              Privacy & cookies policy
css/styles.css            All site styles (colors match the DELE app)
js/main.js                Shared header/footer injection, mobile nav
js/exercise-choice2.js    Reusable "pick between two options" exercise engine
content/exercises/        Exercise content as CSV — see below
partials/header.html      Shared nav, injected by main.js
partials/footer.html      Shared footer, injected by main.js
```

## Adding a new exercise (two-option type, e.g. ser/estar, por/para)

Content lives as one CSV per **topic** (not per set of 10) under
`content/exercises/<topic>.csv`, e.g. `ser-estar.csv`, `por-para.csv` —
separate from the code, the same idea as keeping exercise data in Excel for
the Shiny app, just as plain-text CSV instead (so `git diff` actually shows
what changed, unlike a binary .xlsx).

Columns for the two-option type:

```
set,id,before,after,option_a,option_b,correct
1,"Ella","muy cansada hoy.",es,está,está
```

`set` is which group of ~10 questions a row belongs to — this is what lets
one file hold every set for a topic. `before`/`after` are the sentence split
around the blank, `option_a`/`option_b` are the two clickable choices,
`correct` must exactly match the text of whichever option is right.

**To add a new set to an existing topic:** just append 10 more rows with the
next `set` number (2, 3...) to that topic's CSV — nothing else to do.
`exercises.html` links to the topic page directly (e.g.
`/exercises/ser-estar.html`, no `?set=` needed — it defaults to set 1). The
engine reads however many distinct `set` values exist in the file and
automatically shows a "Serie 1 / Serie 2 / ..." switcher at the top of the
page once there's more than one — with only one set, the switcher doesn't
appear at all. Same idea as before (no manual count to maintain), just
applied one level up: number of *questions* = rows in a set; number of
*sets* = distinct `set` values in the file.

**To add a brand-new topic of this same type:** new CSV
(`content/exercises/<topic>.csv`), copy `exercises/ser-estar.html` changing
the `<h1>`, `data-src`, and `<title>`, then link it from `exercises.html`.

A different exercise *type* (matching, fill-in-the-blank, etc.) will need its
own small engine file and its own CSV column layout — same pattern, new
component. `js/exercise-common.js` holds the CSV-loading + set-filtering
logic shared by every engine, so a new engine only has to implement its own
rendering/checking, not CSV plumbing.

## Adding a new exercise (typed-answer / conjugation type)

Same CSV-per-topic idea, different columns and a different engine
(`js/exercise-typed.js`): the user types the answer into a text box instead
of picking between two buttons, with the infinitive shown as a hint.

```
set,id,before,after,infinitive,correct
1,1,"Yo","español todos los días.",hablar,hablo
```

Renders as: "Yo [ ___ ] español todos los días. *(hablar)*". Matching is
case-insensitive but accent-sensitive — "Hablo" and "hablo" both count,
"habло" without the accent on a word that needs one does not.

This engine also adds an accent toolbar (á é í ó ú ñ ¿ ¡) above the
questions, matching the buttons in the DELE app — clicking one inserts the
character into whichever text box was last focused, at the cursor position.

### Writing accented characters (á, é, í, ó, ú, ñ, ¿, ¡) correctly

If you edit these CSVs in Excel and see garbled characters instead of accents,
that's an encoding mismatch — Excel's plain "CSV (Comma delimited)" save
format uses the Windows system codepage, not UTF-8, which is what the website
expects. Fix: in Excel, use **File → Save As**, and in the file-type dropdown
pick **"CSV UTF-8 (Comma delimited) (*.csv)"** specifically — it's a separate
option from plain "CSV (Comma delimited)" in Excel 2016 and later. The CSVs
in this repo are saved with a UTF-8 byte-order-mark, which is what makes
Excel correctly detect UTF-8 when you double-click to open them; re-saving
with the "CSV UTF-8" option keeps that intact.

### Known loose ends

`content/exercises/ser-estar/set-01.csv` and `exercises/ser-estar-1.html` are
leftover from an earlier version of this pattern (one file per set of 10)
before switching to one file per topic. They're unused by any live page but
weren't deleted — feel free to delete them yourself in File Explorer whenever
convenient.

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

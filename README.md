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
js/exercise-common.js     Shared CSV loading, series pager, verb-type and
                          exercise-type switchers
js/exercise-choice2.js    "Pick between two options" exercise engine (Dos opciones)
js/exercise-arrastra.js   "Drag a word into the blank" exercise engine (Arrastra)
js/exercise-parejas.js    "Match two columns" exercise engine (Parejas)
js/exercise-typed.js      Typed-answer/conjugation exercise engine
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
automatically shows a "‹ 1 2 3 ›" series pager above the questions once
there's more than one — with only one set, the pager doesn't appear at all.
Same idea as before (no manual count to maintain), just applied one level
up: number of *questions* = rows in a set; number of *sets* = distinct `set`
values in the file.

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

## Splitting a topic into verb-type variants (regular/irregular/reflexivos)

Some tenses need a second, independent grouping on top of "set" — e.g.
Presente has separate Regular/Irregular/Reflexivos tabs, each with their own
series. This is one CSV per **variant**, not one big file:

```
content/exercises/presente-regular.csv
content/exercises/presente-irregular.csv
content/exercises/presente-reflexivos.csv
```

Each file uses the normal `set,id,before,after,infinitive,correct` columns —
"variant" and "set" are independent, so series numbering restarts at 1 in
each variant's file, and that's fine.

On the page (`exercises/presente.html`), the container tells the engine
about the variants instead of a single `data-src`:

```html
<div id="exercise-app"
     data-variants="regular,irregular,reflexivos"
     data-src-template="/content/exercises/presente-{type}.csv"></div>
```

Two slots elsewhere on the page are where the two switchers render:
`#variant-switcher-slot` (Regular/Irregular/Reflexivos tabs — put this one in
the intro band, next to the title) and `#series-switcher-slot` (Serie 1/2/...
— put this one in the white area, above `#exercise-app`). The URL ends up
looking like `presente.html?type=irregular&set=2`; switching variant always
lands on that variant's set 1, since set numbers don't mean anything across
variants.

To add a fourth variant later: new CSV, add its slug to `data-variants`,
done — no JS changes needed. A topic that *doesn't* need this (ser/estar,
por/para) just keeps the plain `data-src` attribute and never renders a
variant tab at all.

## Splitting a topic into exercise types (Dos opciones / Arrastra / Parejas)

Some topics — Ser y estar first — offer the same content practiced through
different mechanics: a two-option choice, a drag-word-into-blank exercise,
or a drag-to-match two-column exercise. This is a third, independent
dimension on top of "set" and "variant": it's driven by `?tipo=` in the
URL and, unlike variants, each type needs its own **engine**, not just its
own CSV, since the interaction itself is different.

On the page (`exercises/ser-estar.html`), `#exercise-app` is left with no
`data-src` at all. Instead, all three engine scripts are loaded, and a small
inline script at the bottom of the page hands control to
`ExerciseCommon.initExerciseTypePage(...)`:

```html
<script src="/js/exercise-common.js"></script>
<script src="/js/exercise-choice2.js"></script>
<script src="/js/exercise-arrastra.js"></script>
<script src="/js/exercise-parejas.js"></script>
<script src="/js/main.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    ExerciseCommon.initExerciseTypePage([
      { id: 'dos-opciones', label: 'Dos opciones', engine: 'choice2', src: '/content/exercises/ser-estar.csv' },
      { id: 'arrastra', label: 'Arrastra', engine: 'arrastra', src: '/content/exercises/ser-estar-arrastra.csv' },
      { id: 'parejas', label: 'Parejas', engine: 'parejas', src: '/content/exercises/ser-estar-parejas.csv' },
    ]);
  });
</script>
```

Every engine registers itself on `window.ExerciseEngines[id].init(container)`
instead of self-starting on `DOMContentLoaded` (it still self-starts on
pages that set `data-src` directly, like `por-para.html` — this only
changes on pages using the type router). `initExerciseTypePage` reads
`?tipo=` from the URL (defaulting to the first type), renders the
"Dos opciones / Arrastra / Parejas" tabs into `#exercise-type-slot`
(right below the intro band), points `#exercise-app` at the matching CSV,
and calls that type's `init`. Switching type always lands on set 1 of the
new type, same reasoning as switching verb-type variants. Adding a fourth
type later to a topic is: write its CSV, write its engine (or reuse an
existing one against a new CSV), add one more entry to the array above —
no other page needs to change.

**Arrastra** CSV columns — one word bank per set, built from the `word`
column of every row:

```
set,id,before,after,word
1,1,"Ella","muy cansada hoy.",está
```

**Parejas** CSV columns — a fixed left-hand subject with the verb form that
belongs to it:

```
set,id,subject,verb
1,1,Yo,estoy
```

Both engines present themselves as "drag the word/box into place," but the
actual interaction is **click/tap to select, then click/tap the target to
place it** — not native HTML5 drag-and-drop. Real drag-and-drop needs extra
polyfill code to work reliably on touchscreens, whereas click/tap works
identically on desktop, mobile, and keyboard (every chip and slot is a real
`<button>`, so Tab + Enter/Space already places things without any extra
code). Visually it still reads as "boxes you move around"; functionally
it's more robust and accessible than true dragging. If the felt experience
of physically dragging turns out to matter, that could be added later as a
progressive enhancement on top of the same click/tap logic, but it isn't
needed for the exercise to work correctly today.

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
before switching to one file per topic. `content/exercises/presente.csv` is
similarly superseded now that Presente split into
`presente-regular.csv`/`presente-irregular.csv`/`presente-reflexivos.csv` (its
old content was copied into `presente-regular.csv` first, nothing was lost).
None of these three are used by any live page but weren't deleted — feel
free to delete them yourself in File Explorer whenever convenient.

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

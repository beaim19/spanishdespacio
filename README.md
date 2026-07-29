# Spanish Despacio

Static site (no build step) for practicing Spanish: podcasts, exercises, and an
embedded R Shiny app for DELE A2 exam practice. Hosted on GitHub Pages,
custom domain `spanishdespacio.com` via Porkbun DNS.

## Structure

```
index.html               Home page
podcasts.html             Podcasts, organized by theme (anchor-nav index)
exercises.html            Exercises index — Ser y estar / Por y para / Adjetivos /
                          Números as top-level topics, plus "Verbos" as a
                          dropdown grouping every verb tense (see below)
exercises/*.html          One page per topic (ser-estar.html, por-para.html,
                          adjetivos.html, numeros.html, presente.html, ...)
dele.html                 DELE A2 Shiny app (iframe)
about.html                About / contact
privacy.html              Privacy & cookies policy
css/styles.css            All site styles (colors match the DELE app)
js/main.js                Shared header/footer injection, mobile nav
js/theme-menu.js          Accessible dropdown for theme-index rows that group
                          several sub-topics (used by "Verbos")
js/exercise-common.js     Shared CSV loading, series pager, verb-type and
                          exercise-type switchers
js/exercise-choice2.js    "Pick between two options" exercise engine (Dos opciones)
js/exercise-arrastra.js   "Drag a word into the blank" exercise engine (Empareja)
js/exercise-typed.js      Typed-answer exercise engine (Completa) — also
                          reused, unmodified, as Presente's conjugation drill
js/exercise-flashcards.js Self-paced reveal-and-self-assess exercise engine (Flashcards)
js/exercise-ordena.js     Sentence word-reordering exercise engine (Ordena)
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

For a topic that has variants but only ever needs ONE exercise engine (no
type-switcher), the container can tell that engine about the variants
directly instead of a single `data-src`:

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
variants. To add a fourth variant later: new CSV, add its slug to
`data-variants`, done — no JS changes needed. A topic that doesn't need
variants at all (ser/estar, por/para, adjetivos, números) just keeps the
plain `data-src` attribute and never renders a variant tab.

Presente itself has since grown past this simple case — it now also offers
several exercise *types* per variant — see the combined pattern below.

## Splitting a topic into exercise types (Dos opciones / Empareja / Completa / Flashcards / Ordena)

Some topics offer the same content practiced through several different
mechanics. This is a third, independent dimension on top of "set" and
"variant": it's driven by `?tipo=` in the URL and, unlike variants, each
type needs its own **engine**, not just its own CSV, since the interaction
itself is different. A topic doesn't have to offer all five — it's just
whichever entries you list in its page's router array. Current lineup:

- **Ser y estar** and **Adjetivos** — all five types.
- **Por y para** — Dos opciones and Flashcards only.
- **Números** — Empareja, Completa, and Flashcards only (no two-way choice
  or word-order drill makes sense for numbers).
- **Presente** — Empareja, Completa, Flashcards, and Ordena, *combined*
  with its Regular/Irregular/Reflexivos variants — see the dedicated
  section below, since that combination needed the router to do a bit more.

On the page (`exercises/ser-estar.html`), `#exercise-app` is left with no
`data-src` at all. Instead, every engine script the topic uses is loaded,
and a small inline script at the bottom of the page hands control to
`ExerciseCommon.initExerciseTypePage(...)`:

```html
<script src="/js/exercise-common.js"></script>
<script src="/js/exercise-choice2.js"></script>
<script src="/js/exercise-arrastra.js"></script>
<script src="/js/exercise-typed.js"></script>
<script src="/js/exercise-flashcards.js"></script>
<script src="/js/exercise-ordena.js"></script>
<script src="/js/main.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    ExerciseCommon.initExerciseTypePage([
      { id: 'dos-opciones', label: 'Dos opciones', engine: 'choice2', src: '/content/exercises/ser-estar.csv' },
      { id: 'empareja', label: 'Empareja', engine: 'arrastra', src: '/content/exercises/ser-estar-arrastra.csv' },
      { id: 'completa', label: 'Completa', engine: 'typed', src: '/content/exercises/ser-estar-completa.csv' },
      { id: 'flashcards', label: 'Flashcards', engine: 'flashcards', src: '/content/exercises/ser-estar.csv' },
      { id: 'ordena', label: 'Ordena', engine: 'ordena', src: '/content/exercises/ser-estar-ordena.csv' },
    ]);
  });
</script>
```

Every engine registers itself on `window.ExerciseEngines[id].init(container)`
instead of self-starting on `DOMContentLoaded` (it still self-starts on
pages that set `data-src`/`data-variants` directly, like `por-para.html`
and `presente.html` — this only changes on pages using the type router).
`initExerciseTypePage` reads `?tipo=` from the URL (defaulting to the first
type), renders the tabs into `#exercise-type-slot` (right below the intro
band), points `#exercise-app` at the matching CSV, and calls that type's
`init`. Switching type always lands on set 1 of the new type, same
reasoning as switching verb-type variants. Note the `id` (used in the URL
and shown as the tab label) and the `engine` key are independent — that's
what let "Arrastra" get renamed to "Empareja" in the UI without touching
the underlying `exercise-arrastra.js` file, and what lets Flashcards point
its `engine` at a brand-new file while reusing an existing CSV via `src`.

**Empareja** (`js/exercise-arrastra.js` — internal id kept as "arrastra" for
continuity with the file/CSV names) CSV columns — one word bank, shown
*above* the sentences, built from the `word` column of every row:

```
set,id,before,after,word
1,1,"Ella","muy cansada hoy.",está
```

**Completa** reuses the typed-answer engine (`js/exercise-typed.js`, the
same one Presente uses), with one extra optional column, `tense` — useful
here because one set can mix several indicative tenses instead of drilling
just one:

```
set,id,before,after,infinitive,tense,correct
1,1,"Cuando era pequeña, mi hermana",muy tímida.,ser,pretérito imperfecto,era
```

Renders the hint as "(ser, pretérito imperfecto)" instead of just
"(ser)" when the column is present; a plain conjugation CSV without a
`tense` column (like Presente's) renders exactly as before.

Completa isn't only for verbs — the hint column itself is `infinitive` OR
`hint`, whichever the CSV has (falls back to `infinitive` first, for the
existing verb CSVs). Adjetivos' Completa uses `hint` to show the base
(masculine singular) form of the adjective, e.g. "(rápido)" as the hint
for typing "rápida"; Números' Completa uses `hint` to show the digit, e.g.
"(20)" as the hint for typing "veinte".

**Flashcards** (`js/exercise-flashcards.js`) is deliberately *not* a graded
quiz — one sentence at a time, "Mostrar respuesta" reveals the answer, then
the student self-reports "La sabía" / "No la sabía" and moves to the next
card, ending with a "Sabías X de Y" summary and a "Repetir esta serie"
button. It only reads the `before`/`after`/`correct` columns, so it can
point straight at a topic's existing Dos opciones CSV (as above, reusing
`ser-estar.csv` — no new content file needed); a topic without one just
needs a plain `set,id,before,after,correct` CSV instead.

**Ordena** (`js/exercise-ordena.js`) shuffles a sentence's words into a word
bank; the student taps them in the right order to rebuild it. CSV columns:

```
set,id,correct,also_correct
1,1,Ella está muy cansada hoy.,Hoy ella está muy cansada.
```

`correct` is the sentence written out normally — its words (split on
whitespace) become that sentence's shuffled word bank. Spanish word order
is often flexible (adverbs and time expressions especially can usually
move to the front or the end), so a sentence can have more than one
legitimate order: `also_correct` holds any other accepted orders of the
*same words*, separated by `|` if there's more than one — leave it blank
if the sentence only has one natural order. Grading ignores case and
punctuation entirely (only word order is actually being tested — moving a
word to the front changes its capitalization and can shift the final
period to a different word, neither of which the exercise cares about).

Empareja, Completa's typed input, and Ordena all present themselves as
"drag/write the thing into place," but the actual interaction (where it
isn't literally typing) is **click/tap to select, then click/tap the
target** — not native HTML5 drag-and-drop. Real drag-and-drop needs extra
polyfill code to work reliably on touchscreens, whereas click/tap works
identically on desktop, mobile, and keyboard (every chip and slot is a real
`<button>`, so Tab + Enter/Space already places things without any extra
code). If the felt experience of physically dragging turns out to matter,
that could be added later as a progressive enhancement on top of the same
click/tap logic, but it isn't needed for the exercises to work correctly
today.

## Combining verb-type variants with exercise types (Presente)

Presente needs both dimensions at once: Regular/Irregular/Reflexivos
*and* Empareja/Completa/Flashcards/Ordena, all independent of each other
and of "set". `initExerciseTypePage` takes an optional second argument for
this — pass `{ variants: [...] }` and give each type entry a `srcTemplate`
(containing `{type}`) instead of a fixed `src`:

```html
<script>
  document.addEventListener('DOMContentLoaded', () => {
    ExerciseCommon.initExerciseTypePage([
      { id: 'empareja', label: 'Empareja', engine: 'arrastra', srcTemplate: '/content/exercises/presente-{type}-empareja.csv' },
      { id: 'completa', label: 'Completa', engine: 'typed', srcTemplate: '/content/exercises/presente-{type}.csv' },
      { id: 'flashcards', label: 'Flashcards', engine: 'flashcards', srcTemplate: '/content/exercises/presente-{type}.csv' },
      { id: 'ordena', label: 'Ordena', engine: 'ordena', srcTemplate: '/content/exercises/presente-{type}-ordena.csv' },
    ], { variants: ['regular', 'irregular', 'reflexivos'] });
  });
</script>
```

With `variants` given, the router renders the Regular/Irregular/Reflexivos
tabs into `#variant-switcher-slot` itself (the container no longer needs
`data-variants`/`data-src-template` — those only matter for the simple,
type-router-free case described above), resolves `{type}` against whichever
variant is selected, and hands the fully-resolved URL to the chosen
engine. The URL ends up looking like
`presente.html?tipo=completa&type=irregular&set=2`; switching either
variant or exercise type independently preserves the other one and resets
`set` to 1 (new combination, no reason the old series number would still
line up). Completa reuses the exact same `presente-{type}.csv` files
Presente always had — nothing changed there — while Empareja and Ordena
needed their own new CSVs per variant (`presente-regular-empareja.csv`,
`presente-regular-ordena.csv`, etc.), same column layouts described above,
just one file per variant instead of one file for the whole topic.

## Grouping topics behind a dropdown (Verbos)

`exercises.html` lists most topics as a single clickable row, but tenses
(Presente, Pasado, Futuro...) are all "Verbos" to a student choosing what to
practice, so they're grouped behind one row that opens a small menu instead
of every tense getting its own top-level row:

```html
<div class="theme-block theme-menu-wrapper">
  <button type="button" class="theme-menu-toggle" aria-expanded="false" aria-haspopup="true" aria-controls="verbos-menu">
    <div class="theme-block-text"><h2>Verbos</h2><p>...</p></div>
    <span class="theme-block-arrow theme-menu-caret" aria-hidden="true">&darr;</span>
  </button>
  <ul class="theme-menu" id="verbos-menu">
    <li><a href="/exercises/presente.html">Presente</a></li>
    <li class="theme-menu-empty-item">Pasado <em>(Próximamente)</em></li>
    <!-- ...one <li> per tense... -->
  </ul>
</div>
```

`js/theme-menu.js` wires up any `.theme-menu-wrapper` it finds on the page:
click/tap toggles it (works on touch and via Enter/Space on the button,
since it's a real `<button>`), hovering the whole component open on desktop
is purely an added convenience on top of that, Escape closes it and returns
focus to the toggle, and clicking outside closes it too. To add a topic
under Verbos later: add another `<li>` (a link if it's built, a
`.theme-menu-empty-item` if not) — no JS changes needed. A second grouped
category later would just reuse the same `.theme-menu-wrapper` markup with
a different id.

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

`js/exercise-parejas.js` and `content/exercises/ser-estar-parejas.csv` are
similarly unused now — Ser y estar's "Parejas" exercise type was removed
(two-column drag-to-match, subject → conjugated form). Neither file is
referenced from any page anymore; delete them yourself whenever convenient.

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

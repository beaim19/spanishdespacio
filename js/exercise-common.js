/*
 * Shared helper for every exercise engine: fetch a topic's CSV, and filter
 * it down to whichever "set" of ~10 the URL asks for (?set=2, default 1).
 * This is the "one CSV per topic" pattern used across exercise-choice2.js,
 * exercise-arrastra.js, exercise-parejas.js, exercise-typed.js, and any
 * future exercise type — written once here so adding a new exercise type
 * never means re-implementing CSV loading.
 *
 * Requires PapaParse to be loaded before this script.
 */
window.ExerciseCommon = (function () {
  async function loadCsvSet(src) {
    const requestedSet = (new URLSearchParams(window.location.search).get('set') || '1').trim();

    const res = await fetch(src);
    if (!res.ok) throw new Error(`${src} respondió ${res.status}`);
    const csvText = await res.text();
    const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });

    const allSets = [...new Set(data.map((r) => (r.set || '').trim()).filter(Boolean))];
    const rows = data.filter((r) => (r.set || '').trim() === requestedSet);

    return { rows, requestedSet, allSets, totalSets: allSets.length };
  }

  /*
   * Builds the series pager shown above the questions once a topic has more
   * than one set: a "‹" / "›" arrow to step to the previous/next series,
   * with each series number shown in between as its own clickable link
   * (current one marked with aria-current). Lighter-weight than a row of
   * pill buttons — plain links to ?set=N, so no extra JS wiring beyond
   * calling this once. Returns null if there's only one set, since a
   * switcher for one option isn't useful.
   */
  function buildSeriesPager(allSets, currentSet) {
    if (!allSets || allSets.length <= 1) return null;

    const sorted = [...allSets].sort((a, b) => Number(a) - Number(b));
    const currentIndex = sorted.indexOf(currentSet);

    // Clones the current URL's params and only changes "set" — this is
    // what keeps ?type=irregular (or ?tipo=arrastra) intact when a page
    // also has a verb-type or exercise-type switcher.
    function hrefForSet(setId) {
      const params = new URLSearchParams(window.location.search);
      params.set('set', setId);
      return `?${params.toString()}`;
    }

    const nav = document.createElement('nav');
    nav.className = 'series-pager';
    nav.setAttribute('aria-label', 'Elegir serie');

    const prev = document.createElement('a');
    prev.className = 'series-pager-arrow';
    prev.textContent = '‹';
    prev.setAttribute('aria-label', 'Serie anterior');
    if (currentIndex > 0) {
      prev.href = hrefForSet(sorted[currentIndex - 1]);
    } else {
      prev.setAttribute('aria-disabled', 'true');
      prev.tabIndex = -1;
    }

    const numbers = document.createElement('span');
    numbers.className = 'series-pager-numbers';
    sorted.forEach((setId) => {
      const a = document.createElement('a');
      a.href = hrefForSet(setId);
      a.textContent = setId;
      a.setAttribute('aria-label', `Serie ${setId}`);
      if (setId === currentSet) a.setAttribute('aria-current', 'true');
      numbers.appendChild(a);
    });

    const next = document.createElement('a');
    next.className = 'series-pager-arrow';
    next.textContent = '›';
    next.setAttribute('aria-label', 'Serie siguiente');
    if (currentIndex < sorted.length - 1) {
      next.href = hrefForSet(sorted[currentIndex + 1]);
    } else {
      next.setAttribute('aria-disabled', 'true');
      next.tabIndex = -1;
    }

    nav.appendChild(prev);
    nav.appendChild(numbers);
    nav.appendChild(next);
    return nav;
  }

  /*
   * Puts the series pager into the page's #series-switcher-slot (in the
   * white area, above the questions) and returns a "Serie X" label element
   * for the engine to place above the questions themselves — or null if
   * there's only one series, since neither is useful when there's nothing
   * to switch between.
   */
  function renderSeriesNav(setNumber, allSets) {
    const slot = document.getElementById('series-switcher-slot');
    if (slot) {
      slot.innerHTML = '';
      const pager = buildSeriesPager(allSets, setNumber);
      if (pager) slot.appendChild(pager);
    }

    if (!allSets || allSets.length <= 1) return null;

    // A fragment (not a single element) since this now bundles the "Serie
    // N" heading with a note underneath it — callers already just do
    // `container.appendChild(label)`, and appendChild on a DocumentFragment
    // moves both children into place in order, so no call site needed to
    // change when this grew from one element to two.
    const fragment = document.createDocumentFragment();

    const label = document.createElement('h2');
    label.className = 'exercise-current-set';
    label.textContent = `Serie ${setNumber}`;
    fragment.appendChild(label);

    const note = document.createElement('p');
    note.className = 'exercise-difficulty-note';
    note.textContent = 'La dificultad de los ejercicios aumenta en cada serie.';
    fragment.appendChild(note);

    return fragment;
  }

  /*
   * Word-level translation hints — {palabra|translation} written inline
   * inside a sentence field marks just that one word as hoverable, not the
   * whole sentence. Deliberately curly braces, not square brackets, so
   * this never collides with Texto's [correct|decoy] blank syntax — a
   * Texto passage can carry both in the same `text` field. Desktop shows
   * the tooltip on :hover/:focus for free via CSS alone; touch has no
   * hover, so attachHintLongPress() below adds a press-and-hold
   * equivalent.
   */
  function buildHintSpan(word, translation) {
    const span = document.createElement('span');
    span.className = 'hint-word';
    span.tabIndex = 0;
    span.appendChild(document.createTextNode(word));
    if (translation) {
      span.setAttribute('aria-label', `${word}: ${translation}`);
      const tooltip = document.createElement('span');
      tooltip.className = 'hint-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.textContent = translation;
      span.appendChild(tooltip);
    }
    return span;
  }

  // Parses {word|translation} out of a sentence fragment and returns a
  // DocumentFragment mixing plain text nodes with hoverable spans — drop
  // this in wherever a `before`/`after`/passage string used to go straight
  // into document.createTextNode(). A run with no braces at all just comes
  // back as a single text node, so this is safe to use unconditionally.
  function renderTextWithHints(text) {
    const fragment = document.createDocumentFragment();
    const str = text || '';
    const regex = /\{([^}|]+)(?:\|([^}]*))?\}/g;
    let lastIndex = 0;
    let match = regex.exec(str);
    while (match !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(str.slice(lastIndex, match.index)));
      }
      fragment.appendChild(buildHintSpan(match[1].trim(), (match[2] || '').trim()));
      lastIndex = regex.lastIndex;
      match = regex.exec(str);
    }
    if (lastIndex < str.length) {
      fragment.appendChild(document.createTextNode(str.slice(lastIndex)));
    }
    return fragment;
  }

  // For the few places a sentence has to stay a plain STRING rather than
  // become DOM nodes (e.g. Ordena's "Orden correcto: ..." reveal, or a
  // grading comparison) — strips {word|translation} down to just "word",
  // same text a student would actually see.
  function stripHints(text) {
    return (text || '').replace(/\{([^}|]+)(?:\|[^}]*)?\}/g, '$1').trim();
  }

  // Touch has no :hover, so this is the press-and-hold equivalent — finds
  // every hoverable word/chip under `root` that actually carries a tooltip
  // and wires up a ~500ms long-press to reveal it via a `.hint-visible`
  // class (CSS shows the tooltip on :hover, :focus, OR .hint-visible).
  // Also swallows the synthetic click a long-press would otherwise still
  // fire afterward — without that, holding a word bank chip to check its
  // translation would also select/place it, which isn't what a long-press
  // is for. Call this once after an engine finishes rendering into the
  // page (safe to call more than once on the same page; each element only
  // gets listeners attached the first time a search find it, since nothing
  // here is re-queried elsewhere).
  function attachHintLongPress(root) {
    if (!root) return;
    const LONG_PRESS_MS = 500;

    root.querySelectorAll('.hint-word, .pool-chip, .ordena-word').forEach((el) => {
      if (!el.querySelector('.hint-tooltip') || el.dataset.hintPressWired) return;
      el.dataset.hintPressWired = 'true';

      let pressTimer = null;
      let longPressed = false;
      let autoHideTimer = null;

      function showHint() {
        document.querySelectorAll('.hint-visible').forEach((other) => {
          if (other !== el) other.classList.remove('hint-visible');
        });
        el.classList.add('hint-visible');
        clearTimeout(autoHideTimer);
        autoHideTimer = setTimeout(() => el.classList.remove('hint-visible'), 3000);
      }

      el.addEventListener('touchstart', () => {
        longPressed = false;
        pressTimer = setTimeout(() => {
          longPressed = true;
          showHint();
        }, LONG_PRESS_MS);
      }, { passive: true });

      el.addEventListener('touchend', (e) => {
        clearTimeout(pressTimer);
        if (longPressed) e.preventDefault();
      });

      el.addEventListener('touchmove', () => clearTimeout(pressTimer));
      el.addEventListener('touchcancel', () => clearTimeout(pressTimer));
    });
  }

  /*
   * Verb-type support (regular/irregular/reflexivos, etc.) — a second,
   * independent dimension from "set". Reads ?type= from the URL, defaults
   * to the first variant if it's missing or not recognized.
   */
  function getRequestedType(variants) {
    const requested = (new URLSearchParams(window.location.search).get('type') || '').trim();
    return variants.includes(requested) ? requested : variants[0];
  }

  function capitalize(word) {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  // A plain capitalize() can't add accents that aren't in the variant id
  // itself (ids are kept plain-ASCII on purpose, since they show up in the
  // URL as ?type=articulos) — this covers the cases where the displayed
  // label needs one. Add to this list as new accented variant ids come up.
  const VARIANT_LABELS = {
    articulos: 'Artículos',
  };

  function labelForVariant(typeId) {
    return VARIANT_LABELS[typeId] || capitalize(typeId);
  }

  /*
   * Renders the Regular / Irregular / Reflexivos-style tabs into the
   * page's #variant-switcher-slot (meant to live in the green intro band,
   * alongside the title). Switching type always lands on set 1 of the new
   * type — series numbering is independent per type, so carrying over the
   * old set number wouldn't mean anything. No-op if there's only one variant.
   */
  function renderVariantNav(variants, currentType) {
    const slot = document.getElementById('variant-switcher-slot');
    if (!slot) return;
    slot.innerHTML = '';

    if (!variants || variants.length <= 1) return;

    const nav = document.createElement('nav');
    nav.className = 'type-switcher';
    nav.setAttribute('aria-label', 'Elegir tipo de verbo');

    const list = document.createElement('ul');
    variants.forEach((typeId) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      // Clones the current URL's params and only changes "type" — this is
      // what keeps ?tipo=completa (exercise type) intact on topics that
      // combine both a verb-type switcher and an exercise-type switcher
      // (e.g. Presente). Still resets "set", since series numbers aren't
      // shared across verb-type variants either.
      const params = new URLSearchParams(window.location.search);
      params.set('type', typeId);
      params.delete('set');
      a.href = `?${params.toString()}`;
      a.textContent = labelForVariant(typeId);
      if (typeId === currentType) a.setAttribute('aria-current', 'true');
      li.appendChild(a);
      list.appendChild(li);
    });

    nav.appendChild(list);
    slot.appendChild(nav);
  }

  /*
   * Exercise-TYPE support (Dos opciones / Arrastra / Parejas, etc.) — a
   * topic can offer several fundamentally different exercise mechanics,
   * each with its own engine and its own CSV. This is a third, independent
   * dimension from "set" and from verb-"type": reads ?tipo= from the URL,
   * defaults to the first type if missing/not recognized.
   *
   * Each `types` entry looks like:
   *   { id: 'dos-opciones', label: 'Dos opciones', engine: 'choice2',
   *     src: '/content/exercises/ser-estar.csv' }
   *
   * Every engine registers itself on window.ExerciseEngines[id].init(container)
   * instead of self-initializing on DOMContentLoaded, so the router below can
   * decide which one actually runs.
   */
  function getRequestedExerciseType(types) {
    const requested = (new URLSearchParams(window.location.search).get('tipo') || '').trim();
    return types.some((t) => t.id === requested) ? requested : types[0].id;
  }

  /*
   * Renders the Dos opciones / Arrastra / Parejas tabs into the page's
   * #exercise-type-slot — same pill treatment the series switcher used to
   * have, since this is now the switcher that lives right below the intro
   * band. No-op if there's only one type.
   */
  function renderExerciseTypeNav(types, currentTypeId) {
    const slot = document.getElementById('exercise-type-slot');
    if (!slot) return;
    slot.innerHTML = '';

    if (!types || types.length <= 1) return;

    const nav = document.createElement('nav');
    nav.className = 'exercise-type-nav';
    nav.setAttribute('aria-label', 'Elegir tipo de ejercicio');

    const list = document.createElement('ul');
    types.forEach((t) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      // Switching exercise type always lands on set 1 of the new type —
      // set numbers aren't shared between types, so carrying the old one
      // over wouldn't point at anything meaningful.
      const params = new URLSearchParams(window.location.search);
      params.set('tipo', t.id);
      params.delete('set');
      a.href = `?${params.toString()}`;
      a.textContent = t.label;
      if (t.id === currentTypeId) a.setAttribute('aria-current', 'true');
      li.appendChild(a);
      list.appendChild(li);
    });

    nav.appendChild(list);
    slot.appendChild(nav);
  }

  /*
   * Entry point for a topic page that offers several exercise types.
   * Figures out which type is selected, renders the tabs, points
   * #exercise-app at the right CSV, and hands off to that type's engine.
   *
   * A topic that ALSO splits into verb-type variants (Presente's
   * Regular/Irregular/Reflexivos) passes `{ variants: [...] }` as a second
   * argument — combining both dimensions. When variants are given, each
   * `types` entry uses `srcTemplate` (containing "{type}") instead of a
   * fixed `src`, e.g. '/content/exercises/presente-{type}-empareja.csv',
   * and this also renders the variant tabs into #variant-switcher-slot.
   * Topics without variants just omit the second argument entirely and
   * every type entry uses a plain `src` — unchanged from before.
   */
  function initExerciseTypePage(types, options) {
    const container = document.getElementById('exercise-app');
    if (!container) return;

    const opts = options || {};
    const variants = opts.variants || null;

    const currentTypeId = getRequestedExerciseType(types);
    const current = types.find((t) => t.id === currentTypeId) || types[0];

    renderExerciseTypeNav(types, currentTypeId);

    let resolvedSrc = current.src;
    if (variants && variants.length > 0) {
      const currentVariant = getRequestedType(variants);
      renderVariantNav(variants, currentVariant);
      const template = current.srcTemplate || current.src;
      resolvedSrc = template.replace('{type}', currentVariant);
    }

    container.dataset.src = resolvedSrc;
    const engine = window.ExerciseEngines && window.ExerciseEngines[current.engine];
    if (!engine) {
      container.innerHTML = '<p>No se pudo cargar el ejercicio. Inténtalo de nuevo más tarde.</p>';
      return;
    }
    engine.init(container);
  }

  return {
    loadCsvSet,
    buildSeriesPager,
    renderSeriesNav,
    getRequestedType,
    renderVariantNav,
    getRequestedExerciseType,
    renderExerciseTypeNav,
    initExerciseTypePage,
    renderTextWithHints,
    stripHints,
    attachHintLongPress,
  };
})();

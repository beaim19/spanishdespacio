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

    const label = document.createElement('h2');
    label.className = 'exercise-current-set';
    label.textContent = `Serie ${setNumber}`;
    return label;
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
      a.textContent = capitalize(typeId);
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
  };
})();

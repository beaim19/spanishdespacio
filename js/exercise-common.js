/*
 * Shared helper for every exercise engine: fetch a topic's CSV, and filter
 * it down to whichever "set" of ~10 the URL asks for (?set=2, default 1).
 * This is the "one CSV per topic" pattern used across exercise-choice2.js,
 * exercise-typed.js, and any future exercise type — written once here so
 * adding a new exercise type never means re-implementing CSV loading.
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
   * Builds the "Serie 1 / Serie 2 / ..." pill nav shown at the top of an
   * exercise page once a topic has more than one set — plain links to
   * ?set=N on the same page, so it works with zero extra JS wiring beyond
   * calling this once. Returns null (nothing to render) if there's only
   * one set, since a switcher for one option isn't useful.
   */
  function buildSetSwitcher(allSets, currentSet) {
    if (!allSets || allSets.length <= 1) return null;

    const nav = document.createElement('nav');
    nav.className = 'set-switcher';
    nav.setAttribute('aria-label', 'Elegir serie');

    const list = document.createElement('ul');
    const sorted = [...allSets].sort((a, b) => Number(a) - Number(b));

    sorted.forEach((setId) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `?set=${encodeURIComponent(setId)}`;
      a.textContent = `Serie ${setId}`;
      if (setId === currentSet) a.setAttribute('aria-current', 'true');
      li.appendChild(a);
      list.appendChild(li);
    });

    nav.appendChild(list);
    return nav;
  }

  /*
   * Puts the series switcher into the page's #series-switcher-slot (which
   * lives in the green intro band, not next to the questions) and returns
   * a "Serie X" label element for the engine to place above the questions
   * themselves — or null if there's only one series, since neither is
   * useful when there's nothing to switch between.
   */
  function renderSeriesNav(setNumber, allSets) {
    const slot = document.getElementById('series-switcher-slot');
    if (slot) {
      slot.innerHTML = '';
      const switcher = buildSetSwitcher(allSets, setNumber);
      if (switcher) slot.appendChild(switcher);
    }

    if (!allSets || allSets.length <= 1) return null;

    const label = document.createElement('p');
    label.className = 'exercise-current-set';
    label.textContent = `Serie ${setNumber}`;
    return label;
  }

  return { loadCsvSet, buildSetSwitcher, renderSeriesNav };
})();

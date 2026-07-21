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

    return { rows, requestedSet, totalSets: allSets.length };
  }

  return { loadCsvSet };
})();

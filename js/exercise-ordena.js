/*
 * "Ordena" exercise engine: the student is given a sentence's words as a
 * shuffled bank and has to tap them in order to rebuild the sentence.
 *
 * Spanish word order is often more flexible than English (adverbs and
 * time expressions in particular can usually move to the front or the
 * end), so a single sentence can have more than one correct order. Rather
 * than pick one "true" order and mark every other valid rearrangement
 * wrong, this engine accepts a list of orders per sentence — see the
 * also_correct column below — and grades ignoring case and punctuation,
 * since only word order is actually being tested here (moving a word to
 * the front of the sentence changes its capitalization and can move the
 * final period to a different word, neither of which is the point of the
 * exercise).
 *
 * One CSV per TOPIC (not per set of 10) — new sets are just more rows.
 * Expected CSV columns: set, id, correct, also_correct
 *   correct      = the sentence written out normally, in ONE accepted
 *                  order — its words (split on whitespace) become the
 *                  shuffled word bank for that sentence
 *   also_correct = optional, other accepted orders for the same words,
 *                  separated by "|" if there's more than one, e.g.
 *                  "Hoy ella está muy cansada|Ella hoy está muy cansada"
 *                  Leave blank if the sentence only has one natural order.
 *
 * `correct` can also mark individual words for a hover/long-press
 * translation using {word|translation} — e.g. "Ella {compró|bought} un
 * regalo." — same {...} syntax as every other engine (see
 * renderTextWithHints() in exercise-common.js), just applied to a sentence
 * that gets tokenized into chips instead of rendered as running text. Only
 * mark single words this way, not phrases — a chip has to correspond to
 * one thing the student physically places, so bracketing multiple words
 * together would remove them from the word-order test entirely. Optional;
 * `also_correct` doesn't need brackets repeated in it — a translation only
 * has to be defined once, on `correct`.
 *
 * Host page needs, before this script:
 *   1. PapaParse (loaded via CDN)
 *   2. js/exercise-common.js
 *   3. A container: <div id="exercise-app" data-src="/content/exercises/ser-estar-ordena.csv"></div>
 *
 * Registers itself as window.ExerciseEngines.ordena.
 */

(function () {
  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Splits a sentence into { display, translation } tokens — brace-aware,
  // so a {word|translation} unit stays one token even when the English
  // translation itself contains spaces (e.g. "{cansado|tired out}"),
  // rather than getting torn apart by a plain whitespace split.
  function tokenizeWithHints(sentence) {
    const str = (sentence || '').trim();
    if (!str) return [];
    const rawTokens = str.match(/\{[^}]*\}[.,!?¿¡]*|\S+/g) || [];
    return rawTokens.map((token) => {
      const match = token.match(/^\{([^}|]*)(?:\|([^}]*))?\}([.,!?¿¡]*)$/);
      if (!match) return { display: token, translation: '' };
      const [, word, translation, trailing] = match;
      return { display: `${word}${trailing || ''}`, translation: (translation || '').trim() };
    });
  }

  // The capital letter on the first word and the period (or ! / ?) on the
  // last are hints about where a word belongs, not part of what's actually
  // being tested — leaving them in the shuffled word bank would give away
  // the start/end of the sentence before the student has worked anything
  // out. Only the display text changes here; grading still runs through
  // normalizeForCompare(), which already ignores case and punctuation, so
  // this has no effect on what counts as correct.
  function stripPositionalHints(tokens) {
    if (tokens.length === 0) return tokens;
    const result = tokens.map((t) => ({ ...t }));
    result[0].display = result[0].display.charAt(0).toLowerCase() + result[0].display.slice(1);
    const lastIndex = result.length - 1;
    result[lastIndex].display = result[lastIndex].display.replace(/[.,!?¿¡]+$/, '');
    return result;
  }

  // Case- and punctuation-insensitive, so a word moving to the front (and
  // picking up a capital letter) or the period landing on a different
  // word doesn't count against the student — only the order of the words
  // themselves is being graded.
  function normalizeForCompare(str) {
    return (str || '')
      .trim()
      .toLowerCase()
      .replace(/[.,!?¿¡]/g, '')
      .replace(/\s+/g, ' ');
  }

  async function loadExercise(container) {
    try {
      const { rows, requestedSet, allSets } = await window.ExerciseCommon.loadCsvSet(container.dataset.src);

      if (rows.length === 0) {
        container.innerHTML = `<p>No existe la serie ${requestedSet}.</p>`;
        return;
      }

      renderExercise(container, rows, requestedSet, allSets);
    } catch (err) {
      console.error('No se pudo cargar el ejercicio', err);
      container.innerHTML = '<p>No se pudo cargar el ejercicio. Inténtalo de nuevo más tarde.</p>';
    }
  }

  function renderExercise(container, rows, setNumber, allSets) {
    container.innerHTML = '';

    const label = window.ExerciseCommon.renderSeriesNav(setNumber, allSets);
    if (label) container.appendChild(label);

    const instructions = document.createElement('p');
    instructions.className = 'exercise-instructions';
    instructions.textContent = 'Toca las palabras en el orden correcto para formar la frase. Vuelve a tocar una palabra ya colocada para quitarla.';
    container.appendChild(instructions);

    const list = document.createElement('ol');
    list.className = 'exercise-list';

    rows.forEach((row, rowIndex) => {
      // stripHints() here since acceptedDisplay/acceptedNormalized end up
      // as plain strings (the "Orden correcto: ..." reveal text, and the
      // grading comparison) — {word|translation} markup would otherwise
      // show up literally instead of becoming a hoverable span, which only
      // happens for the word-bank chips built from tokenizeWithHints below.
      const acceptedDisplay = [row.correct]
        .concat((row.also_correct || '').split('|'))
        .map((s) => window.ExerciseCommon.stripHints((s || '').trim()))
        .filter(Boolean);
      const acceptedNormalized = acceptedDisplay.map(normalizeForCompare);

      const item = document.createElement('li');
      item.className = 'exercise-item ordena-item';
      item.dataset.correct = acceptedDisplay.join('|');
      item.dataset.correctNormalized = acceptedNormalized.join('|');

      const assembly = document.createElement('div');
      assembly.className = 'ordena-assembly';
      assembly.setAttribute('role', 'group');
      assembly.setAttribute('aria-label', `Frase ${rowIndex + 1}, en construcción`);

      const placeholder = document.createElement('span');
      placeholder.className = 'ordena-placeholder';
      placeholder.textContent = 'Toca las palabras de abajo en orden…';
      assembly.appendChild(placeholder);

      const bank = document.createElement('div');
      bank.className = 'word-pool ordena-bank';
      bank.setAttribute('role', 'group');
      bank.setAttribute('aria-label', `Palabras para la frase ${rowIndex + 1}`);

      function updatePlaceholder() {
        placeholder.hidden = assembly.querySelectorAll('.ordena-word').length > 0;
      }

      function addWord(chip) {
        if (chip.disabled) return;
        chip.disabled = true;
        chip.hidden = true;

        const word = document.createElement('button');
        word.type = 'button';
        word.className = 'ordena-word';
        // dataset.word (not textContent) is the actual word — chip.textContent
        // would also pull in the tooltip's translation text once one is
        // attached, since textContent concatenates ALL descendant text.
        word.dataset.word = chip.dataset.word;
        word.appendChild(document.createTextNode(chip.dataset.word));
        const tooltip = chip.querySelector('.hint-tooltip');
        if (tooltip) word.appendChild(tooltip.cloneNode(true));
        word.dataset.chipId = chip.dataset.chipId;
        word.addEventListener('click', () => removeWord(word, chip));
        assembly.appendChild(word);
        window.ExerciseCommon.attachHintLongPress(assembly);
        updatePlaceholder();
      }

      function removeWord(word, chip) {
        if (word.disabled) return;
        chip.disabled = false;
        chip.hidden = false;
        word.remove();
        updatePlaceholder();
      }

      const words = shuffle(stripPositionalHints(tokenizeWithHints(row.correct)));
      words.forEach((token, chipIndex) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pool-chip';
        chip.dataset.chipId = String(chipIndex);
        chip.dataset.word = token.display;
        chip.appendChild(document.createTextNode(token.display));
        if (token.translation) {
          const tooltip = document.createElement('span');
          tooltip.className = 'hint-tooltip';
          tooltip.setAttribute('role', 'tooltip');
          tooltip.textContent = token.translation;
          chip.appendChild(tooltip);
        }
        chip.addEventListener('click', () => addWord(chip));
        bank.appendChild(chip);
      });

      item.appendChild(assembly);
      item.appendChild(bank);
      list.appendChild(item);
    });

    container.appendChild(list);
    window.ExerciseCommon.attachHintLongPress(container);

    const controls = document.createElement('div');
    controls.className = 'exercise-controls';

    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'btn btn-primary';
    checkBtn.textContent = 'Comprobar';

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-secondary';
    retryBtn.textContent = 'Intentar de nuevo';
    retryBtn.hidden = true;

    const result = document.createElement('p');
    result.className = 'exercise-result';
    result.setAttribute('aria-live', 'polite');

    checkBtn.addEventListener('click', () => {
      const score = checkAnswers(list);
      result.textContent = `${score.correct} de ${score.total} correctas.`;
      checkBtn.hidden = true;
      retryBtn.hidden = false;
      list.querySelectorAll('.pool-chip, .ordena-word').forEach((el) => { el.disabled = true; });
    });

    retryBtn.addEventListener('click', () => {
      resetExercise(list);
      result.textContent = '';
      checkBtn.hidden = false;
      retryBtn.hidden = true;
    });

    controls.appendChild(checkBtn);
    controls.appendChild(retryBtn);
    container.appendChild(controls);
    container.appendChild(result);
  }

  function checkAnswers(list) {
    let correctCount = 0;
    const items = list.querySelectorAll('.ordena-item');

    items.forEach((item) => {
      const acceptedNormalized = item.dataset.correctNormalized.split('|');
      const acceptedDisplay = item.dataset.correct.split('|');
      const assembly = item.querySelector('.ordena-assembly');
      // dataset.word, not textContent — a placed word's textContent would
      // also include its cloned .hint-tooltip translation text once one is
      // attached, which would otherwise leak into the grading comparison.
      const attempt = [...assembly.querySelectorAll('.ordena-word')]
        .map((w) => (w.dataset.word || '').trim())
        .join(' ');

      if (acceptedNormalized.includes(normalizeForCompare(attempt))) {
        assembly.classList.add('ordena-assembly-correct');
        correctCount += 1;
      } else {
        assembly.classList.add('ordena-assembly-incorrect');
        const reveal = document.createElement('span');
        reveal.className = 'drop-slot-reveal';
        reveal.textContent = `Orden correcto: ${acceptedDisplay[0]}`;
        // Right after the assembly (the sentence itself), not after the
        // whole word bank below it — .ordena-assembly is a block-level flex
        // container, so this still lands on its own line right underneath.
        assembly.after(reveal);
      }
    });

    return { correct: correctCount, total: items.length };
  }

  function resetExercise(list) {
    list.querySelectorAll('.ordena-item').forEach((item) => {
      const assembly = item.querySelector('.ordena-assembly');
      assembly.classList.remove('ordena-assembly-correct', 'ordena-assembly-incorrect');
      assembly.querySelectorAll('.ordena-word').forEach((w) => w.remove());
      const placeholder = assembly.querySelector('.ordena-placeholder');
      if (placeholder) placeholder.hidden = false;

      item.querySelectorAll('.pool-chip').forEach((chip) => {
        chip.disabled = false;
        chip.hidden = false;
      });
    });
    list.querySelectorAll('.drop-slot-reveal').forEach((reveal) => reveal.remove());
  }

  window.ExerciseEngines = window.ExerciseEngines || {};
  window.ExerciseEngines.ordena = { init: loadExercise };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    if (container && container.dataset.src && !container.dataset.types) loadExercise(container);
  });
})();

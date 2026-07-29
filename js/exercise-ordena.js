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

  function tokenize(sentence) {
    return (sentence || '').trim().split(/\s+/).filter(Boolean);
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
      const acceptedDisplay = [row.correct]
        .concat((row.also_correct || '').split('|'))
        .map((s) => (s || '').trim())
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
        word.textContent = chip.textContent;
        word.dataset.chipId = chip.dataset.chipId;
        word.addEventListener('click', () => removeWord(word, chip));
        assembly.appendChild(word);
        updatePlaceholder();
      }

      function removeWord(word, chip) {
        if (word.disabled) return;
        chip.disabled = false;
        chip.hidden = false;
        word.remove();
        updatePlaceholder();
      }

      const words = shuffle(tokenize(row.correct));
      words.forEach((wordText, chipIndex) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pool-chip';
        chip.textContent = wordText;
        chip.dataset.chipId = String(chipIndex);
        chip.addEventListener('click', () => addWord(chip));
        bank.appendChild(chip);
      });

      item.appendChild(assembly);
      item.appendChild(bank);
      list.appendChild(item);
    });

    container.appendChild(list);

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
      const attempt = [...assembly.querySelectorAll('.ordena-word')]
        .map((w) => w.textContent.trim())
        .join(' ');

      if (acceptedNormalized.includes(normalizeForCompare(attempt))) {
        assembly.classList.add('ordena-assembly-correct');
        correctCount += 1;
      } else {
        assembly.classList.add('ordena-assembly-incorrect');
        const reveal = document.createElement('span');
        reveal.className = 'drop-slot-reveal';
        reveal.textContent = `Orden correcto: ${acceptedDisplay[0]}`;
        item.appendChild(reveal);
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

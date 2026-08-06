/*
 * "Empareja" exercise engine (internal id stays "arrastra" for continuity
 * with the file/CSV names already in place — only the user-facing label
 * changed): 10 sentences each with one blank, plus a word bank above them
 * holding the correct word for every blank in the set (shuffled). The
 * student picks a word from the bank, then picks a blank to drop it into.
 *
 * This is presented visually as "drag the word into place," but the actual
 * interaction is click/tap-to-select-then-place rather than native HTML5
 * drag-and-drop. Real drag-and-drop doesn't work reliably on touchscreens
 * without extra polyfill code, and click/tap works identically on desktop,
 * mobile, and keyboard (every chip and blank is a real <button>, so Tab +
 * Enter/Space already just works) — so this keeps the exercise accessible
 * everywhere without extra plumbing.
 *
 * One CSV per TOPIC (not per set of 10) — new sets are just more rows.
 * Expected CSV columns: set, id, before, after, word — plus optional
 * `hint` and `translation` columns:
 *   set            = which group of ~10 this row belongs to (1, 2, 3...)
 *   before / after = the sentence text split around the blank — can also
 *                    mark individual words with {word|translation} for a
 *                    hover/long-press hint, same as every other engine
 *                    (see renderTextWithHints() in exercise-common.js)
 *   word           = the correct word for this blank — also doubles as one
 *                    of the draggable words in that set's word bank
 *   hint           = optional; shown in brackets at the end of the
 *                    sentence (e.g. Números shows the digit form, "(20)",
 *                    next to a blank the student fills with "veinte")
 *   translation    = optional; a hover/long-press translation for the
 *                    `word` chip itself. A separate column rather than
 *                    {word|translation} braces, since the chip already IS
 *                    just one word on its own — there's no surrounding
 *                    sentence text to bracket it within.
 *
 * Host page needs, before this script:
 *   1. PapaParse (loaded via CDN)
 *   2. js/exercise-common.js
 *   3. A container: <div id="exercise-app" data-src="/content/exercises/ser-estar-arrastra.csv"></div>
 *
 * Registers itself as window.ExerciseEngines.arrastra.
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
    instructions.textContent = 'Selecciona primero una palabra del banco y después toca el espacio donde quieres colocarla. Vuelve a tocar un espacio ya relleno para quitar la palabra.';
    container.appendChild(instructions);

    let selectedChip = null;

    // Word bank comes first, above the sentences — the student picks the
    // word before deciding where it goes, so it reads top-to-bottom in the
    // order the interaction actually happens.
    const pool = document.createElement('div');
    pool.className = 'word-pool';
    pool.setAttribute('role', 'group');
    pool.setAttribute('aria-label', 'Banco de palabras');

    const words = shuffle(rows.map((row) => ({
      word: (row.word || '').trim(),
      translation: (row.translation || '').trim(),
    })));
    words.forEach((entry, chipIndex) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pool-chip';
      chip.dataset.chipId = String(chipIndex);
      chip.dataset.word = entry.word;
      chip.appendChild(document.createTextNode(entry.word));
      if (entry.translation) {
        const tooltip = document.createElement('span');
        tooltip.className = 'hint-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = entry.translation;
        chip.appendChild(tooltip);
      }
      pool.appendChild(chip);
    });

    container.appendChild(pool);

    const list = document.createElement('ol');
    list.className = 'exercise-list';

    rows.forEach((row, index) => {
      const item = document.createElement('li');
      item.className = 'exercise-item';
      item.dataset.correct = (row.word || '').trim();

      const sentence = document.createElement('p');
      sentence.className = 'exercise-sentence';
      sentence.appendChild(window.ExerciseCommon.renderTextWithHints(`${row.before} `));

      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'drop-slot';
      slot.textContent = '______';
      slot.dataset.filled = 'false';
      slot.dataset.slotIndex = String(index);
      slot.setAttribute('aria-label', 'Espacio para completar, pulsa para colocar o quitar la palabra elegida');
      sentence.appendChild(slot);

      sentence.appendChild(window.ExerciseCommon.renderTextWithHints(` ${row.after}`));

      // Optional trailing hint (e.g. Números shows the digit form so the
      // student can check which number-word they're placing) — omitted
      // entirely when the CSV has no `hint` column.
      const hintText = (row.hint || '').trim();
      if (hintText) {
        sentence.appendChild(document.createTextNode(` (${hintText})`));
      }

      item.appendChild(sentence);
      list.appendChild(item);
    });

    container.appendChild(list);
    window.ExerciseCommon.attachHintLongPress(container);

    function selectChip(chip) {
      if (chip.disabled) return;
      if (selectedChip === chip) {
        chip.classList.remove('pool-chip-selected');
        selectedChip = null;
        return;
      }
      if (selectedChip) selectedChip.classList.remove('pool-chip-selected');
      selectedChip = chip;
      chip.classList.add('pool-chip-selected');
    }

    function returnChipToPool(chipId) {
      const chip = pool.querySelector(`[data-chip-id="${chipId}"]`);
      if (chip) {
        chip.disabled = false;
        chip.hidden = false;
      }
    }

    function toggleSlot(slot) {
      if (slot.disabled) return;

      if (slot.dataset.filled === 'true') {
        returnChipToPool(slot.dataset.chipId);
        slot.textContent = '______';
        slot.dataset.filled = 'false';
        delete slot.dataset.chipId;
        delete slot.dataset.word;
        slot.classList.remove('drop-slot-filled');
        return;
      }

      if (!selectedChip) return;

      // dataset.word (not textContent) is the actual word — once a chip
      // carries a .hint-tooltip child, chip.textContent would pull in the
      // translation too, since textContent concatenates every descendant
      // text node.
      slot.textContent = '';
      slot.appendChild(document.createTextNode(selectedChip.dataset.word));
      const tooltip = selectedChip.querySelector('.hint-tooltip');
      if (tooltip) slot.appendChild(tooltip.cloneNode(true));
      slot.dataset.word = selectedChip.dataset.word;
      slot.dataset.filled = 'true';
      slot.dataset.chipId = selectedChip.dataset.chipId;
      slot.classList.add('drop-slot-filled');
      window.ExerciseCommon.attachHintLongPress(slot);

      selectedChip.classList.remove('pool-chip-selected');
      selectedChip.disabled = true;
      selectedChip.hidden = true;
      selectedChip = null;
    }

    pool.querySelectorAll('.pool-chip').forEach((chip) => {
      chip.addEventListener('click', () => selectChip(chip));
    });
    list.querySelectorAll('.drop-slot').forEach((slot) => {
      slot.addEventListener('click', () => toggleSlot(slot));
    });

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
      list.querySelectorAll('.drop-slot').forEach((s) => { s.disabled = true; });
      pool.querySelectorAll('.pool-chip').forEach((c) => { c.disabled = true; });
    });

    retryBtn.addEventListener('click', () => {
      resetExercise(list, pool);
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
    const items = list.querySelectorAll('.exercise-item');

    items.forEach((item) => {
      const correctAnswer = item.dataset.correct;
      const slot = item.querySelector('.drop-slot');
      const sentence = item.querySelector('.exercise-sentence');
      const filled = slot.dataset.filled === 'true';
      // dataset.word, not textContent — see the note above where it's set.
      const placedText = filled ? (slot.dataset.word || '').trim() : '';

      if (filled && placedText === correctAnswer) {
        slot.classList.add('drop-slot-correct');
        correctCount += 1;
      } else {
        slot.classList.add('drop-slot-incorrect');
        // Appended at the end of the sentence (to its right), not right
        // after the blank, so it doesn't interrupt the sentence mid-way.
        const reveal = document.createElement('span');
        reveal.className = 'drop-slot-reveal';
        reveal.textContent = `Respuesta correcta: ${correctAnswer}`;
        sentence.appendChild(reveal);
      }
    });

    return { correct: correctCount, total: items.length };
  }

  function resetExercise(list, pool) {
    list.querySelectorAll('.drop-slot').forEach((slot) => {
      slot.disabled = false;
      slot.textContent = '______';
      slot.dataset.filled = 'false';
      delete slot.dataset.chipId;
      delete slot.dataset.word;
      slot.classList.remove('drop-slot-filled', 'drop-slot-correct', 'drop-slot-incorrect');
    });
    list.querySelectorAll('.drop-slot-reveal').forEach((reveal) => reveal.remove());
    pool.querySelectorAll('.pool-chip').forEach((chip) => {
      chip.disabled = false;
      chip.hidden = false;
      chip.classList.remove('pool-chip-selected');
    });
  }

  window.ExerciseEngines = window.ExerciseEngines || {};
  window.ExerciseEngines.arrastra = { init: loadExercise };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    if (container && container.dataset.src && !container.dataset.types) loadExercise(container);
  });
})();

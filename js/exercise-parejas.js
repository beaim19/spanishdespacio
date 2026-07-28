/*
 * "Parejas" exercise engine: a left column of fixed subjects/pronouns and a
 * right-hand pool of conjugated verb forms (shuffled). The student picks a
 * verb form from the pool, then picks the subject it belongs with.
 *
 * Same click/tap-to-select-then-place interaction as exercise-arrastra.js,
 * for the same reason: it looks like matching two columns by dragging, but
 * works identically on desktop, mobile, and keyboard without needing native
 * HTML5 drag-and-drop (which touchscreens don't support well on their own).
 *
 * One CSV per TOPIC (not per set of 10) — new sets are just more rows.
 * Expected CSV columns: set, id, subject, verb
 *   set     = which group of ~10 this row belongs to (1, 2, 3...)
 *   subject = the fixed left-column label (Yo, Ellos, Los niños...)
 *   verb    = the conjugated form that belongs with that subject — also
 *             doubles as one of the draggable forms in that set's pool
 *
 * Host page needs, before this script:
 *   1. PapaParse (loaded via CDN)
 *   2. js/exercise-common.js
 *   3. A container: <div id="exercise-app" data-src="/content/exercises/ser-estar-parejas.csv"></div>
 *
 * Registers itself as window.ExerciseEngines.parejas.
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
    instructions.textContent = 'Selecciona primero una de las formas verbales y después toca el sujeto que le corresponde. Vuelve a tocar un espacio ya relleno para quitar la palabra.';
    container.appendChild(instructions);

    let selectedChip = null;

    const grid = document.createElement('div');
    grid.className = 'parejas-grid';

    const list = document.createElement('ul');
    list.className = 'parejas-column';

    rows.forEach((row, index) => {
      const li = document.createElement('li');
      li.className = 'parejas-row';
      li.dataset.correct = (row.verb || '').trim();

      const subject = document.createElement('span');
      subject.className = 'parejas-subject';
      subject.textContent = row.subject;

      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'drop-slot';
      slot.textContent = '______';
      slot.dataset.filled = 'false';
      slot.dataset.slotIndex = String(index);
      slot.setAttribute('aria-label', `Forma verbal para "${row.subject}", pulsa para colocar o quitar`);

      li.appendChild(subject);
      li.appendChild(slot);
      list.appendChild(li);
    });

    grid.appendChild(list);
    container.appendChild(grid);

    // Verb-form pool: one chip per row's verb, shuffled so the right column
    // isn't just a mirror of the left one.
    const pool = document.createElement('div');
    pool.className = 'word-pool';
    pool.setAttribute('role', 'group');
    pool.setAttribute('aria-label', 'Formas verbales');

    const verbs = shuffle(rows.map((row) => (row.verb || '').trim()));
    verbs.forEach((verb, chipIndex) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pool-chip';
      chip.textContent = verb;
      chip.dataset.chipId = String(chipIndex);
      pool.appendChild(chip);
    });

    container.appendChild(pool);

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
        slot.classList.remove('drop-slot-filled');
        return;
      }

      if (!selectedChip) return;

      slot.textContent = selectedChip.textContent;
      slot.dataset.filled = 'true';
      slot.dataset.chipId = selectedChip.dataset.chipId;
      slot.classList.add('drop-slot-filled');

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
    const items = list.querySelectorAll('.parejas-row');

    items.forEach((item) => {
      const correctAnswer = item.dataset.correct;
      const slot = item.querySelector('.drop-slot');
      const filled = slot.dataset.filled === 'true';
      const placedText = filled ? slot.textContent.trim() : '';

      if (filled && placedText === correctAnswer) {
        slot.classList.add('drop-slot-correct');
        correctCount += 1;
      } else {
        slot.classList.add('drop-slot-incorrect');
        const reveal = document.createElement('span');
        reveal.className = 'drop-slot-reveal';
        reveal.textContent = `Respuesta correcta: ${correctAnswer}`;
        slot.after(reveal);
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
  window.ExerciseEngines.parejas = { init: loadExercise };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    if (container && container.dataset.src && !container.dataset.types) loadExercise(container);
  });
})();

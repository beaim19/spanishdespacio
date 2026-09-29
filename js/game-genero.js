/*
 * "Masculino o femenino" game: one noun at a time, two fixed buttons
 * ("Masculino" / "Femenino"), immediate green/red feedback on click.
 *
 * CSV columns: set,id,word,translation,correct,level
 *   word        = the noun ON ITS OWN, with NO article — "problema", not
 *                 "el problema". Including "el"/"la" would hand the
 *                 answer to the student before they'd clicked anything.
 *   translation = optional English translation, shown as a hover/
 *                 long-press tooltip on the word (reuses the site's
 *                 {word|translation} hint syntax internally — see
 *                 renderTextWithHints() in exercise-common.js — so the
 *                 CSV itself just has a plain translation column, same
 *                 idea as Empareja's word-chip translation column).
 *   correct     = exactly "masculino" or "femenino" (lowercase).
 *
 * One CSV per "set" convention, same as every other topic. `level`
 * (A1/A2/B1/B2) works the same way too. Unlike every other engine on the
 * site, though, this ISN'T a fixed-length deck that ends and shows a
 * summary — each round picks a fresh random word from the WHOLE current
 * set/level (with replacement, so the same word can come up again soon
 * after, by design — see the CSV comment above about authoring one long
 * `set` per level rather than several small ones), and just keeps going.
 * A running "aciertos" score is shown the whole time, with its own
 * "Reiniciar puntuación" button, instead of a deck-end summary.
 *
 * Host page needs, before this script: PapaParse, js/exercise-common.js,
 * and a plain container (no type-router, this is a single-purpose page):
 *   <div id="exercise-app" data-src="/content/exercises/genero.csv"></div>
 *
 * Registers itself as window.ExerciseEngines.genero.
 */

(function () {
  async function loadExercise(container) {
    try {
      const {
        rows, requestedSet, allSets, availableLevels, requestedLevel,
      } = await window.ExerciseCommon.loadCsvSet(container.dataset.src);

      if (rows.length === 0) {
        container.innerHTML = `<p>No existe la serie ${requestedSet}.</p>`;
        return;
      }

      renderExercise(container, rows, requestedSet, allSets, availableLevels, requestedLevel);
    } catch (err) {
      console.error('No se pudo cargar el juego', err);
      container.innerHTML = '<p>No se pudo cargar el juego. Inténtalo de nuevo más tarde.</p>';
    }
  }

  function renderExercise(container, rows, setNumber, allSets, availableLevels, requestedLevel) {
    container.innerHTML = '';

    window.ExerciseCommon.renderLevelNav(availableLevels, requestedLevel);
    const label = window.ExerciseCommon.renderSeriesNav(setNumber, allSets);
    if (label) container.appendChild(label);

    const instructions = document.createElement('p');
    instructions.className = 'exercise-instructions';
    instructions.textContent = '¿Masculino o femenino? Elige un botón — se colorea al instante: verde si aciertas, rojo si fallas. Las palabras se repiten al azar mientras juegas.';
    container.appendChild(instructions);

    let totalAnswered = 0;
    let correctCount = 0;

    const card = document.createElement('div');
    card.className = 'flashcard';
    card.setAttribute('aria-live', 'polite');
    container.appendChild(card);

    // Picks fresh each round from the FULL set of rows (not a shrinking
    // deck) — repeats are expected and fine, see the file header.
    function pickRow() {
      return rows[Math.floor(Math.random() * rows.length)];
    }

    function renderCard() {
      card.innerHTML = '';

      const row = pickRow();
      const correct = (row.correct || '').trim().toLowerCase();
      const word = (row.word || '').trim();
      const translation = (row.translation || '').trim();

      const progressRow = document.createElement('div');
      progressRow.className = 'flashcard-progress-row';

      const progress = document.createElement('p');
      progress.className = 'flashcard-progress';
      progress.textContent = `Aciertos: ${correctCount} de ${totalAnswered}`;
      progressRow.appendChild(progress);

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'btn btn-secondary btn-small';
      resetBtn.textContent = 'Reiniciar puntuación';
      resetBtn.addEventListener('click', () => {
        totalAnswered = 0;
        correctCount = 0;
        renderCard();
      });
      progressRow.appendChild(resetBtn);

      card.appendChild(progressRow);

      const term = document.createElement('p');
      term.className = 'flashcard-sentence genero-word';
      // Reuses the site's {word|translation} hint syntax internally, built
      // here from the plain `word`/`translation` columns — same trick as
      // Empareja's word-chip translation column, just via the sentence
      // renderer since this is a single word, not a chip.
      term.appendChild(window.ExerciseCommon.renderTextWithHints(
        translation ? `{${word}|${translation}}` : word,
      ));
      card.appendChild(term);

      const group = document.createElement('div');
      group.className = 'option-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Elige masculino o femenino');

      const masculinoBtn = document.createElement('button');
      masculinoBtn.type = 'button';
      masculinoBtn.className = 'option-btn';
      masculinoBtn.textContent = 'Masculino';

      const femeninoBtn = document.createElement('button');
      femeninoBtn.type = 'button';
      femeninoBtn.className = 'option-btn';
      femeninoBtn.textContent = 'Femenino';

      group.appendChild(masculinoBtn);
      group.appendChild(femeninoBtn);

      const controls = document.createElement('div');
      controls.className = 'exercise-controls';

      [masculinoBtn, femeninoBtn].forEach((btn, btnIndex) => {
        const btnGender = btnIndex === 0 ? 'masculino' : 'femenino';
        btn.addEventListener('click', () => {
          masculinoBtn.disabled = true;
          femeninoBtn.disabled = true;

          totalAnswered += 1;
          if (btnGender === correct) {
            btn.classList.add('option-correct');
            correctCount += 1;
          } else {
            btn.classList.add('game-incorrect');
            const correctBtn = correct === 'masculino' ? masculinoBtn : femeninoBtn;
            correctBtn.classList.add('option-reveal-correct');
          }
          // Update the score shown on THIS card immediately, rather than
          // waiting for the next renderCard() call on "Siguiente" — the
          // click that just happened is what changed the score, so it
          // should read as changed right away.
          progress.textContent = `Aciertos: ${correctCount} de ${totalAnswered}`;

          const nextBtn = document.createElement('button');
          nextBtn.type = 'button';
          nextBtn.className = 'btn btn-primary';
          nextBtn.textContent = 'Siguiente';
          nextBtn.addEventListener('click', () => renderCard());
          controls.innerHTML = '';
          controls.appendChild(nextBtn);
        });
      });

      card.appendChild(group);
      card.appendChild(controls);
      window.ExerciseCommon.attachHintLongPress(card);
    }

    renderCard();
  }

  window.ExerciseEngines = window.ExerciseEngines || {};
  window.ExerciseEngines.genero = { init: loadExercise };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    if (container && container.dataset.src && !container.dataset.types) loadExercise(container);
  });
})();

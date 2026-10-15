/*
 * "Trivial" game (shown to the user as "Trivial" — the Spanish word for
 * this kind of game — but kept as "trivia" internally in file/engine/CSV
 * names, same convention as Empareja staying "arrastra" internally):
 * one multiple-choice question at a time, four buttons,
 * immediate feedback on click — no separate "Comprobar" step, since seeing
 * right away whether you got it is the whole point of a trivia game (as
 * opposed to the graded exercises elsewhere on the site, which defer the
 * solution behind "Mostrar solución" so a wrong answer can still be
 * retried blind — that doesn't apply here, there's no retry-this-question
 * concept, just move on to the next one).
 *
 * CSV columns: set,id,question,option_a,option_b,option_c,option_d,correct,level
 *   question  = the trivia question text. Can mark individual words for a
 *               hover/long-press translation using {word|translation} —
 *               see renderTextWithHints() in exercise-common.js.
 *   option_a..option_d = the four choices. A row can leave option_d (or
 *               even option_c) blank to ask a 3- or 2-option question
 *               instead of 4 — empty options are simply skipped when
 *               building the buttons.
 *   correct   = must exactly match the text of whichever option is right.
 *
 * One CSV per "set" convention, same as every other topic — see
 * js/exercise-common.js. `level` (A1/A2/B1/B2) works the same way too.
 *
 * Unlike the list-based exercises (Dos opciones, Completa, etc.), this
 * renders one question "card" at a time, like Flashcards' deck — a fresh
 * shuffle of the current set's rows, a progress line ("Pregunta X de Y"),
 * and a running score. Clicking an option immediately colors it green
 * (correct) or red (incorrect, plus highlighting whichever button WAS
 * correct) and disables the other three; a "Siguiente" button then
 * appears to advance. After the last question, a summary shows the final
 * score with a "Jugar de nuevo" button that reshuffles and restarts the
 * SAME series, plus a second "Siguiente" button (reusing that label for a
 * different action — advancing a *series*, not a question) that jumps to
 * the next series, if the current level has one — a plain link to
 * ?set=N+1, same navigation approach as the series pager, so it's just a
 * normal page load rather than new in-page logic.
 *
 * Host page needs, before this script: PapaParse, js/exercise-common.js,
 * and a plain container (no type-router, this is a single-purpose page):
 *   <div id="exercise-app" data-src="/content/exercises/trivia.csv"></div>
 *
 * Registers itself as window.ExerciseEngines.trivia.
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
    instructions.textContent = 'Elige la respuesta correcta. Se colorea al instante: verde si aciertas, rojo si fallas.';
    container.appendChild(instructions);

    let deck = shuffle(rows);
    let index = 0;
    let correctCount = 0;

    const card = document.createElement('div');
    card.className = 'flashcard';
    card.setAttribute('aria-live', 'polite');
    container.appendChild(card);

    function optionsOf(row) {
      return ['option_a', 'option_b', 'option_c', 'option_d']
        .map((key) => (row[key] || '').trim())
        .filter(Boolean);
    }

    function renderCard() {
      card.innerHTML = '';

      if (index >= deck.length) {
        renderSummary();
        return;
      }

      const row = deck[index];
      const correct = (row.correct || '').trim();

      const progress = document.createElement('p');
      progress.className = 'flashcard-progress';
      progress.textContent = `Pregunta ${index + 1} de ${deck.length}`;
      card.appendChild(progress);

      const question = document.createElement('p');
      question.className = 'exercise-sentence';
      question.appendChild(window.ExerciseCommon.renderTextWithHints(row.question || ''));
      card.appendChild(question);

      const group = document.createElement('div');
      group.className = 'option-group option-group-grid';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Elige la respuesta correcta');

      const buttons = optionsOf(row).map((optionText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn';
        btn.textContent = optionText;
        group.appendChild(btn);
        return btn;
      });

      const controls = document.createElement('div');
      controls.className = 'exercise-controls';

      buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
          buttons.forEach((b) => { b.disabled = true; });

          if (btn.textContent.trim() === correct) {
            btn.classList.add('option-correct');
            correctCount += 1;
          } else {
            btn.classList.add('game-incorrect');
            buttons.forEach((b) => {
              if (b.textContent.trim() === correct) b.classList.add('game-reveal-correct');
            });
          }

          const nextBtn = document.createElement('button');
          nextBtn.type = 'button';
          nextBtn.className = 'btn btn-primary';
          nextBtn.textContent = index + 1 >= deck.length ? 'Ver resultado' : 'Siguiente';
          nextBtn.addEventListener('click', () => {
            index += 1;
            renderCard();
          });
          controls.innerHTML = '';
          controls.appendChild(nextBtn);
        });
      });

      card.appendChild(group);
      card.appendChild(controls);
      window.ExerciseCommon.attachHintLongPress(card);
    }

    // Next-set link for the summary screen, if there IS a next set — reuses
    // the same "clone the URL's params, only change `set`" approach as
    // buildSeriesPager()'s hrefForSet in exercise-common.js, so ?level= (or
    // any future param) survives the jump too.
    function nextSetHref() {
      if (!allSets || allSets.length <= 1) return null;
      const sorted = [...allSets].sort((a, b) => Number(a) - Number(b));
      const currentIndex = sorted.indexOf(setNumber);
      if (currentIndex === -1 || currentIndex >= sorted.length - 1) return null;
      const params = new URLSearchParams(window.location.search);
      params.set('set', sorted[currentIndex + 1]);
      return `?${params.toString()}`;
    }

    function renderSummary() {
      const summary = document.createElement('div');
      summary.className = 'flashcard-summary';

      const result = document.createElement('p');
      result.className = 'exercise-result';
      result.textContent = `Acertaste ${correctCount} de ${deck.length} preguntas.`;
      summary.appendChild(result);

      const controls = document.createElement('div');
      controls.className = 'exercise-controls';

      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn btn-secondary';
      retryBtn.textContent = 'Jugar de nuevo';
      retryBtn.addEventListener('click', () => {
        deck = shuffle(rows);
        index = 0;
        correctCount = 0;
        renderCard();
      });
      controls.appendChild(retryBtn);

      // Only shown when the current level actually has another series —
      // on the last (or only) one, there's nothing to advance to.
      const nextHref = nextSetHref();
      if (nextHref) {
        const nextSetBtn = document.createElement('a');
        nextSetBtn.className = 'btn btn-primary';
        nextSetBtn.href = nextHref;
        nextSetBtn.textContent = 'Siguiente';
        controls.appendChild(nextSetBtn);
      }

      summary.appendChild(controls);
      card.appendChild(summary);
    }

    renderCard();
  }

  window.ExerciseEngines = window.ExerciseEngines || {};
  window.ExerciseEngines.trivia = { init: loadExercise };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    if (container && container.dataset.src && !container.dataset.types) loadExercise(container);
  });
})();

/*
 * "Flashcards" exercise engine: one sentence at a time, self-paced review
 * instead of a graded quiz. The student thinks of the answer, reveals it,
 * then self-reports whether they knew it or not — same idea as a physical
 * flashcard deck, not multiple choice or typing.
 *
 * Deliberately reuses whatever CSV the topic's "Dos opciones" exercise
 * already uses (only reading the before/after/correct columns and
 * ignoring option_a/option_b) — no new content file needed to add
 * flashcards to a topic that already has a two-option exercise. A topic
 * without one can still use a plain set,id,before,after,correct CSV.
 *
 * Host page needs, before this script:
 *   1. PapaParse (loaded via CDN)
 *   2. js/exercise-common.js
 *   3. A container: <div id="exercise-app" data-src="/content/exercises/ser-estar.csv"></div>
 *
 * Registers itself as window.ExerciseEngines.flashcards.
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
    instructions.textContent = 'Piensa la respuesta y pulsa "Mostrar respuesta" para comprobarla. Después indica si la sabías o no.';
    container.appendChild(instructions);

    const deck = shuffle(rows);
    let index = 0;
    let revealed = false;
    const tally = { know: 0, dontKnow: 0 };

    const card = document.createElement('div');
    card.className = 'flashcard';
    card.setAttribute('aria-live', 'polite');
    container.appendChild(card);

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
      progress.textContent = `Tarjeta ${index + 1} de ${deck.length}`;
      card.appendChild(progress);

      const sentence = document.createElement('p');
      sentence.className = 'flashcard-sentence';
      if (!revealed) {
        sentence.textContent = `${row.before} ______ ${row.after}`;
      } else {
        sentence.appendChild(document.createTextNode(`${row.before} `));
        const answer = document.createElement('strong');
        answer.className = 'flashcard-answer';
        answer.textContent = correct;
        sentence.appendChild(answer);
        sentence.appendChild(document.createTextNode(` ${row.after}`));
      }
      card.appendChild(sentence);

      const controls = document.createElement('div');
      controls.className = 'exercise-controls';

      if (!revealed) {
        const showBtn = document.createElement('button');
        showBtn.type = 'button';
        showBtn.className = 'btn btn-primary';
        showBtn.textContent = 'Mostrar respuesta';
        showBtn.addEventListener('click', () => {
          revealed = true;
          renderCard();
        });
        controls.appendChild(showBtn);
      } else {
        const knowBtn = document.createElement('button');
        knowBtn.type = 'button';
        knowBtn.className = 'btn btn-primary';
        knowBtn.textContent = 'La sabía';
        knowBtn.addEventListener('click', () => {
          tally.know += 1;
          advance();
        });

        const dontKnowBtn = document.createElement('button');
        dontKnowBtn.type = 'button';
        dontKnowBtn.className = 'btn btn-secondary';
        dontKnowBtn.textContent = 'No la sabía';
        dontKnowBtn.addEventListener('click', () => {
          tally.dontKnow += 1;
          advance();
        });

        controls.appendChild(knowBtn);
        controls.appendChild(dontKnowBtn);
      }

      card.appendChild(controls);
    }

    function advance() {
      index += 1;
      revealed = false;
      renderCard();
    }

    function renderSummary() {
      const summary = document.createElement('div');
      summary.className = 'flashcard-summary';

      const result = document.createElement('p');
      result.className = 'exercise-result';
      result.textContent = `Sabías ${tally.know} de ${deck.length}.`;
      summary.appendChild(result);

      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn btn-secondary';
      retryBtn.textContent = 'Repetir esta serie';
      retryBtn.addEventListener('click', () => {
        deck.splice(0, deck.length, ...shuffle(rows));
        index = 0;
        revealed = false;
        tally.know = 0;
        tally.dontKnow = 0;
        renderCard();
      });
      summary.appendChild(retryBtn);

      card.appendChild(summary);
    }

    renderCard();
  }

  window.ExerciseEngines = window.ExerciseEngines || {};
  window.ExerciseEngines.flashcards = { init: loadExercise };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    if (container && container.dataset.src && !container.dataset.types) loadExercise(container);
  });
})();

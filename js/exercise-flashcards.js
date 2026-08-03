/*
 * "Flashcards" exercise engine: one card at a time, self-paced review
 * instead of a graded quiz. The student thinks of the answer, reveals it,
 * then self-reports whether they knew it or not — same idea as a physical
 * flashcard deck, not multiple choice or typing.
 *
 * Two content shapes, auto-detected from the CSV's columns:
 *
 *   1. Sentence mode (default) — set,id,before,after,correct, same shape
 *      as a Dos opciones/Completa CSV (a topic without its own dedicated
 *      Flashcards file can just point at one of those, ignoring whichever
 *      extra columns it doesn't need). Optional extra columns build a
 *      "(...)" hint shown above the blank, in this order when present:
 *        infinitive or hint  → base form, e.g. "hablar"
 *        tense                → e.g. "pretérito imperfecto"
 *        subject               → grammatical person, e.g. "ella"
 *      and, once revealed, an optional "(...)" label after the answer
 *      built from `gender`/`number` (e.g. "(femenino, singular)") — used
 *      by exercises where the point is recognizing gender/number
 *      agreement rather than recalling the exact word.
 *
 *   2. Pair mode — set,id,term_a,term_b, for plain vocabulary recall with
 *      no sentence at all (e.g. Números: a digit and its word form). Each
 *      card randomly shows term_a or term_b as the front and reveals the
 *      other, so the student practices converting in both directions
 *      instead of always reading the same one.
 *
 * Host page needs, before this script:
 *   1. PapaParse (loaded via CDN)
 *   2. js/exercise-common.js
 *   3. A container: <div id="exercise-app" data-src="/content/exercises/ser-estar-flashcards.csv"></div>
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

  function isPairMode(rows) {
    return rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], 'term_a');
  }

  function buildFrontHint(row) {
    const parts = [];
    const baseForm = (row.hint || row.infinitive || '').trim();
    if (baseForm) parts.push(baseForm);
    const tense = (row.tense || '').trim();
    if (tense) parts.push(tense);
    const subject = (row.subject || '').trim();
    if (subject) parts.push(subject);
    return parts.length ? `(${parts.join(', ')})` : '';
  }

  function buildBackLabel(row) {
    const parts = [];
    const gender = (row.gender || '').trim();
    if (gender) parts.push(gender);
    const number = (row.number || '').trim();
    if (number) parts.push(number);
    return parts.length ? `(${parts.join(', ')})` : '';
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

    const pairMode = isPairMode(rows);

    const instructions = document.createElement('p');
    instructions.className = 'exercise-instructions';
    instructions.textContent = pairMode
      ? 'Piensa la respuesta y pulsa "Mostrar respuesta" para comprobarla. A veces se muestra en cifras, a veces en palabras.'
      : 'Piensa la respuesta y pulsa "Mostrar respuesta" para comprobarla. Después indica si la sabías o no.';
    container.appendChild(instructions);

    const deck = shuffle(rows);
    let index = 0;
    let revealed = false;
    let flipped = Math.random() < 0.5; // pair mode only: which term is the front
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

      const progress = document.createElement('p');
      progress.className = 'flashcard-progress';
      progress.textContent = `Tarjeta ${index + 1} de ${deck.length}`;
      card.appendChild(progress);

      const sentence = document.createElement('p');
      sentence.className = 'flashcard-sentence';

      if (pairMode) {
        const front = ((flipped ? row.term_b : row.term_a) || '').trim();
        const back = ((flipped ? row.term_a : row.term_b) || '').trim();
        if (!revealed) {
          sentence.textContent = front;
        } else {
          sentence.appendChild(document.createTextNode(`${front} = `));
          const answer = document.createElement('strong');
          answer.className = 'flashcard-answer';
          answer.textContent = back;
          sentence.appendChild(answer);
        }
      } else {
        const correct = (row.correct || '').trim();
        const frontHint = buildFrontHint(row);
        if (!revealed) {
          let text = `${row.before} ______ ${row.after}`;
          if (frontHint) text += ` ${frontHint}`;
          sentence.textContent = text.trim();
        } else {
          sentence.appendChild(document.createTextNode(`${row.before} `));
          const answer = document.createElement('strong');
          answer.className = 'flashcard-answer';
          answer.textContent = correct;
          sentence.appendChild(answer);
          sentence.appendChild(document.createTextNode(` ${row.after}`));
          if (frontHint) sentence.appendChild(document.createTextNode(` ${frontHint}`));
          const backLabel = buildBackLabel(row);
          if (backLabel) {
            const labelSpan = document.createElement('span');
            labelSpan.className = 'flashcard-label';
            labelSpan.textContent = ` ${backLabel}`;
            sentence.appendChild(labelSpan);
          }
        }
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
      flipped = Math.random() < 0.5;
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
        flipped = Math.random() < 0.5;
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

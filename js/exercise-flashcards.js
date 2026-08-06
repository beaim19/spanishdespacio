/*
 * "Flashcards" exercise engine: one card at a time, self-paced review
 * instead of a graded quiz. The student thinks of the answer, reveals it
 * (or lets the countdown reveal it for them), then moves on — same idea as
 * a physical flashcard deck, not multiple choice or typing.
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
 * Each card also runs a 10-second auto-reveal countdown (text + a
 * shrinking bar) so the student has a beat of real time pressure to
 * recall the answer in their head — clicking "Mostrar respuesta" early
 * still works and just cancels the countdown. After reveal, a single
 * "Siguiente" button moves to the next card — there's no self-assessment
 * step (no "La sabía"/"No la sabía") and no running score, on purpose:
 * this is meant as fast-paced repetition, not a graded quiz.
 *
 * In sentence mode, `before`/`after` can also mark individual words for a
 * hover/long-press translation using {word|translation} — see
 * renderTextWithHints() in exercise-common.js. Optional; plain text with
 * no braces is unaffected.
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
      : 'Piensa la respuesta y pulsa "Mostrar respuesta" para comprobarla.';
    container.appendChild(instructions);

    const COUNTDOWN_SECONDS = 10;
    const deck = shuffle(rows);
    let index = 0;
    let revealed = false;
    let flipped = Math.random() < 0.5; // pair mode only: which term is the front

    const card = document.createElement('div');
    card.className = 'flashcard';
    card.setAttribute('aria-live', 'polite');
    container.appendChild(card);

    // Auto-reveal countdown timers — tracked here so every path that
    // rebuilds the card (advancing, retrying, or a manual "Mostrar
    // respuesta" click) can cancel whatever's still pending before it
    // fires against a card that's no longer on screen.
    let countdownInterval = null;
    let revealTimeout = null;
    function clearCountdown() {
      if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
      if (revealTimeout) { clearTimeout(revealTimeout); revealTimeout = null; }
    }

    function renderCard() {
      clearCountdown();
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
          // Built from appended nodes (not a single textContent assignment)
          // specifically so renderTextWithHints() can turn any {word|
          // translation} in before/after into real hoverable spans instead
          // of showing the raw braces as literal text.
          sentence.appendChild(window.ExerciseCommon.renderTextWithHints(`${row.before} `));
          sentence.appendChild(document.createTextNode('______'));
          sentence.appendChild(window.ExerciseCommon.renderTextWithHints(` ${row.after}`));
          if (frontHint) sentence.appendChild(document.createTextNode(` ${frontHint}`));
        } else {
          sentence.appendChild(window.ExerciseCommon.renderTextWithHints(`${row.before} `));
          const answer = document.createElement('strong');
          answer.className = 'flashcard-answer';
          answer.textContent = correct;
          sentence.appendChild(answer);
          sentence.appendChild(window.ExerciseCommon.renderTextWithHints(` ${row.after}`));
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

      if (!revealed) {
        let secondsLeft = COUNTDOWN_SECONDS;

        const countdown = document.createElement('p');
        countdown.className = 'flashcard-countdown';
        countdown.textContent = `Se revela en ${secondsLeft}…`;
        card.appendChild(countdown);

        const track = document.createElement('div');
        track.className = 'flashcard-timer-track';
        const bar = document.createElement('div');
        bar.className = 'flashcard-timer-bar';
        track.appendChild(bar);
        card.appendChild(track);

        // The bar starts at its CSS default (100% width); nudging the
        // width change into the next couple of frames (rather than setting
        // it immediately) is what lets the CSS transition actually animate
        // the shrink instead of jumping straight to empty.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bar.style.width = '0%';
          });
        });

        countdownInterval = setInterval(() => {
          secondsLeft -= 1;
          if (secondsLeft > 0) countdown.textContent = `Se revela en ${secondsLeft}…`;
        }, 1000);

        revealTimeout = setTimeout(() => {
          revealed = true;
          renderCard();
        }, COUNTDOWN_SECONDS * 1000);
      }

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
        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'btn btn-primary';
        nextBtn.textContent = 'Siguiente';
        nextBtn.addEventListener('click', () => advance());
        controls.appendChild(nextBtn);
      }

      card.appendChild(controls);
      window.ExerciseCommon.attachHintLongPress(card);
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
      result.textContent = `Has terminado esta serie de ${deck.length} tarjetas.`;
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

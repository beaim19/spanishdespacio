/*
 * Fill-in-the-blank conjugation exercise engine: shows a sentence with a
 * blank input and the infinitive as a hint in parentheses at the end,
 * e.g. "Yo ___ español todos los días. (hablar)".
 *
 * Includes a shared accent toolbar (á é í ó ú ñ ¿ ¡) that inserts into
 * whichever input was last focused — same idea as the accent buttons in
 * the DELE app, since typing Spanish special characters isn't always easy
 * depending on keyboard layout.
 *
 * One CSV per topic, same "set" convention as exercise-choice2.js — see
 * js/exercise-common.js. Expected columns: set, id, before, after,
 * infinitive, correct
 *   before/after = sentence text around the blank
 *   infinitive   = shown as "(infinitivo)" after the sentence
 *   correct      = the correctly conjugated form. Matching is
 *                  case-insensitive but accent-sensitive (á/a/etc. still
 *                  have to be right — that's what the accent toolbar is for).
 *
 * Host page needs, before this script: PapaParse, js/exercise-common.js,
 * and <div id="exercise-app" data-src="/content/exercises/presente.csv"></div>
 */

(function () {
  let lastFocusedInput = null;
  const ACCENT_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'];

  async function init() {
    const container = document.getElementById('exercise-app');
    if (!container) return;

    try {
      const { rows, requestedSet, allSets } = await window.ExerciseCommon.loadCsvSet(container.dataset.src);

      if (rows.length === 0) {
        container.innerHTML = `<p>No existe la serie ${requestedSet}.</p>`;
        return;
      }

      render(container, rows, requestedSet, allSets);
    } catch (err) {
      console.error('No se pudo cargar el ejercicio', err);
      container.innerHTML = '<p>No se pudo cargar el ejercicio. Inténtalo de nuevo más tarde.</p>';
    }
  }

  function render(container, rows, setNumber, allSets) {
    container.innerHTML = '';

    const label = window.ExerciseCommon.renderSeriesNav(setNumber, allSets);
    if (label) container.appendChild(label);

    container.appendChild(buildAccentToolbar());

    const list = document.createElement('ol');
    list.className = 'exercise-list';

    rows.forEach((row, index) => {
      const item = document.createElement('li');
      item.className = 'exercise-item';
      item.dataset.correct = (row.correct || '').trim();

      const sentence = document.createElement('p');
      sentence.className = 'exercise-sentence';
      sentence.appendChild(document.createTextNode(`${row.before} `));

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'exercise-input';
      input.autocomplete = 'off';
      input.autocapitalize = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', `Respuesta a la frase ${index + 1}`);
      input.addEventListener('focus', () => { lastFocusedInput = input; });
      if (!lastFocusedInput) lastFocusedInput = input;
      sentence.appendChild(input);

      sentence.appendChild(document.createTextNode(` ${row.after} `));

      const hint = document.createElement('span');
      hint.className = 'exercise-hint';
      hint.textContent = `(${row.infinitive})`;
      sentence.appendChild(hint);

      const feedback = document.createElement('span');
      feedback.className = 'exercise-feedback';
      sentence.appendChild(feedback);

      item.appendChild(sentence);
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
    const items = list.querySelectorAll('.exercise-item');

    items.forEach((item) => {
      const correctAnswer = (item.dataset.correct || '').trim();
      const input = item.querySelector('.exercise-input');
      const feedback = item.querySelector('.exercise-feedback');
      const userAnswer = input.value.trim();
      const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();

      input.disabled = true;
      input.classList.remove('input-correct', 'input-incorrect');

      if (isCorrect) {
        input.classList.add('input-correct');
        correctCount += 1;
      } else {
        input.classList.add('input-incorrect');
        feedback.textContent = ` (correcto: ${correctAnswer})`;
      }
    });

    return { correct: correctCount, total: items.length };
  }

  function resetExercise(list) {
    list.querySelectorAll('.exercise-item').forEach((item) => {
      const input = item.querySelector('.exercise-input');
      const feedback = item.querySelector('.exercise-feedback');
      input.value = '';
      input.disabled = false;
      input.classList.remove('input-correct', 'input-incorrect');
      feedback.textContent = '';
    });
  }

  function buildAccentToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'accent-toolbar';
    toolbar.setAttribute('role', 'group');
    toolbar.setAttribute('aria-label', 'Insertar caracteres especiales en la respuesta');

    ACCENT_CHARS.forEach((ch) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'accent-btn';
      btn.textContent = ch;
      btn.setAttribute('aria-label', `Insertar ${ch}`);
      btn.addEventListener('click', () => insertChar(ch));
      toolbar.appendChild(btn);
    });

    return toolbar;
  }

  function insertChar(ch) {
    const input = lastFocusedInput;
    if (!input || input.disabled) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.setRangeText(ch, start, end, 'end');
    input.focus();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

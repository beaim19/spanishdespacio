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
 * infinitive, correct — plus an optional tense column (used by the
 * "Completa" exercise type, where one set can mix several indicative
 * tenses, so the hint needs to say which one is expected):
 *   before/after = sentence text around the blank
 *   infinitive   = shown in the hint after the sentence
 *   tense        = optional; if present, shown alongside the infinitive,
 *                  e.g. "(estar, pretérito imperfecto)"
 *   correct      = the correctly conjugated form. Matching is
 *                  case-insensitive but accent-sensitive (á/a/etc. still
 *                  have to be right — that's what the accent toolbar is for).
 *
 * Host page needs, before this script: PapaParse, js/exercise-common.js,
 * and either:
 *   <div id="exercise-app" data-src="/content/exercises/presente.csv"></div>
 * or, for a topic split into verb-type variants (regular/irregular/...):
 *   <div id="exercise-app"
 *        data-variants="regular,irregular,reflexivos"
 *        data-src-template="/content/exercises/presente-{type}.csv"></div>
 * plus a <div id="variant-switcher-slot"></div> somewhere in the intro
 * band for the Regular/Irregular/Reflexivos tabs to render into.
 */

(function () {
  let lastFocusedInput = null;
  const ACCENT_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'];
  const MIN_INPUT_CH = 9;

  // Grows the input as the student types so the whole word stays visible
  // instead of scrolling inside a fixed-width box — never shrinks below
  // the starting width, so short answers still line up.
  function growInput(input) {
    const width = Math.max(MIN_INPUT_CH, input.value.length + 2);
    input.style.width = `${width}ch`;
  }

  async function init() {
    const container = document.getElementById('exercise-app');
    if (!container) return;

    const variants = (container.dataset.variants || '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    let src = container.dataset.src;
    if (variants.length > 0) {
      const currentType = window.ExerciseCommon.getRequestedType(variants);
      src = container.dataset.srcTemplate.replace('{type}', currentType);
      window.ExerciseCommon.renderVariantNav(variants, currentType);
    }

    try {
      const { rows, requestedSet, allSets } = await window.ExerciseCommon.loadCsvSet(src);

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
      input.style.width = `${MIN_INPUT_CH}ch`;
      input.addEventListener('focus', () => { lastFocusedInput = input; });
      input.addEventListener('input', () => growInput(input));
      if (!lastFocusedInput) lastFocusedInput = input;
      sentence.appendChild(input);

      sentence.appendChild(document.createTextNode(` ${row.after} `));

      const hint = document.createElement('span');
      hint.className = 'exercise-hint';
      // "Completa"-style CSVs add a tense column (presente, futuro...) since
      // one set can mix several indicative tenses; plain conjugation CSVs
      // like Presente's don't have that column, so the hint falls back to
      // just showing the base form. That base form itself comes from
      // "infinitive" for verb topics, but "Completa" isn't only used for
      // verbs (Adjetivos types the correct agreement given the base
      // adjective, Números types the word form given the digit) — those
      // CSVs use a more accurately-named "hint" column instead; either one
      // works here.
      const tense = (row.tense || '').trim();
      const baseForm = (row.hint || row.infinitive || '').trim();
      hint.textContent = tense ? `(${baseForm}, ${tense})` : `(${baseForm})`;
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
      input.style.width = `${MIN_INPUT_CH}ch`;
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

  window.ExerciseEngines = window.ExerciseEngines || {};
  window.ExerciseEngines.typed = { init };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    // Only self-initialize on pages that already set data-src or
    // data-variants directly in the HTML (Presente, the plain case). A
    // page with several exercise types leaves both off and is started
    // explicitly by ExerciseCommon.initExerciseTypePage instead.
    if (container && (container.dataset.src || container.dataset.variants)) init();
  });
})();

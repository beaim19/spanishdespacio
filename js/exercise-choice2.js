/*
 * Reusable "choose between two options" exercise engine.
 * Built for ser/estar first, but works for por/para or any other
 * two-option grammar choice — point it at a different CSV and it works
 * without touching this file.
 *
 * One CSV per TOPIC (not per set of 10) — new sets are just more rows.
 * Expected CSV columns: set, id, before, after, option_a, option_b, correct
 *   set               = which group of ~10 this row belongs to (1, 2, 3...)
 *   before / after    = the sentence text split around the blank
 *   option_a/option_b = the two clickable choices (already correctly
 *                       conjugated — this engine only tests the choice,
 *                       not the conjugation)
 *   correct           = must exactly match option_a or option_b's text
 *
 * Host page needs, before this script:
 *   1. PapaParse (loaded via CDN)
 *   2. js/exercise-common.js
 *   3. A container: <div id="exercise-app" data-src="/content/exercises/ser-estar.csv"></div>
 *
 * Which set to show comes from the URL query string, e.g.
 * ser-estar.html?set=2 — defaults to set 1 if not given.
 */

(function () {
  const CORRECT_CLASS = 'option-correct';
  const INCORRECT_CLASS = 'option-incorrect';
  const REVEAL_CLASS = 'option-reveal-correct';

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

    const switcher = window.ExerciseCommon.buildSetSwitcher(allSets, setNumber);
    if (switcher) container.appendChild(switcher);

    const list = document.createElement('ol');
    list.className = 'exercise-list';

    rows.forEach((row) => {
      const item = document.createElement('li');
      item.className = 'exercise-item';
      item.dataset.correct = (row.correct || '').trim();

      const sentence = document.createElement('p');
      sentence.className = 'exercise-sentence';
      sentence.appendChild(document.createTextNode(`${row.before} `));

      const group = document.createElement('span');
      group.className = 'option-group';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Elige la opción correcta');

      [row.option_a, row.option_b].forEach((optionText) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'option-btn';
        btn.textContent = optionText;
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => selectOption(group, btn));
        group.appendChild(btn);
      });

      sentence.appendChild(group);
      sentence.appendChild(document.createTextNode(` ${row.after}`));
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
      list.querySelectorAll('.option-btn').forEach((b) => { b.disabled = true; });
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

  function selectOption(group, chosenBtn) {
    group.querySelectorAll('.option-btn').forEach((b) => {
      b.classList.remove('option-selected');
      b.setAttribute('aria-pressed', 'false');
    });
    chosenBtn.classList.add('option-selected');
    chosenBtn.setAttribute('aria-pressed', 'true');
  }

  function checkAnswers(list) {
    let correctCount = 0;
    const items = list.querySelectorAll('.exercise-item');

    items.forEach((item) => {
      const correctAnswer = item.dataset.correct;
      const selected = item.querySelector('.option-selected');
      const buttons = item.querySelectorAll('.option-btn');

      buttons.forEach((btn) => {
        if (btn.textContent.trim() === correctAnswer) {
          btn.classList.add(REVEAL_CLASS);
        }
      });

      if (selected && selected.textContent.trim() === correctAnswer) {
        selected.classList.add(CORRECT_CLASS);
        selected.classList.remove(REVEAL_CLASS);
        correctCount += 1;
      } else if (selected) {
        selected.classList.add(INCORRECT_CLASS);
      }
    });

    return { correct: correctCount, total: items.length };
  }

  function resetExercise(list) {
    list.querySelectorAll('.option-btn').forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('option-selected', CORRECT_CLASS, INCORRECT_CLASS, REVEAL_CLASS);
      btn.setAttribute('aria-pressed', 'false');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    if (container) loadExercise(container);
  });
})();

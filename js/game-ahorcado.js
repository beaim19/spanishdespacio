/*
 * "Ahorcado" (hangman) game, with a flower instead of a gallows: one word
 * at a time, shown as a short description (the hint) plus a row of blank
 * letter spaces. The player taps letters from an A-Z (+Ñ) keyboard, or —
 * if they think they know it — types the whole word and presses "Probar".
 * Every wrong letter AND every wrong whole-word attempt adds one petal to
 * the flower; at 8 petals the flower is full, the round is lost, and the
 * whole word is revealed. Guess every letter (or the whole word) first and
 * the round is won.
 *
 * CSV columns: set,id,hint,word,level
 *   hint  = a short description of the word, in Spanish. Can mark words
 *           for a hover/long-press translation with {word|translation}
 *           (see renderTextWithHints() in exercise-common.js).
 *   word  = the answer, WITHOUT accents (canción -> cancion). Ñ is fine and
 *           is a letter of its own. Spaces and hyphens are allowed (they
 *           show as gaps / fixed marks and don't need to be guessed). As a
 *           safety net, accents that DO slip into the CSV are stripped
 *           before playing, and accents typed in the whole-word box are
 *           ignored, so neither can make a correct answer count as wrong.
 *
 * Series (`set`) and levels work like every other topic: ?set=N / ?level=.
 * Each series is a shuffled deck of its words, played one after another,
 * ending in a score with "Jugar de nuevo" (same series again) and, when
 * the level has another series, "Siguiente" (a plain link to ?set=N+1,
 * like Trivial's).
 *
 * Host page needs, before this script: PapaParse, js/exercise-common.js,
 * and a plain container:
 *   <div id="exercise-app" data-src="/content/exercises/ahorcado.csv"></div>
 *
 * Registers itself as window.ExerciseEngines.ahorcado.
 */

(function () {
  const MAX_WRONG = 8; // petals on the flower
  const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Lowercase and strip accents, but keep ñ as its own letter (a plain NFD
  // pass would split it into n + a combining tilde and lose it).
  function normalize(str) {
    return (str || '')
      .trim()
      .toLowerCase()
      .replace(/ñ/g, '\u0001')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\u0001/g, 'ñ');
  }

  function svgEl(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach((key) => el.setAttribute(key, attrs[key]));
    return el;
  }

  // Stem, two leaves and a centre are always drawn; the 8 petals start as
  // faint dashed outlines (so the player can see how many are left) and
  // fill in, one per mistake, when `setPetals(n)` is called.
  function buildFlower() {
    const svg = svgEl('svg', { viewBox: '0 0 200 240', class: 'ahorcado-flower', role: 'img' });

    svg.appendChild(svgEl('path', { d: 'M100 112 C 100 160, 96 200, 100 236', class: 'ahorcado-stem' }));
    svg.appendChild(svgEl('ellipse', {
      cx: 76, cy: 190, rx: 22, ry: 9, transform: 'rotate(-28 76 190)', class: 'ahorcado-leaf',
    }));
    svg.appendChild(svgEl('ellipse', {
      cx: 124, cy: 168, rx: 22, ry: 9, transform: 'rotate(28 124 168)', class: 'ahorcado-leaf',
    }));

    const petals = [];
    for (let i = 0; i < MAX_WRONG; i += 1) {
      const petal = svgEl('ellipse', {
        cx: 100, cy: 48, rx: 14, ry: 27, transform: `rotate(${i * (360 / MAX_WRONG)} 100 80)`, class: 'ahorcado-petal',
      });
      svg.appendChild(petal);
      petals.push(petal);
    }
    svg.appendChild(svgEl('circle', { cx: 100, cy: 80, r: 18, class: 'ahorcado-center' }));

    function setPetals(n) {
      petals.forEach((petal, i) => petal.classList.toggle('is-on', i < n));
      svg.setAttribute('aria-label', `Flor con ${n} de ${MAX_WRONG} pétalos`);
    }
    setPetals(0);
    return { svg, setPetals };
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
    instructions.textContent = `Adivina la palabra a partir de la descripción. Elige letras: cada error añade un pétalo a la flor, y con ${MAX_WRONG} pétalos pierdes la palabra. Si crees saberla, escríbela abajo.`;
    container.appendChild(instructions);

    let deck = shuffle(rows).filter((row) => normalize(row.word));
    let index = 0;
    let wonCount = 0;

    const card = document.createElement('div');
    card.className = 'flashcard';
    container.appendChild(card);

    // Same idea as Trivial's: a plain link to ?set=N+1, only when the
    // current level has another series.
    function nextSetHref() {
      if (!allSets || allSets.length <= 1) return null;
      const sorted = [...allSets].sort((a, b) => Number(a) - Number(b));
      const currentIndex = sorted.indexOf(setNumber);
      if (currentIndex === -1 || currentIndex >= sorted.length - 1) return null;
      const params = new URLSearchParams(window.location.search);
      params.set('set', sorted[currentIndex + 1]);
      return `?${params.toString()}`;
    }

    function renderCard() {
      card.innerHTML = '';

      if (index >= deck.length) {
        renderSummary();
        return;
      }

      const row = deck[index];
      const target = normalize(row.word);
      const chars = [...target];
      const isLetter = (ch) => /\p{L}/u.test(ch);
      const guessed = new Set();
      let wrong = 0;
      let finished = false;

      const progress = document.createElement('p');
      progress.className = 'flashcard-progress';
      progress.textContent = `Palabra ${index + 1} de ${deck.length}`;
      card.appendChild(progress);

      const { svg, setPetals } = buildFlower();
      card.appendChild(svg);

      const hint = document.createElement('p');
      hint.className = 'exercise-sentence';
      hint.appendChild(window.ExerciseCommon.renderTextWithHints(row.hint || ''));
      card.appendChild(hint);

      // One element per character: letters start empty and fill in when
      // guessed; spaces and other marks (hyphens) are shown from the start.
      const wordBox = document.createElement('div');
      wordBox.className = 'ahorcado-word';
      wordBox.setAttribute('aria-label', 'Palabra oculta');
      const slots = chars.map((ch) => {
        const span = document.createElement('span');
        if (isLetter(ch)) {
          span.className = 'ahorcado-letter';
        } else if (ch === ' ') {
          span.className = 'ahorcado-space';
        } else {
          span.className = 'ahorcado-fixed';
          span.textContent = ch;
        }
        wordBox.appendChild(span);
        return span;
      });
      card.appendChild(wordBox);

      const status = document.createElement('p');
      status.className = 'exercise-result';
      status.setAttribute('aria-live', 'polite');

      const lettersBox = document.createElement('div');
      lettersBox.className = 'ahorcado-letters';
      lettersBox.setAttribute('role', 'group');
      lettersBox.setAttribute('aria-label', 'Letras');
      const letterButtons = LETTERS.map((L) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'letter-btn';
        btn.textContent = L;
        lettersBox.appendChild(btn);
        return btn;
      });
      card.appendChild(lettersBox);

      const guessRow = document.createElement('div');
      guessRow.className = 'ahorcado-guess';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'exercise-input';
      input.autocomplete = 'off';
      input.autocapitalize = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', 'Escribe la palabra completa');
      input.placeholder = 'Escribe la palabra';
      const enyeBtn = document.createElement('button');
      enyeBtn.type = 'button';
      enyeBtn.className = 'accent-btn';
      enyeBtn.textContent = 'ñ';
      enyeBtn.setAttribute('aria-label', 'Insertar ñ');
      const tryBtn = document.createElement('button');
      tryBtn.type = 'button';
      tryBtn.className = 'btn btn-secondary';
      tryBtn.textContent = 'Probar';
      guessRow.appendChild(input);
      guessRow.appendChild(enyeBtn);
      guessRow.appendChild(tryBtn);
      card.appendChild(guessRow);

      card.appendChild(status);

      const controls = document.createElement('div');
      controls.className = 'exercise-controls';
      card.appendChild(controls);

      function refreshWord(revealAll) {
        chars.forEach((ch, i) => {
          if (!isLetter(ch)) return;
          const known = guessed.has(ch);
          slots[i].textContent = (known || revealAll) ? ch.toUpperCase() : '';
          slots[i].classList.toggle('is-missed', revealAll && !known);
        });
      }

      function allFound() {
        return chars.every((ch) => !isLetter(ch) || guessed.has(ch));
      }

      function finish(won) {
        finished = true;
        if (won) wonCount += 1;
        letterButtons.forEach((b) => { b.disabled = true; });
        input.disabled = true;
        enyeBtn.disabled = true;
        tryBtn.disabled = true;
        refreshWord(!won);
        status.textContent = won
          ? '¡Muy bien! Has descubierto la palabra.'
          : `La flor está completa. La palabra era: ${target.toUpperCase()}`;

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
      }

      function addWrong(message) {
        wrong += 1;
        setPetals(wrong);
        status.textContent = message;
        if (wrong >= MAX_WRONG) finish(false);
      }

      letterButtons.forEach((btn, i) => {
        const ch = LETTERS[i].toLowerCase();
        btn.addEventListener('click', () => {
          if (finished || guessed.has(ch)) return;
          guessed.add(ch);
          btn.disabled = true;
          if (target.includes(ch)) {
            btn.classList.add('is-hit');
            refreshWord(false);
            status.textContent = '';
            if (allFound()) finish(true);
          } else {
            btn.classList.add('is-miss');
            addWrong(`No hay ninguna ${LETTERS[i]}. Errores: ${wrong + 1} de ${MAX_WRONG}.`);
          }
        });
      });

      function tryWord() {
        if (finished) return;
        const attempt = normalize(input.value);
        if (!attempt) return;
        if (attempt === target) {
          chars.forEach((ch) => { if (isLetter(ch)) guessed.add(ch); });
          refreshWord(false);
          finish(true);
        } else {
          input.value = '';
          addWrong(`Esa no es la palabra. Errores: ${wrong + 1} de ${MAX_WRONG}.`);
          input.focus();
        }
      }

      tryBtn.addEventListener('click', tryWord);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          tryWord();
        }
      });
      enyeBtn.addEventListener('click', () => {
        if (input.disabled) return;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.setRangeText('ñ', start, end, 'end');
        input.focus();
      });

      window.ExerciseCommon.attachHintLongPress(card);
    }

    function renderSummary() {
      const summary = document.createElement('div');
      summary.className = 'flashcard-summary';

      const result = document.createElement('p');
      result.className = 'exercise-result';
      result.textContent = `Descubriste ${wonCount} de ${deck.length} palabras.`;
      summary.appendChild(result);

      const controls = document.createElement('div');
      controls.className = 'exercise-controls';

      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'btn btn-secondary';
      retryBtn.textContent = 'Jugar de nuevo';
      retryBtn.addEventListener('click', () => {
        deck = shuffle(rows).filter((row) => normalize(row.word));
        index = 0;
        wonCount = 0;
        renderCard();
      });
      controls.appendChild(retryBtn);

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
  window.ExerciseEngines.ahorcado = { init: loadExercise };

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('exercise-app');
    if (container && container.dataset.src && !container.dataset.types) loadExercise(container);
  });
})();

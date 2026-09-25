/*
 * "Texto" exercise engines: a short passage with several blanks, shown as
 * one flowing paragraph — not a numbered list of separate sentences, since
 * the whole point of this exercise is reading continuous text. Two engines
 * share the same CSV/parsing logic and differ only in how a blank is
 * filled in:
 *   textoFacil   ("Fácil")   — word bank, click-to-place (like Empareja)
 *   textoDificil ("Difícil") — typed input, with accent toolbar (like Completa)
 *
 * CSV shape is one row per SET, not one row per blank — the whole passage
 * lives in a single `text` column, with blanks marked inline using
 * [correct] or [correct|translation]. The first item inside the brackets
 * is the right answer; an optional second item, after a single "|", is an
 * English translation for that word — shown as a hover/long-press tooltip
 * on the word bank chip (Fácil) and in the "correcto: ..." reveal after
 * checking (both modes). This used to allow a whole list of decoy words
 * (`[correct|decoy1|decoy2|...]`) for a possible future per-blank
 * multiple-choice variant, but since the word bank only ever shows correct
 * words and no such variant was built, that second slot was repurposed for
 * the translation instead — only one optional word now, not a list. This
 * is much closer to writing normal prose than the site's other CSVs (which
 * need one row per sentence/blank): open a doc, write the passage, then
 * wrap whichever words should be blanked in brackets.
 *
 *   set,id,text
 *   1,1,"Ayer fuimos a [la] playa. Vimos un [perro|dog] enorme."
 *
 * The SAME CSV serves both difficulties, so one file per category is all a
 * topic needs — see exercises/texto.html, which points both the Fácil and
 * Difícil type entries at the same srcTemplate.
 *
 * An optional `word_list` column — a comma-separated list of the
 * dictionary/citation form for the words the passage needs (infinitives
 * for a verb passage, masculine singular for an adjective passage) — is
 * shown above the passage in Difícil mode only. Fácil already gives the
 * exact conjugated words to place, so a reference list there would be
 * redundant; Difícil has no word bank at all otherwise, and a blank sheet
 * of "type the right form" is a lot to hold in your head at once. Each
 * word is its own clickable chip the student can cross off as they use it
 * — purely a self-tracking aid with no effect on grading, so the list
 * doesn't need to map 1:1 to blanks or be in any particular order:
 *
 *   set,id,text,word_list
 *   1,1,"...","trabajar, vivir, ser, estar"
 *
 * (the word_list field itself needs quoting since it contains commas —
 * same as any other CSV field with commas in it).
 *
 * Host page needs, before this script:
 *   1. PapaParse (loaded via CDN)
 *   2. js/exercise-common.js
 *   3. A container: <div id="exercise-app" data-src="/content/exercises/texto-verbos.csv"></div>
 *
 * The surrounding (non-blank) text can also mark individual words for a
 * hover/long-press translation using {word|translation} — a separate,
 * curly-brace syntax from this file's own square-bracket blanks, so a
 * passage can freely use both in the same `text` field. See
 * renderTextWithHints() in exercise-common.js.
 *
 * Registers window.ExerciseEngines.textoFacil and .textoDificil.
 */

(function () {
  const ACCENT_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'];
  const MIN_INPUT_CH = 9;

  // Grows a Difícil-mode input as the student types so the whole word
  // stays visible instead of scrolling inside a fixed-width box — never
  // shrinks below MIN_INPUT_CH, so short answers still line up. Also
  // called directly from the accent toolbar (see buildAccentToolbar)
  // since setRangeText() there changes input.value without firing a
  // native "input" event, so the listener below wouldn't otherwise run.
  function growInput(input) {
    const width = Math.max(MIN_INPUT_CH, input.value.length + 2);
    input.style.width = `${width}ch`;
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Splits "...text... [correct] ...more text... [correct|translation]..."
  // into an ordered list of plain-text and blank segments.
  function parseText(text) {
    const segments = [];
    const regex = /\[([^\]]+)\]/g;
    let lastIndex = 0;
    let match = regex.exec(text);
    while (match !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
      }
      const parts = match[1].split('|').map((s) => s.trim()).filter(Boolean);
      segments.push({ type: 'blank', correct: parts[0] || '', translation: parts[1] || '' });
      lastIndex = regex.lastIndex;
      match = regex.exec(text);
    }
    if (lastIndex < text.length) {
      segments.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return segments;
  }

  // Appends a translation tooltip (same markup as exercise-common.js's
  // buildHintSpan, duplicated here since a <button> can't nest another
  // focusable element the way a plain hint-word span does) to a chip/slot
  // button, and returns it so callers can also stash it for later cloning.
  function appendTooltip(el, translation) {
    if (!translation) return null;
    const tooltip = document.createElement('span');
    tooltip.className = 'hint-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = translation;
    el.appendChild(tooltip);
    return tooltip;
  }

  async function loadExercise(container, mode) {
    try {
      const {
        rows, requestedSet, allSets, availableLevels, requestedLevel,
      } = await window.ExerciseCommon.loadCsvSet(container.dataset.src);

      if (rows.length === 0 || !(rows[0].text || '').trim()) {
        container.innerHTML = `<p>No existe la serie ${requestedSet}.</p>`;
        return;
      }

      renderExercise(container, rows[0], requestedSet, allSets, mode, availableLevels, requestedLevel);
    } catch (err) {
      console.error('No se pudo cargar el ejercicio', err);
      container.innerHTML = '<p>No se pudo cargar el ejercicio. Inténtalo de nuevo más tarde.</p>';
    }
  }

  // Difícil-only reference list — see the file header for what this is
  // for. Each chip toggles a "scratched" (struck-through) look on click;
  // that's all it does, there's no connection to any specific blank or to
  // grading, it's just a place for the student to keep track of which
  // base-form words they've already used while writing.
  function buildWordList(words) {
    const box = document.createElement('div');
    box.className = 'word-pool texto-reference-list';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Palabras de referencia');

    words.forEach((word) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'pool-chip reference-chip';
      chip.textContent = word;
      chip.addEventListener('click', () => {
        chip.classList.toggle('reference-chip-scratched');
      });
      box.appendChild(chip);
    });

    return box;
  }

  function buildAccentToolbar(getInput) {
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
      btn.addEventListener('click', () => {
        const input = getInput();
        if (!input || input.disabled) return;
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        input.setRangeText(ch, start, end, 'end');
        growInput(input);
        input.focus();
      });
      toolbar.appendChild(btn);
    });

    return toolbar;
  }

  function renderExercise(container, row, setNumber, allSets, mode, availableLevels, requestedLevel) {
    container.innerHTML = '';
    container.classList.remove('solution-hidden');

    window.ExerciseCommon.renderLevelNav(availableLevels, requestedLevel);
    const label = window.ExerciseCommon.renderSeriesNav(setNumber, allSets);
    if (label) container.appendChild(label);

    const instructions = document.createElement('p');
    instructions.className = 'exercise-instructions';
    instructions.textContent = mode === 'facil'
      ? 'Selecciona primero una palabra del banco y después toca el espacio donde quieres colocarla. Vuelve a tocar un espacio ya relleno para quitar la palabra.'
      : 'Escribe la palabra correcta en cada espacio.';
    container.appendChild(instructions);

    const segments = parseText(row.text || '');
    const blanks = []; // { el, correct, kind }
    const poolWords = [];
    let selectedChip = null;
    let lastFocusedInput = null;

    if (mode === 'dificil') {
      const wordList = (row.word_list || '').split(',').map((w) => w.trim()).filter(Boolean);
      if (wordList.length > 0) {
        const listLabel = document.createElement('p');
        listLabel.className = 'exercise-instructions';
        listLabel.textContent = 'Palabras que necesitarás (en infinitivo, o en masculino singular si son adjetivos). Haz clic para tacharlas mientras las usas:';
        container.appendChild(listLabel);
        container.appendChild(buildWordList(wordList));
      }
      container.appendChild(buildAccentToolbar(() => lastFocusedInput));
    }

    const passage = document.createElement('p');
    passage.className = 'texto-passage';

    segments.forEach((segment) => {
      if (segment.type === 'text') {
        // {word|translation} is a separate syntax from this file's own
        // [correct] / [correct|translation] blanks — curly vs. square
        // braces — so a passage can freely mix both: [...] still marks a
        // blank to fill, {...} marks a word in the surrounding
        // (already-given) text as hoverable/long-press-able for its
        // translation.
        passage.appendChild(window.ExerciseCommon.renderTextWithHints(segment.value));
        return;
      }

      if (mode === 'facil') {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'drop-slot texto-slot';
        slot.textContent = '______';
        slot.dataset.filled = 'false';
        passage.appendChild(slot);
        blanks.push({
          el: slot, correct: segment.correct, translation: segment.translation, kind: 'slot',
        });

        // Only the correct word goes in the pool — see the file header for
        // why decoys aren't shown here.
        poolWords.push({ word: segment.correct, translation: segment.translation });
      } else {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'exercise-input texto-input';
        input.autocomplete = 'off';
        input.autocapitalize = 'off';
        input.spellcheck = false;
        input.style.width = `${MIN_INPUT_CH}ch`;
        input.setAttribute('aria-label', `Espacio ${blanks.length + 1}`);
        input.addEventListener('focus', () => { lastFocusedInput = input; });
        input.addEventListener('input', () => growInput(input));
        if (!lastFocusedInput) lastFocusedInput = input;
        passage.appendChild(input);
        blanks.push({
          el: input, correct: segment.correct, translation: segment.translation, kind: 'input',
        });
      }
    });

    // Pool built (and, for Fácil, appended) BEFORE the passage — the word
    // bank needs to sit above the text, same as Empareja, not below it.
    let pool = null;
    if (mode === 'facil') {
      pool = document.createElement('div');
      pool.className = 'word-pool';
      pool.setAttribute('role', 'group');
      pool.setAttribute('aria-label', 'Banco de palabras');

      shuffle(poolWords).forEach((entry, chipIndex) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pool-chip';
        chip.dataset.chipId = String(chipIndex);
        // Always lowercase in the bank, even for a blank that happens to be
        // the first word of a sentence in the passage — a capital letter
        // there would be a free clue about *where* the word goes before the
        // student has worked it out (same reasoning as Ordena's word bank).
        // Grading compares case-insensitively (see checkBtn below), so this
        // is display-only and doesn't change what counts as correct.
        chip.dataset.word = entry.word.toLowerCase();
        chip.appendChild(document.createTextNode(entry.word.toLowerCase()));
        appendTooltip(chip, entry.translation);
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
          delete slot.dataset.word;
          slot.classList.remove('drop-slot-filled');
          return;
        }

        if (!selectedChip) return;

        // dataset.word (not textContent) is the actual word — once a chip
        // carries a .hint-tooltip child, chip.textContent would pull in the
        // translation too, since textContent concatenates every descendant
        // text node (same reasoning as Empareja/Ordena).
        slot.textContent = '';
        slot.appendChild(document.createTextNode(selectedChip.dataset.word));
        const tooltip = selectedChip.querySelector('.hint-tooltip');
        if (tooltip) slot.appendChild(tooltip.cloneNode(true));
        slot.dataset.word = selectedChip.dataset.word;
        slot.dataset.filled = 'true';
        slot.dataset.chipId = selectedChip.dataset.chipId;
        slot.classList.add('drop-slot-filled');
        window.ExerciseCommon.attachHintLongPress(slot);

        selectedChip.classList.remove('pool-chip-selected');
        selectedChip.disabled = true;
        selectedChip.hidden = true;
        selectedChip = null;
      }

      pool.querySelectorAll('.pool-chip').forEach((chip) => {
        chip.addEventListener('click', () => selectChip(chip));
      });
      blanks.forEach(({ el }) => {
        el.addEventListener('click', () => toggleSlot(el));
      });
    }

    container.appendChild(passage);
    window.ExerciseCommon.attachHintLongPress(container);

    const controls = document.createElement('div');
    controls.className = 'exercise-controls';

    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'btn btn-primary';
    checkBtn.textContent = 'Comprobar';

    const solutionBtn = document.createElement('button');
    solutionBtn.type = 'button';
    solutionBtn.className = 'btn btn-secondary';
    solutionBtn.textContent = 'Mostrar solución';
    solutionBtn.hidden = true;

    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'btn btn-secondary';
    retryBtn.textContent = 'Intentar de nuevo';
    retryBtn.hidden = true;

    const result = document.createElement('p');
    result.className = 'exercise-result';
    result.setAttribute('aria-live', 'polite');

    checkBtn.addEventListener('click', () => {
      let correctCount = 0;

      blanks.forEach(({
        el, correct, translation, kind,
      }) => {
        const correctLabel = translation ? `${correct} - ${translation}` : correct;

        if (kind === 'slot') {
          const filled = el.dataset.filled === 'true';
          // dataset.word, not textContent — see the note above where it's
          // set (textContent would pull in a cloned tooltip's text too).
          const placed = filled ? (el.dataset.word || '').trim() : '';
          el.disabled = true;
          // Case-insensitive, same as Difícil's typed-answer comparison
          // below — the pool chip is always shown lowercase now (see where
          // it's built above), so an exact-case match would never succeed
          // for a blank whose authored answer starts with a capital letter.
          if (filled && placed.toLowerCase() === correct.toLowerCase()) {
            el.classList.add('drop-slot-correct');
            correctCount += 1;
          } else {
            el.classList.add('drop-slot-incorrect');
            const feedback = document.createElement('span');
            feedback.className = 'exercise-feedback';
            feedback.textContent = ` (correcto: ${correctLabel})`;
            el.after(feedback);
          }
        } else {
          const typed = el.value.trim();
          const isCorrect = typed.toLowerCase() === correct.toLowerCase();
          el.disabled = true;
          if (isCorrect) {
            el.classList.add('input-correct');
            correctCount += 1;
          } else {
            el.classList.add('input-incorrect');
            const feedback = document.createElement('span');
            feedback.className = 'exercise-feedback';
            feedback.textContent = ` (correcto: ${correctLabel})`;
            el.after(feedback);
          }
        }
      });

      if (pool) {
        pool.querySelectorAll('.pool-chip').forEach((c) => { c.disabled = true; });
      }

      result.textContent = `${correctCount} de ${blanks.length} correctas.`;
      checkBtn.hidden = true;
      // Comprobar only colors right/wrong (immediate, above) — the actual
      // "(correcto: ...)" text stays hidden (via the .solution-hidden CSS
      // rule) until Mostrar solución is clicked, so a student who got
      // something wrong can still retry without having seen the answer.
      container.classList.add('solution-hidden');
      solutionBtn.hidden = false;
      retryBtn.hidden = false;
    });

    solutionBtn.addEventListener('click', () => {
      container.classList.remove('solution-hidden');
      solutionBtn.hidden = true;
    });

    retryBtn.addEventListener('click', () => {
      renderExercise(container, row, setNumber, allSets, mode, availableLevels, requestedLevel);
    });

    controls.appendChild(checkBtn);
    controls.appendChild(solutionBtn);
    controls.appendChild(retryBtn);
    container.appendChild(controls);
    container.appendChild(result);
  }

  window.ExerciseEngines = window.ExerciseEngines || {};
  window.ExerciseEngines.textoFacil = { init: (container) => loadExercise(container, 'facil') };
  window.ExerciseEngines.textoDificil = { init: (container) => loadExercise(container, 'dificil') };
})();

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
 * [correct|decoy1|decoy2|...]. The first word inside the brackets is the
 * right answer; any further words, separated by "|", are parsed but
 * currently unused (see below) — a tidy passage description either way, so
 * they're kept in the CSV rather than stripped. This is much closer to
 * writing normal prose than the site's other CSVs (which need one row per
 * sentence/blank): open a doc, write the passage, then wrap whichever
 * words should be blanked in brackets.
 *
 * Fácil's word bank only ever shows the CORRECT words (one chip per
 * blank), not the decoys — a set of small multiple-choice boxes sitting
 * right above each blank was the first design considered, but with a
 * ~200-word passage carrying a dozen-plus blanks, that many 44px-tall
 * button clusters wedged into flowing prose read as cluttered rather than
 * readable, and broke the "one continuous passage" feel that's the point
 * of this exercise type. A single word bank above the whole passage (the
 * same pattern Empareja already uses) reads far more like a normal cloze
 * exercise, so `decoy1`/`decoy2`/etc. are parsed here but not placed in
 * the pool — kept in the CSV/parser in case a future per-blank multiple
 * choice variant wants them.
 *
 *   set,id,text
 *   1,1,"Ayer fuimos a [la|el|los|una] playa."
 *
 * The SAME CSV serves both difficulties (Difícil simply doesn't render the
 * decoys), so one file per category is all a topic needs — see
 * exercises/texto.html, which points both the Fácil and Difícil type
 * entries at the same srcTemplate.
 *
 * Host page needs, before this script:
 *   1. PapaParse (loaded via CDN)
 *   2. js/exercise-common.js
 *   3. A container: <div id="exercise-app" data-src="/content/exercises/texto-verbos.csv"></div>
 *
 * Registers window.ExerciseEngines.textoFacil and .textoDificil.
 */

(function () {
  const ACCENT_CHARS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', '¿', '¡'];
  const MIN_INPUT_CH = 9;

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Splits "...text... [correct|decoy1|decoy2] ...more text..." into an
  // ordered list of plain-text and blank segments.
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
      segments.push({ type: 'blank', correct: parts[0] || '', decoys: parts.slice(1) });
      lastIndex = regex.lastIndex;
      match = regex.exec(text);
    }
    if (lastIndex < text.length) {
      segments.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return segments;
  }

  async function loadExercise(container, mode) {
    try {
      const { rows, requestedSet, allSets } = await window.ExerciseCommon.loadCsvSet(container.dataset.src);

      if (rows.length === 0 || !(rows[0].text || '').trim()) {
        container.innerHTML = `<p>No existe la serie ${requestedSet}.</p>`;
        return;
      }

      renderExercise(container, rows[0], requestedSet, allSets, mode);
    } catch (err) {
      console.error('No se pudo cargar el ejercicio', err);
      container.innerHTML = '<p>No se pudo cargar el ejercicio. Inténtalo de nuevo más tarde.</p>';
    }
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
        input.focus();
      });
      toolbar.appendChild(btn);
    });

    return toolbar;
  }

  function renderExercise(container, row, setNumber, allSets, mode) {
    container.innerHTML = '';

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
      container.appendChild(buildAccentToolbar(() => lastFocusedInput));
    }

    const passage = document.createElement('p');
    passage.className = 'texto-passage';

    segments.forEach((segment) => {
      if (segment.type === 'text') {
        passage.appendChild(document.createTextNode(segment.value));
        return;
      }

      if (mode === 'facil') {
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'drop-slot texto-slot';
        slot.textContent = '______';
        slot.dataset.filled = 'false';
        passage.appendChild(slot);
        blanks.push({ el: slot, correct: segment.correct, kind: 'slot' });

        // Only the correct word goes in the pool — see the file header for
        // why decoys aren't shown here.
        poolWords.push(segment.correct);
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
        input.addEventListener('input', () => {
          const width = Math.max(MIN_INPUT_CH, input.value.length + 2);
          input.style.width = `${width}ch`;
        });
        if (!lastFocusedInput) lastFocusedInput = input;
        passage.appendChild(input);
        blanks.push({ el: input, correct: segment.correct, kind: 'input' });
      }
    });

    container.appendChild(passage);

    let pool = null;
    if (mode === 'facil') {
      pool = document.createElement('div');
      pool.className = 'word-pool';
      pool.setAttribute('role', 'group');
      pool.setAttribute('aria-label', 'Banco de palabras');

      shuffle(poolWords).forEach((word, chipIndex) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'pool-chip';
        chip.textContent = word;
        chip.dataset.chipId = String(chipIndex);
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
          slot.classList.remove('drop-slot-filled');
          return;
        }

        if (!selectedChip) return;

        slot.textContent = selectedChip.textContent;
        slot.dataset.filled = 'true';
        slot.dataset.chipId = selectedChip.dataset.chipId;
        slot.classList.add('drop-slot-filled');

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
      let correctCount = 0;

      blanks.forEach(({ el, correct, kind }) => {
        if (kind === 'slot') {
          const filled = el.dataset.filled === 'true';
          const placed = filled ? el.textContent.trim() : '';
          el.disabled = true;
          if (filled && placed === correct) {
            el.classList.add('drop-slot-correct');
            correctCount += 1;
          } else {
            el.classList.add('drop-slot-incorrect');
            const feedback = document.createElement('span');
            feedback.className = 'exercise-feedback';
            feedback.textContent = ` (correcto: ${correct})`;
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
            feedback.textContent = ` (correcto: ${correct})`;
            el.after(feedback);
          }
        }
      });

      if (pool) {
        pool.querySelectorAll('.pool-chip').forEach((c) => { c.disabled = true; });
      }

      result.textContent = `${correctCount} de ${blanks.length} correctas.`;
      checkBtn.hidden = true;
      retryBtn.hidden = false;
    });

    retryBtn.addEventListener('click', () => {
      renderExercise(container, row, setNumber, allSets, mode);
    });

    controls.appendChild(checkBtn);
    controls.appendChild(retryBtn);
    container.appendChild(controls);
    container.appendChild(result);
  }

  window.ExerciseEngines = window.ExerciseEngines || {};
  window.ExerciseEngines.textoFacil = { init: (container) => loadExercise(container, 'facil') };
  window.ExerciseEngines.textoDificil = { init: (container) => loadExercise(container, 'dificil') };
})();

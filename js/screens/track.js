// Track: único lugar para registrar. Rutina recomendada + buscador + series con "última vez" y sobrecarga.
import { el, clear, icon, toast, fmtDate, confirmDialog, unitToggle, pageHead, emptyState } from '../ui.js';
import { convertTyped, normUnit, resolveExerciseUnit } from '../units.js';
import { searchExercises } from '../search.js';
import { fromDisplay, toDisplay, validateSet, validateDrops, describeSet, suggestDrop, MAX_DROPS } from '../calc.js';
import { buildWorkout, lsGet, lsSet, lsDel } from '../api.js';
import { today, routine } from '../stats.js';
import { lastTime, overloadSuggestion } from '../overload.js';
import { playButton } from '../technique.js';
import { renderGrade } from './grade.js';
import { openExercisePicker } from './picker.js';
import { stepValue, weightStep, parseRest, startRest, restLeft, restAdd, restDone, clock, setProgress, currentExercise } from '../session.js';

const KEY = 'gt_draft';
const MAX_SETS = 50;
const emptySet = () => ({ w: '', r: '', rir: '', drop: false, drops: [], done: false });
const DEFAULT_REST = 90;
export const clearDraft = () => lsDel(KEY);
const loadDraft = (ctx) => {
  const d = lsGet(KEY, null);
  if (d && Array.isArray(d.exercises) && d.exercises.every((e) => ctx.data.exById[e.exercise_id])) return d;
  return null;
};

export async function render(ctx, root) {
  const unit = ctx.profile?.unit === 'lb' ? 'lb' : 'kg';
  let draft = loadDraft(ctx) || { performed_on: today(), plan_day: null, notes: '', unit, exercises: [] };
  let du = normUnit(ctx.profile?.unit || draft.unit);
  draft.exercises.forEach((e) => { e.unit = normUnit(e.unit || draft.unit || du); }); // cada ejercicio tiene su propia unidad
  const persist = () => lsSet(KEY, draft);
  const view = el('div');
  const restHost = el('div', { class: 'rest-host' });
  root.append(view, restHost);
  const rt = routine(ctx);
  const planReps = Object.fromEntries(rt.items.filter((i) => i.reps).map((i) => [i.exercise.id, i.reps]));
  const planRest = Object.fromEntries(rt.items.filter((i) => i.rest).map((i) => [i.exercise.id, i.rest]));
  let rest = null, restDoneAt = 0, timerEl = null, progEl = null;
  const started = () => !!draft.startedAt || draft.exercises.length > 0;

  const newUnit = (id) => resolveExerciseUnit(ctx.workouts, id, du);

  function numInput(label, value, attrs, onInput) {
    const i = el('input', { class: 'input num', type: 'text', inputmode: attrs.inputmode || 'decimal', 'aria-label': label, value, maxlength: 7, placeholder: attrs.placeholder || '', autocomplete: 'off' });
    i.addEventListener('input', () => { i.value = i.value.replace(',', '.').replace(attrs.int ? /[^0-9]/g : /[^0-9.]/g, ''); onInput(i.value); persist(); });
    return i;
  }
  // Campo con −/+ (pasos de 44 px). Si está vacío, parte del valor de referencia de la última vez.
  function stepper(label, value, { step, base, int, placeholder }, onInput) {
    const inp = numInput(label, value, { int, inputmode: int ? 'numeric' : 'decimal', placeholder }, onInput);
    const go = (dir) => { inp.value = stepValue(inp.value, dir, step, { base }); onInput(inp.value); persist(); };
    return el('div', { class: 'stepper' },
      el('button', { class: 'step-btn', type: 'button', 'aria-label': `Menos ${label}`, on: { click: () => go(-1) } }, icon('minus')), inp,
      el('button', { class: 'step-btn', type: 'button', 'aria-label': `Más ${label}`, on: { click: () => go(1) } }, icon('mas')));
  }

  // ---- Última vez: una línea; al tocar se expande ----
  function lastLine(ex, def) {
    const eu = ex.unit, reps = ex.reps || planReps[def.id] || null;
    const l = lastTime(ctx.workouts, def.id, draft.performed_on);
    const box = el('div', { class: 'last' });
    if (!l) { box.append(el('p', { class: 'tip-line', text: `Primera vez · ${overloadSuggestion([], reps, eu).replace(/\.$/, '')}` })); return box; }
    const tip = overloadSuggestion(l.sets, reps, eu).replace(/\.$/, '');
    const line = `Última vez: ${l.sets.map((x) => `${toDisplay(x.weight_kg, eu)}×${x.reps}${x.drops?.length ? '↓' : ''}`).join(', ')} · ${tip}`;
    box.append(el('button', { class: 'last-line', type: 'button', 'aria-expanded': String(!!ex.lastOpen), on: { click: () => { ex.lastOpen = !ex.lastOpen; draw(); } } }, el('span', { text: line }), icon('abajo')));
    if (ex.lastOpen) {
      box.append(el('p', { class: 'muted small', text: fmtDate(l.date) }), el('ul', { class: 'last-sets' }, l.sets.map((x, j) => el('li', { text: `Serie ${j + 1}: ${describeSet(x, eu, toDisplay)}` }))));
      if (reps) box.append(el('p', { class: 'muted small', text: `Rango del plan: ${reps} reps` }));
    }
    return box;
  }

  function restSecFor(ex) { return ex.restSec || parseRest(planRest[ex.exercise_id], DEFAULT_REST); }
  function markDone(ex, s, j, base) {
    if (!s.done) {
      if (s.r === '' && base?.reps) s.r = String(base.reps);
      if (s.w === '' && base?.w !== undefined) s.w = String(base.w);
      if (s.r === '' || Number(s.r) <= 0) return toast('Captura las repeticiones de la serie.', 'bad');
      s.done = true;
      rest = startRest(restSecFor(ex), Date.now()); restDoneAt = 0;
      if (ex.sets.every((x) => x.done)) { // pasa al siguiente ejercicio pendiente
        const nx = draft.exercises.findIndex((e) => e !== ex && e.sets.some((x) => !x.done));
        if (nx >= 0) { draft.exercises.forEach((e) => { e.open = false; }); draft.exercises[nx].open = true; }
      }
    } else s.done = false;
    persist(); draw(); drawRest();
  }

  function setBlock(ex, s, j, l) {
    const p = l?.sets[j] || l?.sets[l.sets.length - 1];
    const base = p ? { w: toDisplay(p.weight_kg, ex.unit), reps: p.reps } : null;
    s.drops ||= [];
    const rirOn = s.rirOn || s.rir !== '';
    const block = el('div', { class: `set${s.done ? ' done' : ''}`, role: 'group', 'aria-label': `Serie ${j + 1}` });
    block.append(el('div', { class: 'row between' },
      el('strong', { text: `Serie ${j + 1}${s.drop ? ' · drop set' : ''}` }),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Más opciones de la serie ${j + 1}`, 'aria-expanded': String(!!s.menu), on: { click: () => { s.menu = !s.menu; draw(); } } }, icon('mas3'))));
    block.append(el('div', { class: 'set-grid' },
      el('div', {}, el('span', { class: 'set-lab', text: `Peso (${ex.unit})` }), stepper(`peso serie ${j + 1}`, s.w, { step: weightStep(ex.unit), base: base?.w, placeholder: base ? String(base.w) : '0' }, (v) => { s.w = v; })),
      el('div', {}, el('span', { class: 'set-lab', text: 'Reps' }), stepper(`repeticiones serie ${j + 1}`, s.r, { step: 1, int: true, base: base?.reps, placeholder: base ? String(base.reps) : '0' }, (v) => { s.r = v; }))));
    if (rirOn) block.append(el('label', { class: 'rir-line' }, el('span', { class: 'muted small', text: 'RIR (reps en reserva)' }), numInput(`RIR serie ${j + 1}`, s.rir, { int: true, inputmode: 'numeric', placeholder: '–' }, (v) => { s.rir = v; })));
    if (s.menu) block.append(el('div', { class: 'set-menu' },
      el('button', { class: `btn small${rirOn ? ' on' : ''}`, type: 'button', 'aria-pressed': String(rirOn), on: { click: () => { s.rirOn = !rirOn; if (!s.rirOn) s.rir = ''; draw(); } } }, 'RIR'),
      el('button', { class: `btn small${s.drop ? ' on' : ''}`, type: 'button', 'aria-pressed': String(!!s.drop), on: { click: () => { s.drop = !s.drop; if (s.drop && !s.drops.length) s.drops.push({ w: '', r: '' }); persist(); draw(); } } }, 'Drop set'),
      el('button', { class: 'btn small danger-o', type: 'button', on: { click: () => { ex.sets.splice(j, 1); persist(); draw(); } } }, 'Quitar serie')));
    if (s.drop) block.append(dropPanel(ex, s, j));
    block.append(el('button', { class: `btn block done-btn${s.done ? ' on' : ' primary'}`, type: 'button', 'aria-pressed': String(!!s.done), on: { click: () => markDone(ex, s, j, base) } },
      icon('check'), s.done ? 'Hecha (toca para deshacer)' : 'Serie hecha'));
    return block;
  }

  function exerciseCard(ex, idx) {
    const def = ctx.data.exById[ex.exercise_id];
    const l = lastTime(ctx.workouts, def.id, draft.performed_on);
    const open = !!ex.open;
    const doneN = ex.sets.filter((x) => x.done).length;
    const card = el('section', { class: `card ex${open ? ' open' : ''}${doneN === ex.sets.length && doneN ? ' complete' : ''}` });
    card.append(el('div', { class: 'ex-top' },
      el('button', { class: 'ex-head', type: 'button', 'aria-expanded': String(open), 'aria-label': `${def.name}, ${doneN} de ${ex.sets.length} series. ${open ? 'Contraer' : 'Expandir'}`,
        on: { click: () => { const was = open; draft.exercises.forEach((e) => { e.open = false; }); ex.open = !was; persist(); draw(); } } },
        el('span', { class: 'grow' }, el('strong', { text: def.name }), el('span', { class: 'muted small block', text: `${doneN}/${ex.sets.length} series${doneN === ex.sets.length && doneN ? ' ✓' : ''}` })), icon('abajo')),
      playButton(def.id, def.name)));
    if (!open) return card;
    card.append(lastLine(ex, def));
    card.append(el('div', { class: 'row between gap' }, el('span', { class: 'muted small', text: 'Unidad de este ejercicio' }), unitToggle(ex.unit, (u) => { ex.sets.forEach((x) => { x.w = convertTyped(x.w, ex.unit, u); (x.drops || []).forEach((d) => { d.w = convertTyped(d.w, ex.unit, u); }); }); ex.unit = u; persist(); draw(); }, `Unidad de ${def.name}`)));
    ex.sets.forEach((s, j) => card.append(setBlock(ex, s, j, l)));
    card.append(el('div', { class: 'row gap' },
      el('button', { class: 'btn grow', type: 'button', on: { click: () => {
        if (ex.sets.length >= MAX_SETS) return toast(`Máximo ${MAX_SETS} series por ejercicio`, 'bad');
        ex.sets.push(emptySet()); persist(); draw();
      } } }, '+ Serie'),
      el('button', { class: 'btn danger-o', type: 'button', 'aria-label': `Quitar ${def.name}`, on: { click: async () => {
        if ((doneN || ex.sets.some((x) => x.w || x.r)) && !(await confirmDialog('Quitar ejercicio', `Se borrarán las series de ${def.name} de esta sesión.`, 'Quitar', true))) return;
        draft.exercises.splice(idx, 1); persist(); draw();
      } } }, 'Quitar ejercicio')));
    return card;
  }

  // Drop sets: sub-panel con Drop 1…6 (peso y reps en la unidad del ejercicio)
  function dropPanel(ex, s, j) {
    const panel = el('div', { class: 'drop-panel', role: 'group', 'aria-label': `Drops de la serie ${j + 1}` });
    s.drops.forEach((d, k) => {
      const prev = k === 0 ? s.w : s.drops[k - 1].w;
      const sug = suggestDrop(prev, ex.unit);
      panel.append(el('div', { class: 'drop-row' },
        el('span', { class: 'drop-no', text: `Drop ${k + 1}` }),
        numInput(`Peso drop ${k + 1} serie ${j + 1}`, d.w, { placeholder: sug ? String(sug) : '0' }, (v) => { d.w = v; }),
        numInput(`Repeticiones drop ${k + 1} serie ${j + 1}`, d.r, { int: true, inputmode: 'numeric', placeholder: '0' }, (v) => { d.r = v; }),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Quitar drop ${k + 1} de la serie ${j + 1}`, on: { click: () => { s.drops.splice(k, 1); if (!s.drops.length) s.drop = false; persist(); draw(); } } }, icon('cerrar'))));
    });
    panel.append(el('button', { class: 'btn small', type: 'button', on: { click: () => {
      if (s.drops.length >= MAX_DROPS) return toast(`Máximo ${MAX_DROPS} drops por serie`, 'bad');
      s.drops.push({ w: '', r: '' }); persist(); draw();
    } } }, '+ Drop'));
    return panel;
  }

  function begin() { if (!draft.startedAt) { draft.startedAt = Date.now(); persist(); } }
  function addMany(items) {
    begin();
    items.forEach((it) => {
      if (draft.exercises.some((e) => e.exercise_id === it.id)) return;
      draft.exercises.push({ exercise_id: it.id, unit: newUnit(it.id), reps: it.reps || planReps[it.id] || null, sets: Array.from({ length: it.sets || 3 }, emptySet) });
    });
    if (!draft.exercises.some((e) => e.open)) { const c = currentExercise(draft.exercises); if (c >= 0) draft.exercises[c].open = true; }
    persist(); toast(items.length === 1 ? `Agregado: ${ctx.data.exById[items[0].id].name}` : `Se agregaron ${items.length} ejercicios`); draw(); window.scrollTo({ top: 0 });
  }
  function openPicker() {
    const recs = rt.items.map((i) => ({ exercise: i.exercise, sets: i.sets, reps: i.reps, sub: i.source === 'plan' ? `Del plan${i.muscles.length ? ' · ' + i.reason.replace('Del plan · ', '') : ''}` : i.reason }));
    openExercisePicker(ctx, { have: new Set(draft.exercises.map((e) => e.exercise_id)), recs, onAdd: addMany });
  }

  async function useRoutine() {
    if (draft.exercises.length && !(await confirmDialog('Usar esta rutina', 'Se reemplazarán los ejercicios de tu sesión actual.', 'Reemplazar'))) return;
    draft = { performed_on: today(), plan_day: rt.next?.session?.name || null, notes: '', unit: du, startedAt: Date.now(),
      exercises: rt.items.map((i, k) => ({ exercise_id: i.exercise.id, unit: newUnit(i.exercise.id), reps: i.reps, open: k === 0, sets: Array.from({ length: i.sets }, emptySet) })) };
    persist(); draw();
  }

  function routineCard() {
    const card = el('section', { class: 'card routine' }, el('p', { class: 'eyebrow', text: 'Rutina recomendada' }));
    if (!rt.next && !rt.items.length) { card.append(el('p', { class: 'muted', text: 'No hay sesión del plan próxima. Empieza un entrenamiento libre y elige tus ejercicios.' })); return card; }
    if (rt.next) {
      const isToday = rt.next.date === today();
      card.append(el('h2', { text: rt.next.session.name }), el('p', { class: 'muted', text: `${isToday ? 'Hoy' : 'Próxima'} · ${fmtDate(rt.next.date)} · ${rt.next.phase.name}` }));
    }
    if (rt.needs.length) card.append(el('div', { class: 'needs' }, rt.needs.slice(0, 4).map((n) => el('span', { class: `badge st-${n.status}`, text: n.text }))));
    card.append(el('ul', { class: 'list' }, rt.items.map((it) => el('li', { class: 'list-item' }, playButton(it.exercise.id, it.exercise.name), el('div', { class: 'grow' },
      el('strong', { text: it.exercise.name }),
      el('div', { class: 'muted small', text: `${it.sets} series${it.reps ? ` · ${it.reps} reps` : ''}${it.rest ? ` · descanso ${it.rest}` : ''}` }),
      el('div', { class: `chip-src ${it.source}`, text: it.source === 'deficit' ? `Añadido · ${it.reason}` : it.reason }))))));
    return card;
  }

  // ---- Guardar ----
  async function save(btn) {
    const exercises = [];
    for (const ex of draft.exercises) {
      const sets = [];
      for (const s of ex.sets) {
        if (s.r === '' && s.w === '') continue;
        const set = { unit: ex.unit, weight_kg: fromDisplay(s.w === '' ? 0 : s.w, ex.unit), reps: s.r === '' ? 0 : Number(s.r), rir: s.rir === '' ? null : Number(s.rir) };
        if (s.drop) {
          set.drops = [];
          for (const d of s.drops || []) {
            if (d.r === '' && d.w === '') continue;
            set.drops.push({ weight_kg: fromDisplay(d.w === '' ? 0 : d.w, ex.unit), reps: d.r === '' ? 0 : Number(d.r), unit: ex.unit });
          }
          const de = validateDrops(set.drops);
          if (de) return toast(`${ctx.data.exById[ex.exercise_id].name}: ${de}`, 'bad');
          set.drops = set.drops.filter((d) => d.reps > 0);
        }
        const err = validateSet(set);
        if (err) return toast(`${ctx.data.exById[ex.exercise_id].name}: ${err}`, 'bad');
        if (set.reps > 0) sets.push(set);
      }
      if (sets.length) exercises.push({ exercise_id: ex.exercise_id, sets });
    }
    if (!exercises.length) return toast('Agrega al menos una serie con repeticiones.', 'bad');
    btn.disabled = true;
    try {
      const w = buildWorkout({ performed_on: draft.performed_on, plan_day: draft.plan_day, notes: draft.notes, exercises });
      const res = await ctx.api.saveWorkout(w);
      clearDraft(); rest = null; clear(restHost);
      const before = ctx.workouts;
      await ctx.refresh();
      ctx.workouts = ctx.workouts.some((x) => x.id === w.id) ? ctx.workouts : [w, ...before];
      showResult(w, res.queued);
    } catch (e) { toast('No se pudo guardar. Revisa los datos e intenta otra vez.', 'bad'); console.warn(e?.message); }
    finally { btn.disabled = false; }
  }

  function showResult(w, queued) {
    clear(view);
    view.append(...[pageHead('Sesión guardada', 'Así te fue: calificación por ejercicio y volumen total.'),
      queued ? el('p', { class: 'banner warn', text: 'Sin conexión: se guardó en este dispositivo y se subirá al reconectar.' }) : null,
      el('section', { class: 'card' }, el('h2', { text: 'Tu calificación' }), renderGrade(ctx, w)),
      el('div', { class: 'row gap' },
        el('button', { class: 'btn primary grow', type: 'button', on: { click: () => { location.hash = '#/summary'; } } }, 'Ver Summary'),
        el('button', { class: 'btn grow', type: 'button', on: { click: () => { location.hash = '#/track'; location.reload(); } } }, 'Listo'))].filter(Boolean));
  }

  async function setUnit(u) {
    draft.exercises.forEach((e) => { e.sets.forEach((x) => { x.w = convertTyped(x.w, e.unit, u); (x.drops || []).forEach((d) => { d.w = convertTyped(d.w, e.unit, u); }); }); e.unit = u; });
    du = u; draft.unit = u; persist();
    ctx.profile = { ...ctx.profile, unit: u };
    try { await ctx.api.saveProfile(ctx.profile); } catch { toast('Unidad cambiada (no se pudo guardar la preferencia)', 'bad'); }
    draw();
  }

  // ---- Descanso: hoja inferior con cuenta regresiva ----
  function drawRest() {
    clear(restHost);
    if (!rest) return;
    const ex = draft.exercises.find((e) => e.open);
    const adj = (sec) => { rest = restAdd(rest, sec, Date.now()); if (ex) { ex.restSec = Math.max(15, rest.total); persist(); } drawRest(); };
    const label = el('strong', { class: 'rest-time', 'aria-hidden': 'true' });
    const live = el('span', { class: 'sr-only', role: 'timer', 'aria-live': 'off' });
    const bar = el('div', { class: 'rest-bar' }, el('div', { class: 'rest-fill' }));
    restHost.append(el('div', { class: 'rest-spacer', 'aria-hidden': 'true' }), el('div', { class: 'rest-sheet', role: 'region', 'aria-label': 'Descanso entre series' },
      el('div', { class: 'row between' }, el('span', { class: 'muted', text: 'Descanso' }), label, live),
      bar,
      el('div', { class: 'row gap' },
        el('button', { class: 'btn small', type: 'button', on: { click: () => adj(-15) } }, '−15 s'),
        el('button', { class: 'btn small', type: 'button', on: { click: () => adj(15) } }, '+15 s'),
        el('button', { class: 'btn small primary grow', type: 'button', on: { click: () => { rest = null; drawRest(); } } }, 'Saltar'))));
    progEl = { label, fill: bar.firstChild, live }; updateRest();
  }
  function updateRest() {
    if (!rest || !progEl) return;
    const now = Date.now(), left = restLeft(rest, now);
    progEl.label.textContent = restDone(rest, now) ? '¡Listo!' : clock(left);
    progEl.fill.style.width = `${Math.min(100, Math.max(0, Math.round(100 * (1 - left / Math.max(1, rest.total)))))}%`;
    if (restDone(rest, now)) {
      if (!restDoneAt) { restDoneAt = now; try { navigator.vibrate?.([200, 100, 200]); } catch { /* sin vibración */ } progEl.live.textContent = 'Descanso terminado'; progEl.live.setAttribute('aria-live', 'assertive'); }
      else if (now - restDoneAt > 4000) { rest = null; drawRest(); }
    }
  }
  const tick = setInterval(() => {
    if (!view.isConnected) { clearInterval(tick); return; }
    if (timerEl && draft.startedAt) timerEl.textContent = clock((Date.now() - draft.startedAt) / 1000);
    updateRest();
  }, 1000);

  function draw() {
    clear(view); timerEl = null;
    if (!started()) {
      view.append(pageHead('Track', 'Registra tu entrenamiento: pesos, repeticiones y descansos.'),
        el('div', { class: 'start-box' },
          el('button', { class: 'btn primary big block', type: 'button', on: { click: () => { begin(); draw(); openPicker(); } } }, 'Empezar entrenamiento'),
          rt.items.length ? el('button', { class: 'btn big block', type: 'button', on: { click: useRoutine } }, 'Usar rutina recomendada') : null,
          el('p', { class: 'muted center small', text: 'Elige tus ejercicios, marca cada serie como hecha y te avisamos cuando termine el descanso.' })),
        routineCard());
      return;
    }
    const prog = setProgress(draft.exercises);
    timerEl = el('strong', { class: 'train-time', text: clock((Date.now() - (draft.startedAt || Date.now())) / 1000) });
    const finishBtn = el('button', { class: 'btn primary', type: 'button', on: { click: () => save(finishBtn) } }, 'Terminar');
    view.append(el('div', { class: 'train-bar' },
      el('div', {}, el('span', { class: 'muted tiny block', text: 'Tiempo' }), timerEl),
      el('div', {}, el('span', { class: 'muted tiny block', text: 'Series' }), el('strong', { text: `${prog.done}/${prog.total}` })),
      finishBtn));
    if (!draft.exercises.some((e) => e.open)) { const c = currentExercise(draft.exercises); if (c >= 0) draft.exercises[c].open = true; }
    if (!draft.exercises.length) view.append(emptyState('Aún no hay ejercicios', 'Agrega ejercicios para empezar a registrar tus series.'));
    draft.exercises.forEach((ex, i) => view.append(exerciseCard(ex, i)));
    view.append(el('button', { class: 'btn block', type: 'button', on: { click: openPicker } }, '+ Agregar ejercicio'));
    const notes = el('textarea', { class: 'input', rows: '2', maxlength: '1000', placeholder: 'Notas (opcional)', 'aria-label': 'Notas de la sesión' });
    notes.value = draft.notes || '';
    notes.addEventListener('input', () => { draft.notes = notes.value; persist(); });
    view.append(el('details', { class: 'card details' }, el('summary', { text: 'Detalles de la sesión' }),
      el('label', { class: 'field' }, el('span', { text: 'Fecha' }),
        el('input', { class: 'input', type: 'date', value: draft.performed_on, max: today(), min: '2000-01-01', on: { change: (e) => { if (e.target.value) { draft.performed_on = e.target.value; persist(); draw(); } } } })),
      draft.plan_day ? el('p', {}, el('span', { class: 'badge', text: draft.plan_day })) : null,
      el('div', { class: 'row between gap' }, el('span', { class: 'muted small', text: 'Unidad: aplicar a todos' }), unitToggle(du, setUnit)), notes));
    view.append(el('button', { class: 'link center danger-t', type: 'button', on: { click: async () => {
      if (!(await confirmDialog('Descartar sesión', 'Se perderán los ejercicios y series de esta sesión.', 'Descartar', true))) return;
      draft = { performed_on: today(), plan_day: null, notes: '', unit: du, exercises: [] }; clearDraft(); rest = null; drawRest(); draw();
    } } }, 'Descartar sesión'));
  }
  draw();
}

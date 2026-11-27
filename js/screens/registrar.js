// Registrar entrenamiento: ejercicios por grupo + buscador, series con peso/reps/RIR.
import { el, clear, icon, toast } from '../ui.js';
import { searchExercises } from '../search.js';
import { fromDisplay, toDisplay, validateSet } from '../calc.js';
import { buildWorkout, lsGet, lsSet, lsDel } from '../api.js';
import { today } from '../stats.js';
import { previousExercise } from '../grading.js';
import { openTechnique } from '../technique.js';
import { renderGrade } from './grade.js';

const KEY = 'gt_draft';
const MAX_SETS = 50;

const emptySet = () => ({ w: '', r: '', rir: '' });
export const clearDraft = () => lsDel(KEY);
const loadDraft = (ctx) => {
  const d = lsGet(KEY, null);
  if (d && Array.isArray(d.exercises) && d.exercises.every((e) => ctx.data.exById[e.exercise_id])) return d;
  return null;
};

export function startDraftFromPlan(ctx, ses) {
  const unit = ctx.profile?.unit === 'lb' ? 'lb' : 'kg';
  const exercises = ses.session.exercises.filter((p) => ctx.data.exById[p.id]).map((p) => ({
    exercise_id: p.id, sets: p.sets.map(() => emptySet()),
  }));
  lsSet(KEY, { performed_on: today(), plan_day: ses.session.name, notes: '', unit, exercises });
}

export async function render(ctx, root) {
  let draft = loadDraft(ctx) || { performed_on: today(), plan_day: null, notes: '', unit: ctx.profile?.unit === 'lb' ? 'lb' : 'kg', exercises: [] };
  const unit = draft.unit;
  const persist = () => lsSet(KEY, draft);
  const view = el('div');
  root.append(view);
  let group = null, query = '', whereHome = false;

  function prevHint(exId, j) {
    const p = previousExercise(ctx.workouts, exId, draft.performed_on);
    const s = p?.sets[j] || p?.sets[p.sets.length - 1];
    return s ? { w: String(toDisplay(s.weight_kg, unit)), r: String(s.reps) } : null;
  }
  function prevText(exId) {
    const p = previousExercise(ctx.workouts, exId, draft.performed_on);
    return p ? `Anterior: ${p.sets.map((s) => `${toDisplay(s.weight_kg, unit)}×${s.reps}`).join(', ')} ${unit}` : 'Primera vez con este ejercicio';
  }

  function numInput(label, value, attrs, onInput) {
    const i = el('input', { class: 'input num', type: 'text', inputmode: attrs.inputmode || 'decimal', 'aria-label': label, value, maxlength: 7, placeholder: attrs.placeholder || '', autocomplete: 'off' });
    i.addEventListener('input', () => { i.value = i.value.replace(',', '.').replace(attrs.int ? /[^0-9]/g : /[^0-9.]/g, ''); onInput(i.value); persist(); });
    return i;
  }

  function exerciseCard(ex, idx) {
    const def = ctx.data.exById[ex.exercise_id];
    const card = el('section', { class: 'card ex' });
    card.append(el('div', { class: 'row between' },
      el('h3', { text: def.name }),
      el('div', { class: 'row gap' },
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Técnica de ${def.name}`, on: { click: () => openTechnique(def.id) } }, icon('video')),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Quitar ${def.name}`, on: { click: () => { draft.exercises.splice(idx, 1); persist(); draw(); } } }, icon('borrar')))));
    card.append(el('p', { class: 'muted small', text: prevText(def.id) }));
    card.append(el('div', { class: 'set-head' }, el('span', { text: '#' }), el('span', { text: unit }), el('span', { text: 'Reps' }), el('span', { text: 'RIR' }), el('span')));
    ex.sets.forEach((s, j) => {
      const hint = prevHint(def.id, j);
      card.append(el('div', { class: 'set-row' },
        el('span', { class: 'set-no', text: String(j + 1) }),
        numInput(`Peso serie ${j + 1}`, s.w, { placeholder: hint?.w || '0' }, (v) => { s.w = v; }),
        numInput(`Repeticiones serie ${j + 1}`, s.r, { int: true, inputmode: 'numeric', placeholder: hint?.r || '0' }, (v) => { s.r = v; }),
        numInput(`RIR serie ${j + 1}`, s.rir, { int: true, inputmode: 'numeric', placeholder: '–' }, (v) => { s.rir = v; }),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Quitar serie ${j + 1}`, on: { click: () => { ex.sets.splice(j, 1); persist(); draw(); } } }, icon('cerrar'))));
    });
    card.append(el('button', { class: 'btn small block', type: 'button', on: { click: () => {
      if (ex.sets.length >= MAX_SETS) return toast(`Máximo ${MAX_SETS} series por ejercicio`, 'bad');
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push(last ? { ...last } : emptySet()); persist(); draw();
    } } }, '+ Serie'));
    return card;
  }

  function picker() {
    const box = el('section', { class: 'card' }, el('h2', { text: 'Agregar ejercicio' }));
    const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar (ej. biceps, press, sentadilla)', 'aria-label': 'Buscar ejercicio', value: query, autocomplete: 'off', maxlength: 60 });
    const results = el('ul', { class: 'list results' });
    const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Grupo muscular' });
    const chip = (label, val) => el('button', { class: `chip${group === val ? ' on' : ''}`, type: 'button', 'aria-pressed': String(group === val), on: { click: () => { group = val; fill(); markChips(); } } }, label);
    const markChips = () => [...chips.children].forEach((c, i) => { const val = i === 0 ? null : ctx.data.groups[i - 1]; c.classList.toggle('on', group === val); c.setAttribute('aria-pressed', String(group === val)); });
    chips.append(chip('Todos', null), ...ctx.data.groups.map((g) => chip(g, g)));
    const home = el('label', { class: 'check' }, el('input', { type: 'checkbox', on: { change: (e) => { whereHome = e.target.checked; fill(); } } }), ' Solo ejercicios para casa');
    home.firstChild.checked = whereHome;
    function fill() {
      clear(results);
      const list = searchExercises(ctx.data.exercises, { query, group, where: whereHome ? 'casa' : null });
      if (!list.length) results.append(el('li', { class: 'muted pad', text: 'Sin resultados.' }));
      list.slice(0, 40).forEach((e) => results.append(el('li', {}, el('button', { class: 'pick', type: 'button', on: { click: () => {
        draft.exercises.push({ exercise_id: e.id, sets: [emptySet(), emptySet(), emptySet()] }); persist(); toast(`Agregado: ${e.name}`); draw(); window.scrollTo({ top: 0 });
      } } }, el('span', { class: 'grow' }, el('strong', { text: e.name }), el('span', { class: 'muted small block', text: `${e.group} · ${e.equipment}` })), el('span', { class: 'plus', 'aria-hidden': 'true', text: '+' })))));
      if (list.length > 40) results.append(el('li', { class: 'muted pad small', text: `Mostrando 40 de ${list.length}. Afina la búsqueda.` }));
    }
    search.addEventListener('input', () => { query = search.value; fill(); });
    box.append(el('div', { class: 'search' }, icon('buscar'), search), chips, home, results);
    fill();
    return box;
  }

  async function save(btn) {
    const exercises = [];
    for (const ex of draft.exercises) {
      const sets = [];
      for (const s of ex.sets) {
        if (s.r === '' && s.w === '') continue;
        const set = { weight_kg: fromDisplay(s.w === '' ? 0 : s.w, unit), reps: s.r === '' ? 0 : Number(s.r), rir: s.rir === '' ? null : Number(s.rir) };
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
      clearDraft();
      const before = ctx.workouts;
      await ctx.refresh();
      // Calificar contra las sesiones previas (sin incluir esta misma)
      ctx.workouts = ctx.workouts.some((x) => x.id === w.id) ? ctx.workouts : [w, ...before];
      showResult(w, res.queued);
    } catch (e) { toast('No se pudo guardar. Revisa los datos e intenta otra vez.', 'bad'); console.warn(e?.message); }
    finally { btn.disabled = false; }
  }

  function showResult(w, queued) {
    clear(view);
    view.append(...[el('h1', { text: 'Sesión guardada' }),
      queued ? el('p', { class: 'banner warn', text: 'Sin conexión: se guardó en este dispositivo y se subirá al reconectar.' }) : null,
      el('section', { class: 'card' }, el('h2', { text: 'Tu calificación' }), renderGrade(ctx, w)),
      el('div', { class: 'row gap' },
        el('button', { class: 'btn primary grow', type: 'button', on: { click: () => { location.hash = '#/progreso'; } } }, 'Ver progreso'),
        el('button', { class: 'btn grow', type: 'button', on: { click: () => { location.hash = '#/hoy'; } } }, 'Listo'))].filter(Boolean));
  }

  function draw() {
    clear(view);
    view.append(el('h1', { text: 'Registrar' }));
    const meta = el('div', { class: 'card row between wrap gap' },
      el('label', { class: 'field inline' }, el('span', { text: 'Fecha' }),
        el('input', { class: 'input', type: 'date', value: draft.performed_on, max: today(), min: '2000-01-01', on: { change: (e) => { if (e.target.value) { draft.performed_on = e.target.value; persist(); draw(); } } } })),
      draft.plan_day ? el('span', { class: 'badge', text: draft.plan_day }) : null);
    view.append(meta);
    if (!draft.exercises.length) view.append(el('p', { class: 'muted', text: 'Elige ejercicios abajo para empezar.' }));
    draft.exercises.forEach((ex, i) => view.append(exerciseCard(ex, i)));
    if (draft.exercises.length) {
      const notes = el('textarea', { class: 'input', rows: '2', maxlength: '1000', placeholder: 'Notas (opcional)', 'aria-label': 'Notas' });
      notes.value = draft.notes || '';
      notes.addEventListener('input', () => { draft.notes = notes.value; persist(); });
      const saveBtn = el('button', { class: 'btn primary block big', type: 'button', on: { click: () => save(saveBtn) } }, 'Guardar sesión');
      view.append(el('div', { class: 'card' }, notes), saveBtn,
        el('button', { class: 'link center', type: 'button', on: { click: () => { draft = { performed_on: today(), plan_day: null, notes: '', unit, exercises: [] }; clearDraft(); draw(); } } }, 'Descartar borrador'));
    }
    view.append(picker());
  }
  draw();
}

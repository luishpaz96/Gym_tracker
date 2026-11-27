// Track: único lugar para registrar. Rutina recomendada + buscador + series con "última vez" y sobrecarga.
import { el, clear, icon, toast, fmtDate, confirmDialog } from '../ui.js';
import { searchExercises } from '../search.js';
import { fromDisplay, toDisplay, validateSet } from '../calc.js';
import { buildWorkout, lsGet, lsSet, lsDel } from '../api.js';
import { today, routine } from '../stats.js';
import { lastTime, overloadSuggestion } from '../overload.js';
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

export async function render(ctx, root) {
  const unit = ctx.profile?.unit === 'lb' ? 'lb' : 'kg';
  let draft = loadDraft(ctx) || { performed_on: today(), plan_day: null, notes: '', unit, exercises: [] };
  draft.unit = draft.unit || unit;
  const du = draft.unit;
  const persist = () => lsSet(KEY, draft);
  const view = el('div');
  root.append(view);
  let group = null, query = '', whereHome = false;
  const rt = routine(ctx);
  const planReps = Object.fromEntries(rt.items.filter((i) => i.reps).map((i) => [i.exercise.id, i.reps]));

  const fmtSet = (s, j) => `Serie ${j + 1}: ${toDisplay(s.weight_kg, du)} ${du} × ${s.reps}`;

  function numInput(label, value, attrs, onInput) {
    const i = el('input', { class: 'input num', type: 'text', inputmode: attrs.inputmode || 'decimal', 'aria-label': label, value, maxlength: 7, placeholder: attrs.placeholder || '', autocomplete: 'off' });
    i.addEventListener('input', () => { i.value = i.value.replace(',', '.').replace(attrs.int ? /[^0-9]/g : /[^0-9.]/g, ''); onInput(i.value); persist(); });
    return i;
  }

  function lastPanel(ex, def) {
    const reps = ex.reps || planReps[def.id] || null;
    const l = lastTime(ctx.workouts, def.id, draft.performed_on);
    const box = el('div', { class: 'last' });
    if (!l) {
      box.append(el('strong', { text: 'Última vez' }), el('p', { class: 'muted small', text: 'Primera vez con este ejercicio.' }), el('p', { class: 'tip-line', text: overloadSuggestion([], reps, du) }));
      return box;
    }
    box.append(el('strong', { text: `Última vez: ${fmtDate(l.date)}` }),
      el('ul', { class: 'last-sets' }, l.sets.map((s, j) => el('li', { text: fmtSet(s, j) }))),
      el('p', { class: 'tip-line', text: overloadSuggestion(l.sets, reps, du) }));
    if (reps) box.append(el('p', { class: 'muted tiny', text: `Rango del plan: ${reps} reps` }));
    return box;
  }

  function exerciseCard(ex, idx) {
    const def = ctx.data.exById[ex.exercise_id];
    const l = lastTime(ctx.workouts, def.id, draft.performed_on);
    const rirOpen = ex.rirOpen || ex.sets.some((s) => s.rir !== '');
    const card = el('section', { class: `card ex${rirOpen ? '' : ' no-rir'}` });
    card.append(el('div', { class: 'row between' },
      el('h3', { text: def.name }),
      el('div', { class: 'row gap' },
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Técnica de ${def.name}`, on: { click: () => openTechnique(def.id) } }, icon('video')),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Quitar ${def.name}`, on: { click: () => { draft.exercises.splice(idx, 1); persist(); draw(); } } }, icon('borrar')))));
    card.append(lastPanel(ex, def));
    card.append(el('div', { class: 'set-head' }, el('span', { text: '#' }), el('span', { text: `Peso (${du})` }), el('span', { text: 'Reps' }), el('span', { class: 'rir-col', text: 'RIR' }), el('span')));
    ex.sets.forEach((s, j) => {
      const p = l?.sets[j] || l?.sets[l.sets.length - 1];
      card.append(el('div', { class: 'set-row' },
        el('span', { class: 'set-no', text: String(j + 1) }),
        numInput(`Peso serie ${j + 1}`, s.w, { placeholder: p ? String(toDisplay(p.weight_kg, du)) : '0' }, (v) => { s.w = v; }),
        numInput(`Repeticiones serie ${j + 1}`, s.r, { int: true, inputmode: 'numeric', placeholder: p ? String(p.reps) : '0' }, (v) => { s.r = v; }),
        numInput(`RIR serie ${j + 1}`, s.rir, { int: true, inputmode: 'numeric', placeholder: '–' }, (v) => { s.rir = v; }),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Quitar serie ${j + 1}`, on: { click: () => { ex.sets.splice(j, 1); persist(); draw(); } } }, icon('cerrar'))));
    });
    card.append(el('div', { class: 'row gap' },
      el('button', { class: 'btn small grow', type: 'button', on: { click: () => {
        if (ex.sets.length >= MAX_SETS) return toast(`Máximo ${MAX_SETS} series por ejercicio`, 'bad');
        ex.sets.push(emptySet()); persist(); draw();
      } } }, '+ Serie'),
      el('button', { class: 'btn small', type: 'button', 'aria-expanded': String(rirOpen), on: { click: () => { ex.rirOpen = !rirOpen; draw(); } } }, rirOpen ? 'Ocultar RIR' : 'RIR (opcional)')));
    return card;
  }

  function addExercise(id, reps, nSets = 3) {
    draft.exercises.push({ exercise_id: id, reps: reps || planReps[id] || null, sets: Array.from({ length: nSets }, emptySet) });
    persist(); toast(`Agregado: ${ctx.data.exById[id].name}`); draw(); window.scrollTo({ top: 0 });
  }

  async function useRoutine() {
    if (draft.exercises.length && !(await confirmDialog('Usar esta rutina', 'Se reemplazarán los ejercicios de tu sesión actual.', 'Reemplazar'))) return;
    draft = { performed_on: today(), plan_day: rt.next?.session?.name || null, notes: '', unit: du,
      exercises: rt.items.map((i) => ({ exercise_id: i.exercise.id, reps: i.reps, sets: Array.from({ length: i.sets }, emptySet) })) };
    persist(); draw();
  }

  function routineCard() {
    const card = el('section', { class: 'card routine' }, el('p', { class: 'eyebrow', text: 'Rutina recomendada' }));
    if (!rt.next && !rt.items.length) { card.append(el('p', { class: 'muted', text: 'No hay sesión del plan próxima. Elige ejercicios abajo.' })); return card; }
    if (rt.next) {
      const isToday = rt.next.date === today();
      card.append(el('h2', { text: rt.next.session.name }), el('p', { class: 'muted', text: `${isToday ? 'Hoy' : 'Próxima'} · ${fmtDate(rt.next.date)} · ${rt.next.phase.name}` }));
    }
    if (rt.needs.length) {
      card.append(el('div', { class: 'needs' }, rt.needs.slice(0, 4).map((n) => el('span', { class: `badge st-${n.status}`, text: n.text }))));
    }
    card.append(el('ul', { class: 'list' }, rt.items.map((it) => el('li', { class: 'list-item' }, el('div', { class: 'grow' },
      el('strong', { text: it.exercise.name }),
      el('div', { class: 'muted small', text: `${it.sets} series${it.reps ? ` · ${it.reps} reps` : ''}${it.rest ? ` · descanso ${it.rest}` : ''}` }),
      el('div', { class: `chip-src ${it.source}`, text: it.source === 'deficit' ? `Añadido · ${it.reason}` : it.reason }))))));
    card.append(el('button', { class: 'btn primary block', type: 'button', on: { click: useRoutine } }, 'Usar esta rutina'));
    return card;
  }

  function picker() {
    const box = el('section', { class: 'card' }, el('h2', { text: 'Agregar ejercicio' }));
    const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar (ej. biceps, press, sentadilla)', 'aria-label': 'Buscar ejercicio', value: query, autocomplete: 'off', maxlength: 60 });
    const recsHost = el('div');
    const results = el('ul', { class: 'list results' });
    const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Grupo muscular' });
    const groups = [null, ...ctx.data.groups];
    groups.forEach((g) => chips.append(el('button', { class: 'chip', type: 'button', on: { click: () => { group = g; fill(); } } }, g || 'Todos')));
    const home = el('label', { class: 'check' }, el('input', { type: 'checkbox', on: { change: (e) => { whereHome = e.target.checked; fill(); } } }), ' Solo ejercicios para casa');
    home.firstChild.checked = whereHome;
    const row = (e, sub, onClick) => el('li', {}, el('button', { class: 'pick', type: 'button', on: { click: onClick } },
      el('span', { class: 'grow' }, el('strong', { text: e.name }), el('span', { class: 'muted small block', text: sub })), el('span', { class: 'plus', 'aria-hidden': 'true', text: '+' })));
    function fill() {
      [...chips.children].forEach((c, i) => { c.classList.toggle('on', groups[i] === group); c.setAttribute('aria-pressed', String(groups[i] === group)); });
      clear(recsHost); clear(results);
      const have = new Set(draft.exercises.map((e) => e.exercise_id));
      if (!query && !group && !whereHome) {
        const recs = rt.items.filter((i) => !have.has(i.exercise.id));
        if (recs.length) recsHost.append(el('h3', { class: 'sub', text: 'Recomendados' }),
          el('ul', { class: 'list' }, recs.map((i) => row(i.exercise, i.source === 'plan' ? `Del plan${i.muscles.length ? ' · ' + i.reason.replace('Del plan · ', '') : ''}` : i.reason, () => addExercise(i.exercise.id, i.reps, i.sets)))),
          el('h3', { class: 'sub', text: 'Todos los ejercicios' }));
      }
      const list = searchExercises(ctx.data.exercises, { query, group, where: whereHome ? 'casa' : null });
      if (!list.length) results.append(el('li', { class: 'muted pad', text: 'Sin resultados.' }));
      list.slice(0, 40).forEach((e) => results.append(row(e, `${e.group} · ${e.equipment}`, () => addExercise(e.id))));
      if (list.length > 40) results.append(el('li', { class: 'muted pad small', text: `Mostrando 40 de ${list.length}. Afina la búsqueda.` }));
    }
    search.addEventListener('input', () => { query = search.value; fill(); });
    box.append(el('div', { class: 'search' }, icon('buscar'), search), chips, home, recsHost, results);
    fill();
    return box;
  }

  async function save(btn) {
    const exercises = [];
    for (const ex of draft.exercises) {
      const sets = [];
      for (const s of ex.sets) {
        if (s.r === '' && s.w === '') continue;
        const set = { weight_kg: fromDisplay(s.w === '' ? 0 : s.w, du), reps: s.r === '' ? 0 : Number(s.r), rir: s.rir === '' ? null : Number(s.rir) };
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
        el('button', { class: 'btn primary grow', type: 'button', on: { click: () => { location.hash = '#/summary'; } } }, 'Ver Summary'),
        el('button', { class: 'btn grow', type: 'button', on: { click: () => { location.hash = '#/track'; location.reload(); } } }, 'Listo'))].filter(Boolean));
  }

  function draw() {
    clear(view);
    view.append(el('h1', { text: 'Track' }), routineCard());
    const meta = el('div', { class: 'card row between wrap gap' },
      el('label', { class: 'field inline' }, el('span', { text: 'Fecha' }),
        el('input', { class: 'input', type: 'date', value: draft.performed_on, max: today(), min: '2000-01-01', on: { change: (e) => { if (e.target.value) { draft.performed_on = e.target.value; persist(); draw(); } } } })),
      draft.plan_day ? el('span', { class: 'badge', text: draft.plan_day }) : null);
    view.append(el('h2', { class: 'sub', text: 'Tu sesión' }), meta);
    if (!draft.exercises.length) view.append(el('p', { class: 'muted', text: 'Usa la rutina recomendada o elige ejercicios abajo.' }));
    draft.exercises.forEach((ex, i) => view.append(exerciseCard(ex, i)));
    if (draft.exercises.length) {
      const notes = el('textarea', { class: 'input', rows: '2', maxlength: '1000', placeholder: 'Notas (opcional)', 'aria-label': 'Notas' });
      notes.value = draft.notes || '';
      notes.addEventListener('input', () => { draft.notes = notes.value; persist(); });
      const saveBtn = el('button', { class: 'btn primary block big', type: 'button', on: { click: () => save(saveBtn) } }, 'Guardar sesión');
      view.append(el('div', { class: 'card' }, notes), saveBtn,
        el('button', { class: 'link center', type: 'button', on: { click: () => { draft = { performed_on: today(), plan_day: null, notes: '', unit: du, exercises: [] }; clearDraft(); draw(); } } }, 'Descartar borrador'));
    }
    view.append(picker());
  }
  draw();
}

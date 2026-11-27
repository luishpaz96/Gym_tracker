// Selector de ejercicios a pantalla completa: búsqueda, grupos con icono, Recomendados, Recientes y selección múltiple.
import { el, clear, icon, openSheet } from '../ui.js';
import { searchExercises } from '../search.js';
import { normalize } from '../search.js';
import { playButton } from '../technique.js';

const PAGE = 40;
export function groupIcon(g) {
  const n = normalize(g || '');
  if (/pecho/.test(n)) return 'g_pecho';
  if (/espalda|trapecio/.test(n)) return 'g_espalda';
  if (/hombro/.test(n)) return 'g_hombro';
  if (/biceps|triceps|antebrazo/.test(n)) return 'g_brazo';
  if (/cuadriceps|femoral|gluteo/.test(n)) return 'g_pierna';
  if (/pantorrilla/.test(n)) return 'g_pantorrilla';
  if (/abdomen|core/.test(n)) return 'g_core';
  return 'g_otro';
}
// Ejercicios usados recientemente (más reciente primero, sin repetir)
export function recentExercises(workouts, limit = 8) {
  const seen = []; 
  for (const w of [...(workouts || [])].sort((a, b) => b.performed_on.localeCompare(a.performed_on))) {
    for (const e of w.exercises || []) { if (!seen.includes(e.exercise_id)) seen.push(e.exercise_id); if (seen.length >= limit) return seen; }
  }
  return seen;
}

// recs: [{exercise, sets, reps, sub}]; onAdd(items) recibe [{id, sets, reps}] en el orden elegido.
export function openExercisePicker(ctx, { have = new Set(), recs = [], onAdd }) {
  let query = '', group = null, home = false, limit = PAGE;
  const sel = new Map();
  const sheet = openSheet('Agregar ejercicios');
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar (ej. bíceps, press, sentadilla)', 'aria-label': 'Buscar ejercicio', autocomplete: 'off', maxlength: 60 });
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Grupo muscular' });
  const groups = [null, ...ctx.data.groups];
  groups.forEach((g) => chips.append(el('button', { class: 'chip', type: 'button', on: { click: () => { group = g; limit = PAGE; fill(); } } }, g ? icon(groupIcon(g)) : null, g || 'Todos')));
  const homeBox = el('input', { type: 'checkbox', 'aria-label': 'Solo ejercicios para casa', on: { change: (e) => { home = e.target.checked; limit = PAGE; fill(); } } });
  const list = el('div', { class: 'picker-list' });
  const bar = el('div', { class: 'sheet-bar hidden' });
  const addBtn = el('button', { class: 'btn primary big block', type: 'button' });
  bar.append(addBtn);
  sheet.body.append(el('div', { class: 'sheet-top' }, el('div', { class: 'search' }, icon('buscar'), search), chips, el('label', { class: 'check' }, homeBox, ' Solo ejercicios para casa')), list, bar);

  const toggle = (item) => { if (sel.has(item.id)) sel.delete(item.id); else sel.set(item.id, item); refreshBar(); fill(true); };
  function refreshBar() {
    bar.classList.toggle('hidden', !sel.size);
    addBtn.textContent = sel.size === 1 ? 'Agregar 1 ejercicio' : `Agregar ${sel.size} ejercicios`;
  }
  addBtn.addEventListener('click', () => { const items = [...sel.values()]; sheet.close(); onAdd(items); });

  const row = (e, sub, item) => {
    const on = sel.has(e.id);
    return el('li', { class: `list-item tight${on ? ' sel' : ''}` }, playButton(e.id, e.name),
      el('button', { class: 'pick nb', type: 'button', 'aria-pressed': String(on), 'aria-label': `${on ? 'Quitar de la selección' : 'Seleccionar'} ${e.name}`, on: { click: () => toggle(item) } },
        el('span', { class: 'grow' }, el('strong', { text: e.name }), el('span', { class: 'muted small block', text: sub })),
        el('span', { class: `plus${on ? ' on' : ''}`, 'aria-hidden': 'true' }, on ? icon('check') : '+')));
  };
  const muscles = (e) => [e.group, (e.primary || []).map((m) => ctx.data.muscleById[m]?.name || m).filter((n) => n !== e.group).join(', '), e.equipment].filter(Boolean).join(' · ');
  const section = (title, rows) => (rows.length ? [el('h3', { class: 'sub', text: title }), el('ul', { class: 'list' }, rows)] : []);

  function fill(keepScroll) {
    [...chips.children].forEach((c, i) => { c.classList.toggle('on', groups[i] === group); c.setAttribute('aria-pressed', String(groups[i] === group)); });
    const y = sheet.body.scrollTop;
    clear(list);
    const plain = !query && !group && !home;
    if (plain) {
      const recRows = recs.filter((r) => !have.has(r.exercise.id));
      list.append(...section('Recomendados', recRows.map((r) => row(r.exercise, r.sub || muscles(r.exercise), { id: r.exercise.id, sets: r.sets, reps: r.reps }))));
      const rec = recentExercises(ctx.workouts).filter((id) => ctx.data.exById[id] && !have.has(id) && !recRows.some((r) => r.exercise.id === id));
      list.append(...section('Recientes', rec.map((id) => row(ctx.data.exById[id], muscles(ctx.data.exById[id]), { id }))));
    }
    const all = searchExercises(ctx.data.exercises, { query, group, where: home ? 'casa' : null });
    list.append(el('h3', { class: 'sub', text: plain ? `Todos los ejercicios (${all.length})` : `${all.length} resultado${all.length === 1 ? '' : 's'}` }));
    if (!all.length) list.append(el('p', { class: 'muted pad', text: 'Sin resultados. Prueba otra palabra o quita el filtro de grupo.' }));
    list.append(el('ul', { class: 'list' }, all.slice(0, limit).map((e) => row(e, muscles(e), { id: e.id }))));
    if (all.length > limit) list.append(el('button', { class: 'btn block', type: 'button', on: { click: () => { limit += PAGE; fill(true); } } }, `Mostrar más (${all.length - limit} restantes)`));
    if (keepScroll) sheet.body.scrollTop = y;
  }
  search.addEventListener('input', () => { query = search.value; limit = PAGE; fill(); });
  refreshBar(); fill();
  search.focus();
  return sheet;
}

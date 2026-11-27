import { el, clear, icon } from '../ui.js';
import { searchExercises } from '../search.js';
import { openTechnique } from '../technique.js';

export async function render(ctx, root) {
  let group = null, query = '';
  root.append(el('h1', { text: 'Biblioteca' }));
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar ejercicio…', 'aria-label': 'Buscar ejercicio', autocomplete: 'off', maxlength: 60 });
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Grupo muscular' });
  const list = el('ul', { class: 'list' });
  const count = el('p', { class: 'muted small', 'aria-live': 'polite' });
  const groups = [null, ...ctx.data.groups];
  groups.forEach((g) => chips.append(el('button', { class: 'chip', type: 'button', on: { click: () => { group = g; fill(); } } }, g || 'Todos')));
  function fill() {
    [...chips.children].forEach((c, i) => { c.classList.toggle('on', groups[i] === group); c.setAttribute('aria-pressed', String(groups[i] === group)); });
    clear(list);
    const res = searchExercises(ctx.data.exercises, { query, group });
    count.textContent = `${res.length} ejercicio${res.length === 1 ? '' : 's'}`;
    res.forEach((e) => list.append(el('li', {}, el('button', { class: 'pick', type: 'button', on: { click: () => openTechnique(e.id) } },
      el('span', { class: 'grow' }, el('strong', { text: e.name }), el('span', { class: 'muted small block', text: `${e.group} · ${e.equipment}` })),
      el('span', { class: 'plus', 'aria-hidden': 'true' }, icon('video'))))));
    if (!res.length) list.append(el('li', { class: 'muted pad', text: 'Sin resultados.' }));
  }
  search.addEventListener('input', () => { query = search.value; fill(); });
  root.append(el('div', { class: 'search' }, icon('buscar'), search), chips, count, list);
  fill();
}

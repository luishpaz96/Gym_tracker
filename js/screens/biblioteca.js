import { el, clear, icon, pageHead } from '../ui.js';
import { searchExercises } from '../search.js';
import { openTechnique, playButton } from '../technique.js';

export async function render(ctx, root) {
  let group = null, query = '', limit = 60;
  root.append(pageHead('Biblioteca', 'Busca un ejercicio y toca ▶ para ver cómo se hace.'));
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar ejercicio…', 'aria-label': 'Buscar ejercicio', autocomplete: 'off', maxlength: 60 });
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Grupo muscular' });
  const list = el('ul', { class: 'list' });
  const count = el('p', { class: 'muted small', 'aria-live': 'polite' });
  const groups = [null, ...ctx.data.groups];
  groups.forEach((g) => chips.append(el('button', { class: 'chip', type: 'button', on: { click: () => { group = g; limit = 60; fill(); } } }, g || 'Todos')));
  function fill() {
    [...chips.children].forEach((c, i) => { c.classList.toggle('on', groups[i] === group); c.setAttribute('aria-pressed', String(groups[i] === group)); });
    clear(list);
    const res = searchExercises(ctx.data.exercises, { query, group });
    count.textContent = `${res.length} ejercicio${res.length === 1 ? '' : 's'}`;
    res.slice(0, limit).forEach((e) => list.append(el('li', { class: 'list-item tight' }, playButton(e.id, e.name), el('button', { class: 'pick nb', type: 'button', 'aria-label': `Ficha de ${e.name}`, on: { click: () => openTechnique(e.id) } },
      el('span', { class: 'grow' }, el('strong', { text: e.name }), el('span', { class: 'muted small block', text: `${e.group} · ${e.equipment}` }))))));
    if (res.length > limit) list.append(el('li', {}, el('button', { class: 'btn block', type: 'button', on: { click: () => { limit += 60; fill(); } } }, `Mostrar más (${res.length - limit} restantes)`)));
    if (!res.length) list.append(el('li', { class: 'muted pad', text: 'Sin resultados.' }));
  }
  search.addEventListener('input', () => { query = search.value; limit = 60; fill(); });
  root.append(el('div', { class: 'search' }, icon('buscar'), search), chips, count, list);
  fill();
}

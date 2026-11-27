// Recetas: categorías, búsqueda, filtros, detalle y "Agregar a comida".
import { el, clear, icon, openModal, fmtNum , pageHead } from '../ui.js';
import { loadRecipes } from '../data.js';
import { normalize } from '../search.js';
import { openLogEntry } from './logentry.js';

const PAGE = 30;
const st = { cat: null, query: '', protein: false, quick: false, light: false, fav: false, shown: PAGE };
let indexCache = null;

const favs = () => { try { return new Set(JSON.parse(localStorage.getItem('gt_fav') || '[]')); } catch { return new Set(); } };
const saveFavs = (s) => { try { localStorage.setItem('gt_fav', JSON.stringify([...s])); } catch { /* sin almacenamiento */ } };

// Índice de búsqueda normalizado (se construye una sola vez).
function searchIndex(rd) {
  if (indexCache) return indexCache;
  indexCache = new Map(rd.recipes.map((r) => [r.id, normalize([r.name, ...(r.tags || []), ...(r.ingredients || []).map((i) => rd.foodById?.[i.food]?.name || i.food)].join(' '))]));
  return indexCache;
}
const isHighProtein = (r) => (r.tags || []).includes('alta en proteína') || r.per_serving.p >= 30;

function filtered(rd) {
  const idx = searchIndex(rd), q = normalize(st.query).split(' ').filter(Boolean), fv = favs();
  return rd.recipes.filter((r) => (!st.cat || r.cat === st.cat) && (!st.protein || isHighProtein(r)) && (!st.quick || r.time_min < 30) && (!st.light || r.per_serving.kcal < 500)
    && (!st.fav || fv.has(r.id)) && q.every((t) => idx.get(r.id).includes(t)));
}

export function openRecipe(ctx, rd, r) {
  const ps = r.per_serving;
  const ing = (r.ingredients || []).map((i) => {
    const f = rd.foodById?.[i.food];
    const home = f?.unit ? ` (≈ ${fmtNum(Math.round((i.g / f.unit.g) * 2) / 2, 1)} ${f.unit.name})` : '';
    return el('li', { text: `${f?.name || i.food}: ${fmtNum(i.g)} g${home}${i.note ? `, ${i.note}` : ''}` });
  });
  const stat = (v, l) => el('div', { class: 'stat' }, el('strong', { text: v }), l);
  const body = el('div', { class: 'tech' },
    el('p', { class: 'muted small', text: `${r.servings} porciones · ${r.time_min} min · ${r.level} · ${(r.tags || []).join(', ')}` }),
    el('div', { class: 'stat-row' }, stat(fmtNum(ps.kcal), 'kcal'), stat(fmtNum(ps.p, 1), 'P g'), stat(fmtNum(ps.c, 1), 'C g'), stat(fmtNum(ps.f, 1), 'G g')),
    el('p', { class: 'muted small', text: `Por porción · fibra ${fmtNum(ps.fiber || 0, 1)} g` }),
    el('h3', { text: 'Ingredientes (receta completa)' }), el('ul', { class: 'cues' }, ing),
    el('h3', { text: 'Preparación' }), el('ol', { class: 'cues' }, (r.steps || []).map((s) => el('li', { text: s }))),
    el('button', { class: 'btn primary block big', type: 'button', on: { click: () => openLogEntry(ctx, { kind: 'recipe', item: r }) } }, 'Agregar a comida'));
  openModal(r.name, body, { wide: true });
}

export async function render(ctx, root) {
  root.append(pageHead('Recetas', 'Ideas de comidas con sus macros; agrégalas a tu día en un toque.'));
  const rd = await loadRecipes();
  if (!rd.recipes.length) { root.append(el('p', { class: 'card muted', text: 'Las recetas aún no están disponibles. Revisa tu conexión.' })); return; }
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar por nombre, ingrediente o etiqueta', 'aria-label': 'Buscar receta', value: st.query, autocomplete: 'off', maxlength: 60 });
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtros' });
  const defs = [['protein', 'Alta en proteína'], ['quick', '< 30 min'], ['light', '< 500 kcal'], ['fav', '★ Favoritas']];
  const catsHost = el('div'), listHost = el('div');
  const markChips = () => [...chips.children].forEach((c, i) => { c.classList.toggle('on', st[defs[i][0]]); c.setAttribute('aria-pressed', String(st[defs[i][0]])); });
  defs.forEach(([k, label]) => chips.append(el('button', { class: 'chip', type: 'button', on: { click: () => { st[k] = !st[k]; st.shown = PAGE; markChips(); draw(); } } }, label)));
  search.addEventListener('input', () => { st.query = search.value; st.shown = PAGE; draw(); });
  root.append(el('div', { class: 'search' }, icon('buscar'), search), chips, catsHost, listHost);
  markChips();

  function draw() {
    clear(catsHost); clear(listHost);
    const browsing = !st.cat && !st.query && !st.protein && !st.quick && !st.light && !st.fav;
    if (browsing) {
      catsHost.append(el('div', { class: 'cat-grid' }, rd.categories.map((c) => el('button', { class: 'cat-btn', type: 'button', on: { click: () => { st.cat = c.id; st.shown = PAGE; draw(); window.scrollTo(0, 0); } } }, c.name, el('span', { text: `${c.count} recetas` })))));
      return;
    }
    const cname = rd.categories.find((c) => c.id === st.cat)?.name;
    if (st.cat) catsHost.append(el('div', { class: 'row between' }, el('h2', { text: cname || 'Categoría' }), el('button', { class: 'link', type: 'button', on: { click: () => { st.cat = null; draw(); } } }, '‹ Categorías')));
    const rows = filtered(rd), fv = favs();
    listHost.append(el('p', { class: 'muted small', 'aria-live': 'polite', text: `${rows.length} receta${rows.length === 1 ? '' : 's'}` }));
    const ul = el('ul', { class: 'list' });
    rows.slice(0, st.shown).forEach((r) => {
      const star = el('button', { class: 'fav', type: 'button', 'aria-label': fv.has(r.id) ? `Quitar ${r.name} de favoritas` : `Marcar ${r.name} como favorita`, 'aria-pressed': String(fv.has(r.id)), text: fv.has(r.id) ? '★' : '☆' });
      star.addEventListener('click', () => { const s = favs(); if (s.has(r.id)) s.delete(r.id); else s.add(r.id); saveFavs(s); if (st.fav) draw(); else { const on = s.has(r.id); star.textContent = on ? '★' : '☆'; star.setAttribute('aria-pressed', String(on)); } });
      ul.append(el('li', { class: 'list-item' }, el('button', { class: 'pick nb', type: 'button', on: { click: () => openRecipe(ctx, rd, r) } }, el('span', { class: 'grow' }, el('strong', { text: r.name }),
        el('span', { class: 'muted small block', text: `${r.time_min} min · ${fmtNum(r.per_serving.kcal)} kcal · P ${fmtNum(r.per_serving.p, 1)} g` }))), star));
    });
    if (!rows.length) ul.append(el('li', { class: 'muted pad', text: 'Sin resultados.' }));
    listHost.append(ul);
    if (rows.length > st.shown) listHost.append(el('button', { class: 'btn block', type: 'button', on: { click: () => { st.shown += PAGE; draw(); } } }, `Mostrar más (${rows.length - st.shown})`));
  }
  draw();
}

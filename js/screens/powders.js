// Proteína en polvo (marcas): lista por marca, detalle con etiqueta, "Mi proteína" y +1 scoop.
import { el, clear, icon, toast, fmtNum, openModal } from '../ui.js';
import { loadPowders } from '../data.js';
import { normalize } from '../search.js';
import { safeHttpsUrl } from '../technique.js';
import { powderProteinPct, entryFromPowder, validateCustomPowder, MAX_CUSTOM_POWDERS } from '../nutrition.js';
import { newId } from '../api.js';
import { openLogEntry } from './logentry.js';

// Catálogo + proteínas personalizadas del usuario
export async function allPowders(ctx) {
  const { powders } = await loadPowders();
  const custom = (Array.isArray(ctx.profile?.custom_powders) ? ctx.profile.custom_powders : []).map((x) => ({ ...x, type: 'personalizada', custom: true, fiber: x.fiber ?? null, sugar: x.sugar ?? null }));
  return [...custom, ...powders];
}
export const powderTitle = (x) => `${x.brand} ${x.product}`;
const perScoop = (x) => `P ${fmtNum(x.p, 1)} g · ${fmtNum(x.kcal)} kcal · ${fmtNum(x.serving_g, 1)} g`;
const haystack = (x) => normalize([x.brand, x.product, x.flavor, x.type, ...(x.keywords || [])].join(' '));
export const matchPowder = (x, q) => { const t = normalize(q).split(' ').filter(Boolean); if (!t.length) return true; const h = haystack(x); return t.every((w) => h.includes(w)); };

export async function favoritePowder(ctx) {
  const id = ctx.profile?.favorite_powder; if (!id) return null;
  return (await allPowders(ctx)).find((x) => x.id === id) || null;
}

export async function setFavorite(ctx, id) {
  ctx.profile = { ...ctx.profile, favorite_powder: id };
  try { await ctx.api.saveProfile(ctx.profile); } catch { toast('No se pudo guardar tu favorita', 'bad'); }
}

// +1 scoop de "Mi proteína" directo a una comida
export async function quickAddScoop(ctx, powder, date, slot, onDone) {
  try {
    await ctx.api.saveFoodLog(entryFromPowder(powder, 1, { id: newId(), logged_on: date, meal_slot: slot }));
    await ctx.refreshFood(); toast(`+1 scoop de ${powder.product}`); onDone?.();
  } catch { toast('No se pudo agregar', 'bad'); }
}

export function openPowder(ctx, x, { date, slot, onChange } = {}) {
  const fav = ctx.profile?.favorite_powder === x.id;
  const src = x.source ? safeHttpsUrl(x.source) : null;
  const row = (l, v) => el('li', { class: 'row between' }, el('span', { text: l }), el('strong', { text: v }));
  const favBtn = el('button', { class: 'btn block', type: 'button' }, fav ? '★ Quitar de “Mi proteína”' : '☆ Marcar como “Mi proteína”');
  favBtn.addEventListener('click', async () => { await setFavorite(ctx, fav ? null : x.id); m.close(); onChange?.(); });
  const body = el('div', {},
    el('p', { class: 'muted small', text: `${x.flavor || 'Sin sabor especificado'} · ${x.type || ''}` }),
    el('ul', { class: 'list label-list' },
      row(`Porción (1 scoop)`, `${fmtNum(x.serving_g, 1)} g`), row('Calorías', `${fmtNum(x.kcal)} kcal`), row('Proteína', `${fmtNum(x.p, 1)} g (${powderProteinPct(x)} % del scoop)`),
      row('Carbohidratos', `${fmtNum(x.c, 1)} g`), row('Grasa', `${fmtNum(x.f, 1)} g`), row('Fibra', x.fiber == null ? '—' : `${fmtNum(x.fiber, 1)} g`), row('Azúcares', x.sugar == null ? '—' : `${fmtNum(x.sugar, 1)} g`)),
    el('p', { class: 'muted small', text: x.custom ? 'Valores capturados por ti desde tu etiqueta.' : `Valores de la etiqueta de EE. UU.; el empaque en México puede variar ligeramente. Pueden variar por sabor.${x.verified === false ? ' Dato sin verificar.' : ''}` }),
    src ? el('a', { class: 'btn block', href: src, target: '_blank', rel: 'noopener noreferrer' }, 'Ver fuente') : null,
    el('button', { class: 'btn primary block big', type: 'button', on: { click: () => openLogEntry(ctx, { kind: 'powder', item: x, date, slot, onSaved: () => { m.close(); onChange?.(); } }) } }, 'Agregar a comida'),
    favBtn,
    x.custom ? el('button', { class: 'btn danger block', type: 'button', on: { click: async () => { ctx.profile = { ...ctx.profile, custom_powders: (ctx.profile.custom_powders || []).filter((c) => c.id !== x.id), favorite_powder: fav ? null : ctx.profile.favorite_powder }; try { await ctx.api.saveProfile(ctx.profile); } catch { toast('No se pudo eliminar', 'bad'); } m.close(); onChange?.(); } } }, 'Eliminar mi proteína') : null);
  const m = openModal(powderTitle(x), body, { wide: true });
}

export async function renderPowders(ctx, host, onChange) {
  const powders = await allPowders(ctx);
  let q = '';
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar marca, producto o sabor…', 'aria-label': 'Buscar proteína en polvo', maxlength: 60, autocomplete: 'off' });
  const favHost = el('div'), list = el('div');
  const favId = ctx.profile?.favorite_powder;
  const item = (x) => el('li', {}, el('button', { class: 'pick', type: 'button', on: { click: () => openPowder(ctx, x, { onChange }) } },
    el('span', { class: 'grow' }, el('strong', { text: `${x.product}${x.id === favId ? ' ★' : ''}` }),
      el('span', { class: 'muted small block', text: `${x.flavor || ''}${x.flavor ? ' · ' : ''}${perScoop(x)}` }),
      el('span', { class: 'muted small block', text: `${powderProteinPct(x)} % proteína` })),
    x.type ? el('span', { class: `badge${x.custom ? ' st-gray' : ''}`, text: x.custom ? 'personalizada' : x.type }) : null));
  function fill() {
    clear(favHost); clear(list);
    const fav = powders.find((x) => x.id === favId);
    if (fav && matchPowder(fav, q)) favHost.append(el('div', { class: 'fav-card' }, el('p', { class: 'eyebrow', text: 'Mi proteína' }), el('ul', { class: 'list' }, item(fav))));
    const rows = powders.filter((x) => matchPowder(x, q));
    if (!rows.length) { list.append(el('p', { class: 'muted pad', text: powders.length ? 'Sin resultados.' : 'El catálogo de proteínas en polvo aún no está disponible.' })); return; }
    const brands = [...new Set(rows.map((x) => x.brand))].sort((a, b) => a.localeCompare(b, 'es'));
    for (const b of brands) list.append(el('h3', { class: 'sub', text: b }), el('ul', { class: 'list' }, rows.filter((x) => x.brand === b).sort((a, c) => a.product.localeCompare(c.product, 'es')).map(item)));
  }
  search.addEventListener('input', () => { q = search.value; fill(); });
  const addBtn = el('button', { class: 'btn block', type: 'button', on: { click: () => openCustomForm(ctx, onChange) } }, '+ Agregar mi proteína');
  host.append(el('div', { class: 'search' }, icon('buscar'), search), addBtn, favHost, list);
  fill();
}

function openCustomForm(ctx, onChange) {
  const list = Array.isArray(ctx.profile?.custom_powders) ? ctx.profile.custom_powders : [];
  if (list.length >= MAX_CUSTOM_POWDERS) { toast(`Máximo ${MAX_CUSTOM_POWDERS} proteínas personalizadas.`, 'bad'); return; }
  const fields = [['brand', 'Marca', 'text'], ['product', 'Producto', 'text'], ['serving_g', 'Gramos por scoop', 'decimal'], ['kcal', 'Calorías por scoop', 'decimal'], ['p', 'Proteína (g)', 'decimal'], ['c', 'Carbohidratos (g)', 'decimal'], ['f', 'Grasa (g)', 'decimal']];
  const inputs = {}, errs = {};
  const rows = fields.map(([k, label, mode]) => {
    inputs[k] = el('input', { class: 'input', type: 'text', inputmode: mode === 'text' ? 'text' : 'decimal', maxlength: mode === 'text' ? 60 : 7, autocomplete: 'off', 'aria-label': label });
    errs[k] = el('span', { class: 'field-err', role: 'alert' });
    return el('label', { class: 'field' }, el('span', { text: label }), inputs[k], errs[k]);
  });
  const save = el('button', { class: 'btn primary block big', type: 'button' }, 'Guardar mi proteína');
  save.addEventListener('click', async () => {
    const v = validateCustomPowder(Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value])));
    for (const k of Object.keys(errs)) errs[k].textContent = v.errors[k] || '';
    if (!v.ok) return;
    save.disabled = true;
    const id = `custom_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`;
    ctx.profile = { ...ctx.profile, custom_powders: [...list, { id, ...v.value, serving_name: '1 scoop' }] };
    try { await ctx.api.saveProfile(ctx.profile); toast('Proteína guardada'); m.close(); onChange?.(); }
    catch { toast('No se pudo guardar', 'bad'); save.disabled = false; }
  });
  const m = openModal('Agregar mi proteína', el('div', {}, el('p', { class: 'muted small', text: 'Captura los valores por scoop de tu etiqueta.' }), rows, save));
}

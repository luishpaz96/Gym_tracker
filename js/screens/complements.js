// Complementos (tortillas, panes, arroz…): filas con cantidad en piezas, chips rápidos por comida y acompañamiento de recetas.
import { el, toast, fmtNum } from '../ui.js';
import { newId } from '../api.js';
import { normalize } from '../search.js';
import { groupComplements, topComplements, complementEntry, complementMacros, chipLabel, complementsOf } from '../nutrition.js';

const clampQty = (v, min, max = 50) => Math.min(max, Math.max(min, Math.round(v * 2) / 2));
const unitName = (f) => f.unit?.name || 'porción';

// Contador − n + con pasos de 0.5
export function pieceStepper(initial, { min = 0.5, onChange, label = 'Cantidad' } = {}) {
  let v = initial;
  const out = el('span', { class: 'qty-val', 'aria-live': 'polite', text: String(v) });
  const set = (n) => { v = clampQty(n, min); out.textContent = String(v); onChange?.(v); };
  const node = el('div', { class: 'qty', role: 'group', 'aria-label': label },
    el('button', { class: 'step-btn', type: 'button', 'aria-label': `Menos ${label}`, on: { click: () => set(v - 0.5) } }, '−'), out,
    el('button', { class: 'step-btn', type: 'button', 'aria-label': `Más ${label}`, on: { click: () => set(v + 0.5) } }, '+'));
  return { node, get: () => v, set };
}

// Filas agrupadas con cantidad y "Agregar" (uso en el selector de Comida)
export function renderComplementRows(ctx, list, foods, { query = '', date, slot, onSaved }) {
  const q = normalize(query).split(' ').filter(Boolean);
  const match = (f) => !q.length || q.every((t) => normalize(`${f.name} ${(f.keywords || []).join(' ')}`).includes(t));
  const groups = groupComplements(foods).map((g) => ({ ...g, items: g.items.filter(match) })).filter((g) => g.items.length);
  if (!groups.length) { list.append(el('li', { class: 'muted pad', text: 'Sin resultados.' })); return; }
  for (const g of groups) {
    list.append(el('li', {}, el('h3', { class: 'sub', text: g.group })));
    for (const f of g.items) {
      const mac = el('span', { class: 'muted small block' });
      const upd = (n) => { const m = complementMacros(f, n); mac.textContent = `${fmtNum(m.kcal)} kcal · P ${fmtNum(m.p, 1)} · C ${fmtNum(m.c, 1)} g (${fmtNum(n, 1)} ${unitName(f)})`; };
      const st = pieceStepper(1, { onChange: upd, label: f.name });
      upd(1);
      const add = el('button', { class: 'btn small primary', type: 'button', 'aria-label': `Agregar ${f.name}` }, 'Agregar');
      add.addEventListener('click', async () => {
        add.disabled = true;
        try { await ctx.api.saveFoodLog(complementEntry(f, st.get(), { id: newId(), logged_on: date, meal_slot: slot })); await ctx.refreshFood(); toast(`Agregado: ${fmtNum(st.get(), 1)} × ${f.name}`); onSaved?.(); }
        catch { toast('No se pudo agregar', 'bad'); }
        add.disabled = false;
      });
      list.append(el('li', { class: 'comp-row' }, el('div', { class: 'grow' }, el('strong', { text: f.name }), mac), el('div', { class: 'comp-act' }, st.node, add)));
    }
  }
}

// Chips rápidos en la tarjeta de comida: un toque agrega 1 pieza; mantener presionado (o ⋯) cambia la cantidad
export function quickChips(ctx, foods, { date, slot, onSaved, onMore, onHold }) {
  const tops = topComplements(ctx.foodLogs, foods, 3);
  if (!tops.length) return null;
  const row = el('div', { class: 'chips quick', role: 'group', 'aria-label': 'Complementos rápidos' });
  for (const f of tops) {
    let timer = null, held = false;
    const b = el('button', { class: 'chip', type: 'button', 'aria-label': `${chipLabel(f)} a esta comida. Mantén presionado para cambiar la cantidad` }, chipLabel(f));
    const start = () => { held = false; timer = setTimeout(() => { held = true; onHold?.(f); }, 550); };
    const stop = () => clearTimeout(timer);
    b.addEventListener('pointerdown', start); b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('click', async () => {
      if (held) { held = false; return; }
      b.disabled = true;
      try { await ctx.api.saveFoodLog(complementEntry(f, 1, { id: newId(), logged_on: date, meal_slot: slot })); await ctx.refreshFood(); toast(`${chipLabel(f)} agregado`); onSaved?.(); }
      catch { toast('No se pudo agregar', 'bad'); b.disabled = false; }
    });
    row.append(b);
  }
  row.append(el('button', { class: 'chip', type: 'button', 'aria-label': 'Más complementos y cantidades', on: { click: () => onMore?.() } }, '⋯'));
  return row;
}

// "¿Con qué lo acompañas?" para una receta: cantidades por complemento; collect() devuelve los elegidos
export function accompaniment(ctx, foods) {
  const tops = topComplements(ctx.foodLogs, foods, 4);
  const picks = new Map();
  const box = el('div', { class: 'accomp' }, el('h3', { class: 'sub', text: '¿Con qué lo acompañas? (opcional)' }));
  for (const f of tops) {
    const st = pieceStepper(0, { min: 0, label: f.name, onChange: (n) => { if (n > 0) picks.set(f.id, { food: f, pieces: n }); else picks.delete(f.id); } });
    box.append(el('div', { class: 'row between gap accomp-row' }, el('span', { class: 'grow', text: `${f.name} (${unitName(f)})` }), st.node));
  }
  return { node: box, collect: () => [...picks.values()] };
}
export { complementsOf };

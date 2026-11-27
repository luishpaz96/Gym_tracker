// Diálogo para agregar un alimento o receta a una comida (y editar la cantidad de un renglón).
import { el, toast, openModal, fmtNum } from '../ui.js';
import { newId } from '../api.js';
import { mealPlanOf, macrosForFood, macrosForRecipe, entryFromFood, entryFromRecipe, rescaleEntry } from '../nutrition.js';
import { today } from '../stats.js';

const num = (v) => Number(String(v).replace(',', '.'));
const macroLine = (m) => `${fmtNum(m.kcal)} kcal · P ${fmtNum(m.p, 1)} g · C ${fmtNum(m.c, 1)} g · G ${fmtNum(m.f, 1)} g`;

// kind: 'recipe' | 'food'. Con date/slot fijos se omiten esos selectores.
export function openLogEntry(ctx, { kind, item, date, slot, defaultDate, onSaved }) {
  const plan = mealPlanOf(ctx.profile);
  const dateIn = el('input', { class: 'input', type: 'date', value: date || defaultDate || today(), max: '2100-01-01', min: '2000-01-01', 'aria-label': 'Fecha' });
  const slotIn = el('select', { class: 'input', 'aria-label': 'Comida' }, plan.map((m) => el('option', { value: String(m.slot), text: `${m.name} (${m.time})` })));
  slotIn.value = String(slot || plan[Math.min(plan.length - 1, 0)].slot);
  const qty = el('input', { class: 'input', type: 'text', inputmode: 'decimal', 'aria-label': kind === 'recipe' ? 'Porciones' : 'Gramos', maxlength: 7, autocomplete: 'off' });
  const unitIn = kind === 'food' && item.unit ? el('input', { class: 'input', type: 'text', inputmode: 'decimal', 'aria-label': `Cantidad en ${item.unit.name}`, maxlength: 5, autocomplete: 'off' }) : null;
  qty.value = kind === 'recipe' ? '1' : String(item.unit ? item.unit.g : 100);
  if (unitIn) unitIn.value = '1';
  const preview = el('p', { class: 'macro-line', 'aria-live': 'polite' });
  const err = el('p', { class: 'field-err', role: 'alert' });
  const amount = () => num(qty.value);
  const valid = () => (kind === 'recipe' ? amount() > 0 && amount() <= 100 : amount() > 0 && amount() <= 10000);
  const refresh = () => { preview.textContent = valid() ? macroLine(kind === 'recipe' ? macrosForRecipe(item, amount()) : macrosForFood(item, amount())) : ''; };
  qty.addEventListener('input', () => { if (unitIn) { const c = amount() / item.unit.g; unitIn.value = Number.isFinite(c) ? String(Math.round(c * 100) / 100) : ''; } refresh(); });
  if (unitIn) unitIn.addEventListener('input', () => { const g = Math.round(num(unitIn.value) * item.unit.g * 10) / 10; qty.value = Number.isFinite(g) ? String(g) : ''; refresh(); });
  const add = el('button', { class: 'btn primary block big', type: 'button' }, 'Agregar a comida');
  add.addEventListener('click', async () => {
    if (!valid()) { err.textContent = kind === 'recipe' ? 'Porciones entre 0 y 100.' : 'Gramos entre 0 y 10 000.'; return; }
    if (!dateIn.value) { err.textContent = 'Elige una fecha.'; return; }
    add.disabled = true;
    const base = { id: newId(), logged_on: dateIn.value, meal_slot: Number(slotIn.value) };
    const entry = kind === 'recipe' ? entryFromRecipe(item, amount(), base) : entryFromFood(item, amount(), base);
    try { await ctx.api.saveFoodLog(entry); await ctx.refreshFood(); toast(`Agregado a ${plan[entry.meal_slot - 1]?.name || 'comida'}`); m.close(); onSaved?.(entry); }
    catch (e) { console.warn(e?.message); err.textContent = 'No se pudo guardar. Intenta de nuevo.'; add.disabled = false; }
  });
  const body = el('div', {},
    el('p', { class: 'muted small', text: kind === 'recipe' ? `Por porción: ${macroLine(item.per_serving)}` : `Por 100 g: ${macroLine(item)}` }),
    date ? null : el('label', { class: 'field' }, el('span', { text: 'Fecha' }), dateIn),
    slot ? null : el('label', { class: 'field' }, el('span', { text: 'Comida' }), slotIn),
    el('label', { class: 'field' }, el('span', { text: kind === 'recipe' ? 'Porciones (acepta decimales)' : 'Gramos' }), qty),
    unitIn ? el('label', { class: 'field' }, el('span', { text: `o en ${item.unit.name} (${item.unit.g} g c/u)` }), unitIn) : null,
    preview, err, add);
  const m = openModal(item.name, body);
  refresh();
  return m;
}

// Editar la cantidad de un renglón ya registrado (usa su propio snapshot).
export function openEditEntry(ctx, entry, onSaved) {
  const isRecipe = entry.source === 'recipe';
  const cur = isRecipe ? entry.servings : entry.grams;
  const qty = el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: String(cur), maxlength: 7, 'aria-label': isRecipe ? 'Porciones' : 'Gramos' });
  const err = el('p', { class: 'field-err', role: 'alert' });
  const ok = el('button', { class: 'btn primary block', type: 'button' }, 'Guardar');
  ok.addEventListener('click', async () => {
    const v = num(qty.value);
    if (!(v > 0) || v > (isRecipe ? 100 : 10000)) { err.textContent = 'Cantidad fuera de rango.'; return; }
    ok.disabled = true;
    try { await ctx.api.saveFoodLog(rescaleEntry(entry, v / cur)); await ctx.refreshFood(); m.close(); onSaved?.(); }
    catch { err.textContent = 'No se pudo guardar.'; ok.disabled = false; }
  });
  const m = openModal(entry.label || entry.ref_id, el('div', {}, el('label', { class: 'field' }, el('span', { text: isRecipe ? 'Porciones' : 'Gramos' }), qty), err, ok));
}

// Diálogo para agregar un alimento o receta a una comida (y editar la cantidad de un renglón).
import { el, toast, openModal, fmtNum } from '../ui.js';
import { newId } from '../api.js';
import { mealPlanOf, macrosForFood, macrosForRecipe, macrosForPowder, entryFromFood, entryFromRecipe, entryFromPowder, rescaleEntry, gramsFromScoops } from '../nutrition.js';
import { today } from '../stats.js';
import { loadFoods } from '../data.js';
import { accompaniment } from './complements.js';
import { complementEntry } from '../nutrition.js';

const num = (v) => Number(String(v).replace(',', '.'));
const macroLine = (m) => `${fmtNum(m.kcal)} kcal · P ${fmtNum(m.p, 1)} g · C ${fmtNum(m.c, 1)} g · G ${fmtNum(m.f, 1)} g`;

// kind: 'recipe' | 'food' | 'powder' (scoops). Con date/slot fijos se omiten esos selectores.
export function openLogEntry(ctx, { kind, item, date, slot, defaultDate, onSaved }) {
  const plan = mealPlanOf(ctx.profile);
  const dateIn = el('input', { class: 'input', type: 'date', value: date || defaultDate || today(), max: '2100-01-01', min: '2000-01-01', 'aria-label': 'Fecha' });
  const slotIn = el('select', { class: 'input', 'aria-label': 'Comida' }, plan.map((m) => el('option', { value: String(m.slot), text: `${m.name} (${m.time})` })));
  slotIn.value = String(slot || plan[Math.min(plan.length - 1, 0)].slot);
  const byServ = kind !== 'food';
  const qty = el('input', { class: 'input', type: 'text', inputmode: 'decimal', 'aria-label': kind === 'recipe' ? 'Porciones' : kind === 'powder' ? 'Scoops' : 'Gramos', maxlength: 7, autocomplete: 'off' });
  const unitIn = (kind === 'food' && item.unit) || kind === 'powder' ? el('input', { class: 'input', type: 'text', inputmode: 'decimal', 'aria-label': kind === 'powder' ? 'Gramos' : `Cantidad en ${item.unit.name}`, maxlength: 7, autocomplete: 'off' }) : null;
  qty.value = byServ ? '1' : String(item.unit ? item.unit.g : 100);
  if (unitIn) unitIn.value = kind === 'powder' ? String(item.serving_g) : '1';
  const preview = el('p', { class: 'macro-line', 'aria-live': 'polite' });
  const err = el('p', { class: 'field-err', role: 'alert' });
  const amount = () => num(qty.value);
  const valid = () => (byServ ? amount() > 0 && amount() <= 100 : amount() > 0 && amount() <= 10000);
  const refresh = () => { preview.textContent = valid() ? macroLine(kind === 'recipe' ? macrosForRecipe(item, amount()) : kind === 'powder' ? macrosForPowder(item, amount()) : macrosForFood(item, amount())) : ''; };
  qty.addEventListener('input', () => { if (kind === 'powder') { unitIn.value = String(gramsFromScoops(item, amount()) || ''); } else if (unitIn) { const c = amount() / item.unit.g; unitIn.value = Number.isFinite(c) ? String(Math.round(c * 100) / 100) : ''; } refresh(); });
  if (unitIn) unitIn.addEventListener('input', () => { if (kind === 'powder') { const sc = Math.round((num(unitIn.value) / item.serving_g) * 100) / 100; qty.value = Number.isFinite(sc) ? String(sc) : ''; } else { const g = Math.round(num(unitIn.value) * item.unit.g * 10) / 10; qty.value = Number.isFinite(g) ? String(g) : ''; } refresh(); });
  let accomp = null; const accompHost = el('div');
  if (kind === 'recipe') loadFoods().then(({ foods }) => { accomp = accompaniment(ctx, foods); accompHost.append(accomp.node); });
  const add = el('button', { class: 'btn primary block big', type: 'button' }, 'Agregar a comida');
  add.addEventListener('click', async () => {
    if (!valid()) { err.textContent = byServ ? 'Cantidad entre 0 y 100.' : 'Gramos entre 0 y 10 000.'; return; }
    if (!dateIn.value) { err.textContent = 'Elige una fecha.'; return; }
    add.disabled = true;
    const base = { id: newId(), logged_on: dateIn.value, meal_slot: Number(slotIn.value) };
    const entry = kind === 'recipe' ? entryFromRecipe(item, amount(), base) : kind === 'powder' ? entryFromPowder(item, amount(), base) : entryFromFood(item, amount(), base);
    try { await ctx.api.saveFoodLog(entry); for (const a of accomp?.collect() || []) await ctx.api.saveFoodLog(complementEntry(a.food, a.pieces, { id: newId(), logged_on: base.logged_on, meal_slot: base.meal_slot })); await ctx.refreshFood(); toast(`Agregado a ${plan[entry.meal_slot - 1]?.name || 'comida'}`); m.close(); onSaved?.(entry); }
    catch (e) { console.warn(e?.message); err.textContent = 'No se pudo guardar. Intenta de nuevo.'; add.disabled = false; }
  });
  const body = el('div', {},
    el('p', { class: 'muted small', text: kind === 'recipe' ? `Por porción: ${macroLine(item.per_serving)}` : kind === 'powder' ? `Por scoop (${item.serving_g} g): ${macroLine(item)}` : `Por 100 g: ${macroLine(item)}` }),
    date ? null : el('label', { class: 'field' }, el('span', { text: 'Fecha' }), dateIn),
    slot ? null : el('label', { class: 'field' }, el('span', { text: 'Comida' }), slotIn),
    el('label', { class: 'field' }, el('span', { text: kind === 'recipe' ? 'Porciones (acepta decimales)' : kind === 'powder' ? 'Scoops (pasos de 0.5)' : 'Gramos' }), qty),
    kind === 'powder' ? el('div', { class: 'row gap' }, [['− 0.5', -0.5], ['+ 0.5', 0.5]].map(([t, d]) => el('button', { class: 'btn small grow', type: 'button', on: { click: () => { qty.value = String(Math.max(0.5, Math.round((amount() || 0) * 2) / 2 + d)); qty.dispatchEvent(new Event('input')); } } }, t))) : null,
    unitIn ? el('label', { class: 'field' }, el('span', { text: kind === 'powder' ? 'o en gramos' : `o en ${item.unit.name} (${item.unit.g} g c/u)` }), unitIn) : null,
    preview, accompHost, err, add);
  const m = openModal(item.name || `${item.brand} ${item.product}`, body);
  refresh();
  return m;
}

// Editar la cantidad de un renglón ya registrado (usa su propio snapshot).
export function openEditEntry(ctx, entry, onSaved) {
  const isRecipe = entry.source !== 'food';
  const cur = isRecipe ? entry.servings : entry.grams;
  const qty = el('input', { class: 'input', type: 'text', inputmode: 'decimal', value: String(cur), maxlength: 7, 'aria-label': isRecipe ? 'Porciones / scoops' : 'Gramos' });
  const err = el('p', { class: 'field-err', role: 'alert' });
  const ok = el('button', { class: 'btn primary block', type: 'button' }, 'Guardar');
  const piecesHost = el('div');
  // Alimentos con medida casera: también se puede editar en piezas (ligadas a los gramos)
  if (!isRecipe) loadFoods().then(({ foodById }) => {
    const f = foodById?.[entry.ref_id]; if (!f?.unit?.g) return;
    const pcs = el('input', { class: 'input', type: 'text', inputmode: 'decimal', maxlength: 7, 'aria-label': `Cantidad en ${f.unit.name}` });
    const sync = () => { const c = num(qty.value) / f.unit.g; pcs.value = Number.isFinite(c) && c > 0 ? String(Math.round(c * 100) / 100) : ''; };
    sync();
    qty.addEventListener('input', sync);
    pcs.addEventListener('input', () => { const g = Math.round(num(pcs.value) * f.unit.g * 10) / 10; qty.value = Number.isFinite(g) && g > 0 ? String(g) : ''; });
    piecesHost.append(el('label', { class: 'field' }, el('span', { text: `o en ${f.unit.name} (${f.unit.g} g c/u)` }), pcs));
  });
  ok.addEventListener('click', async () => {
    const v = num(qty.value);
    if (!(v > 0) || v > (isRecipe ? 100 : 10000)) { err.textContent = 'Cantidad fuera de rango.'; return; }
    ok.disabled = true;
    try { await ctx.api.saveFoodLog(rescaleEntry(entry, v / cur)); await ctx.refreshFood(); m.close(); onSaved?.(); }
    catch { err.textContent = 'No se pudo guardar.'; ok.disabled = false; }
  });
  const m = openModal(entry.label || entry.ref_id, el('div', {}, el('label', { class: 'field' }, el('span', { text: isRecipe ? 'Porciones' : 'Gramos' }), qty), piecesHost, err, ok));
}

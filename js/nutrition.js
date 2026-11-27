// Nutrición: metas diarias, reparto por comida, totales de registro, adherencia y consejos (funciones puras).
import { addDays, round } from './calc.js';

export const ACTIVITY = { 2: 1.375, 3: 1.45, 4: 1.5, 5: 1.6, 6: 1.7 };

export function bmr({ sex, weight_kg, height_cm, age }) {
  return 10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === 'F' ? -161 : 5);
}

// goal: 'gain' | 'lose' | 'recomp'
export function computeTargets({ sex, weight_kg, height_cm, age, days_per_week }, goal) {
  const b = bmr({ sex, weight_kg, height_cm, age });
  const factor = ACTIVITY[Math.min(6, Math.max(2, Math.round(days_per_week) || 3))];
  const tdee = b * factor;
  let kcal = tdee;
  if (goal === 'gain') kcal = tdee + Math.min(tdee * 0.1, 300);
  else if (goal === 'lose') kcal = Math.max(tdee * 0.8, b * 1.1);
  const p = (goal === 'lose' ? 2.2 : 2.0) * weight_kg;
  const f = Math.max(0.9 * weight_kg, (0.2 * kcal) / 9);
  const c = Math.max(0, (kcal - 4 * p - 9 * f) / 4);
  return { kcal: Math.round(kcal), p: Math.round(p), c: Math.round(c), f: Math.round(f), fiber: Math.round((14 * Math.round(kcal)) / 1000),
    bmr: Math.round(b), tdee: Math.round(tdee), factor, goal };
}

export const MEAL_DEFAULTS = {
  3: { names: ['Desayuno', 'Comida', 'Cena'], times: ['08:00', '14:00', '20:00'], shares: [0.3, 0.4, 0.3] },
  4: { names: ['Desayuno', 'Colación', 'Comida', 'Cena'], times: ['08:00', '11:30', '14:30', '20:00'], shares: [0.25, 0.15, 0.35, 0.25] },
  5: { names: ['Desayuno', 'Colación', 'Comida', 'Colación', 'Cena'], times: ['08:00', '11:00', '14:00', '17:00', '20:00'], shares: [0.22, 0.1, 0.3, 0.13, 0.25] },
  6: { names: ['Desayuno', 'Colación', 'Comida', 'Colación', 'Cena', 'Colación nocturna'], times: ['07:30', '10:30', '14:00', '17:00', '20:00', '22:00'], shares: [0.2, 0.1, 0.28, 0.12, 0.18, 0.12] },
};
export const clampMeals = (n) => Math.min(6, Math.max(3, Math.round(n) || 4));

// Plan de comidas del perfil (nombres/horas editables) con valores por defecto.
export function mealPlanOf(profile) {
  const n = clampMeals(profile?.meals_per_day || 4);
  const d = MEAL_DEFAULTS[n];
  const saved = Array.isArray(profile?.meal_plan) ? profile.meal_plan : [];
  return Array.from({ length: n }, (_, i) => ({
    slot: i + 1,
    name: String(saved[i]?.name || d.names[i]).slice(0, 30),
    time: /^\d{2}:\d{2}$/.test(saved[i]?.time || '') ? saved[i].time : d.times[i],
    share: d.shares[i],
  }));
}
export function splitMeals(targets, plan) {
  return plan.map((m) => ({ ...m, kcal: Math.round(targets.kcal * m.share), p: Math.round(targets.p * m.share) }));
}

// ---- Macros de un alimento / receta ----
export const unitGrams = (food, count) => (food.unit ? round(food.unit.g * count, 1) : null);
export function macrosForFood(food, grams) {
  const k = grams / 100;
  return { kcal: round(food.kcal * k, 1), p: round(food.p * k, 1), c: round(food.c * k, 1), f: round(food.f * k, 1), fiber: round((food.fiber || 0) * k, 1) };
}
export function macrosForRecipe(recipe, servings) {
  const s = recipe.per_serving;
  return { kcal: round(s.kcal * servings, 1), p: round(s.p * servings, 1), c: round(s.c * servings, 1), f: round(s.f * servings, 1), fiber: round((s.fiber || 0) * servings, 1) };
}
export function entryFromFood(food, grams, { id, logged_on, meal_slot }) {
  return { id, logged_on, meal_slot, source: 'food', ref_id: food.id, label: food.name.slice(0, 80), servings: null, grams: round(grams, 1), ...macrosForFood(food, grams) };
}
export function entryFromRecipe(recipe, servings, { id, logged_on, meal_slot }) {
  return { id, logged_on, meal_slot, source: 'recipe', ref_id: recipe.id, label: recipe.name.slice(0, 80), servings: round(servings, 2), grams: null, ...macrosForRecipe(recipe, servings) };
}
// Recalcula un renglón con otra cantidad a partir de su propio snapshot (sin necesitar el catálogo).
export function rescaleEntry(entry, factor) {
  const r = (v) => round(v * factor, 1);
  return { ...entry, kcal: r(entry.kcal), p: r(entry.p), c: r(entry.c), f: r(entry.f), fiber: r(entry.fiber),
    servings: entry.servings == null ? null : round(entry.servings * factor, 2), grams: entry.grams == null ? null : round(entry.grams * factor, 1) };
}

// ---- Proteína en polvo: valores por scoop (serving_g gramos) ----
export const scoopsFromGrams = (powder, grams) => round(grams / powder.serving_g, 2);
export const gramsFromScoops = (powder, scoops) => round(scoops * powder.serving_g, 1);
export const powderProteinPct = (powder) => round((powder.p / powder.serving_g) * 100, 0);
export function macrosForPowder(powder, scoops) {
  const r = (v) => round((Number(v) || 0) * scoops, 1);
  return { kcal: r(powder.kcal), p: r(powder.p), c: r(powder.c), f: r(powder.f), fiber: r(powder.fiber) };
}
export function entryFromPowder(powder, scoops, { id, logged_on, meal_slot }) {
  return { id, logged_on, meal_slot, source: 'powder', ref_id: powder.id, label: `${powder.brand} ${powder.product}`.slice(0, 80), servings: round(scoops, 2), grams: gramsFromScoops(powder, scoops), ...macrosForPowder(powder, scoops) };
}

// Validación de una proteína en polvo personalizada (valores por scoop de la etiqueta)
export const MAX_CUSTOM_POWDERS = 10;
export function validateCustomPowder(f) {
  const n = (v) => (v === '' || v === null || v === undefined ? NaN : Number(String(v).replace(',', '.')));
  const errors = {};
  const brand = String(f.brand || '').trim(), product = String(f.product || '').trim();
  const serving = n(f.serving_g), kcal = n(f.kcal), p = n(f.p), c = n(f.c), fat = n(f.f);
  if (!brand || brand.length > 40) errors.brand = 'Marca de 1 a 40 caracteres.';
  if (!product || product.length > 60) errors.product = 'Producto de 1 a 60 caracteres.';
  if (!(serving >= 5 && serving <= 100)) errors.serving_g = 'El scoop pesa entre 5 y 100 g.';
  if (!(kcal >= 0 && kcal <= 1000)) errors.kcal = 'Calorías entre 0 y 1000.';
  for (const [k, v] of [['p', p], ['c', c], ['f', fat]]) if (!(v >= 0 && v <= 100)) errors[k] = 'Entre 0 y 100 g.';
  if (!errors.serving_g && !errors.p && !errors.c && !errors.f && p + c + fat > serving * 1.05) errors.p = 'Los macros no pueden pesar más que el scoop.';
  const r1 = (x) => Math.round(x * 10) / 10;
  return { ok: !Object.keys(errors).length, errors, value: { brand, product, serving_g: r1(serving), kcal: Math.round(kcal), p: r1(p), c: r1(c), f: r1(fat) } };
}

export const ZERO = { kcal: 0, p: 0, c: 0, f: 0, fiber: 0 };
export function sumEntries(entries) {
  const t = { ...ZERO };
  for (const e of entries) for (const k of Object.keys(ZERO)) t[k] += Number(e[k]) || 0;
  for (const k of Object.keys(t)) t[k] = round(t[k], 1);
  return t;
}
export const dayEntries = (logs, date) => logs.filter((e) => e.logged_on === date);
export const mealEntries = (logs, date, slot) => logs.filter((e) => e.logged_on === date && e.meal_slot === slot);
export const dayTotals = (logs, date) => sumEntries(dayEntries(logs, date));

// ---- Adherencia: kcal dentro de ±10 % y proteína ≥ 90 % de la meta ----
export const dayAdheres = (tot, targets) => tot.kcal >= targets.kcal * 0.9 && tot.kcal <= targets.kcal * 1.1 && tot.p >= targets.p * 0.9;
export function windowDays(today, n = 14) { return Array.from({ length: n }, (_, i) => addDays(today, -(n - 1 - i))); }
export function adherence(logs, targets, today, n = 14) {
  const days = windowDays(today, n).map((date) => ({ date, tot: dayTotals(logs, date), logged: dayEntries(logs, date).length > 0 }));
  const logged = days.filter((d) => d.logged);
  const ok = logged.filter((d) => dayAdheres(d.tot, targets));
  const meals = new Set(logs.filter((e) => e.logged_on >= days[0].date && e.logged_on <= today).map((e) => `${e.logged_on}#${e.meal_slot}`)).size;
  return { days, loggedDays: logged.length, okDays: ok.length, pct: logged.length ? Math.round((ok.length / logged.length) * 100) : null, mealsLogged: meals };
}

// ---- Consejos de nutrición ----
// goal: 'gain'|'lose'|'recomp'; weightPct: cambio % semanal del peso (o null)
export function nutritionTips({ logs, targets, today, goal, weightPct = null }) {
  const tips = [];
  const days = windowDays(today, 7).map((date) => ({ date, tot: dayTotals(logs, date), logged: dayEntries(logs, date).length > 0 })).filter((d) => d.logged);
  if (!days.length) return [{ kind: 'food', text: 'Registra lo que comes en Comida para recibir consejos de nutrición.' }];
  const low = days.filter((d) => d.tot.p < targets.p * 0.9).length;
  if (low >= 2) tips.push({ kind: 'food', text: `Proteína baja en ${low} de ${days.length} días registrados (meta ${targets.p} g). Suma pollo, huevo, atún, yogur griego o whey en cada comida.` });
  const avg = days.reduce((a, d) => a + d.tot.kcal, 0) / days.length;
  const diff = (avg - targets.kcal) / targets.kcal;
  if (diff > 0.1) tips.push({ kind: 'food', text: `Promedias ${Math.round(avg)} kcal, ${Math.round(diff * 100)} % sobre tu meta de ${targets.kcal}.${goal === 'lose' ? ' Con tu meta de bajar, recorta porciones de grasas y carbohidratos.' : ''}` });
  else if (diff < -0.1) tips.push({ kind: 'food', text: `Promedias ${Math.round(avg)} kcal, ${Math.round(-diff * 100)} % bajo tu meta de ${targets.kcal}.${goal === 'gain' ? ' Si quieres subir de peso necesitas comer más.' : ''}` });
  if (weightPct !== null && Math.abs(diff) <= 0.1) {
    if (goal === 'lose' && weightPct >= 0) tips.push({ kind: 'food', text: 'Comes en tu meta pero el peso no baja: verifica porciones (pesa en crudo) y suma ~2 000 pasos diarios.' });
    if (goal === 'gain' && weightPct <= 0) tips.push({ kind: 'food', text: 'Comes en tu meta pero el peso no sube: agrega ~150 kcal (por ejemplo una colación).' });
  }
  if (!tips.length) tips.push({ kind: 'food', text: `Buen trabajo: tu ingesta de la semana está dentro de tu meta (${targets.kcal} kcal, ${targets.p} g de proteína).` });
  return tips.slice(0, 2);
}

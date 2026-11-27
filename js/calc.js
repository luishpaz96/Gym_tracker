// Funciones puras de cálculo: volumen, 1RM estimado (Epley), series efectivas por músculo y fechas.

const num = (v) => (Number.isFinite(+v) ? +v : 0);
export const round = (n, d = 1) => { const f = 10 ** d; return Math.round((n + Number.EPSILON) * f) / f; };

export { KG_PER_LB, toDisplay, fromDisplay } from './units.js';
import { KG_PER_LB } from './units.js';
export const kgToLb = (kg) => num(kg) / KG_PER_LB;
export const lbToKg = (lb) => num(lb) * KG_PER_LB;

// ---- Volumen ----
export const MAX_DROPS = 6;
// Drops de una serie: [{weight_kg, reps, unit}] (solo los que tienen repeticiones)
export const setDrops = (s) => (Array.isArray(s?.drops) ? s.drops.filter((d) => num(d.reps) > 0) : []);
// Volumen de la serie: serie principal + cada drop (peso × reps)
export const setVolume = (s) => num(s.weight_kg) * num(s.reps) + setDrops(s).reduce((a, d) => a + num(d.weight_kg) * num(d.reps), 0);
// Serie efectiva: 1 por la serie, +0.5 por cada drop con un máximo de +1
export const effectiveSetCount = (s) => (num(s.reps) > 0 ? 1 + Math.min(1, 0.5 * setDrops(s).length) : 0);
// Texto: "60 kg × 8 → drop 45 kg × 8 → 35 kg × 6" (display = función de conversión kg→unidad)
export function describeSet(s, unit, disp) {
  const one = (x) => `${disp(x.weight_kg, unit)} ${unit} × ${x.reps}`;
  const d = setDrops(s);
  return [one(s), ...d.map((x, i) => (i === 0 ? 'drop ' : '') + one(x))].join(' → ');
}
// Sugerencia del siguiente drop: ~22 % menos, redondeado a 2.5 kg / 5 lb (display = peso en la unidad mostrada)
export const suggestDrop = (prevDisplay, unit) => {
  const step = unit === 'lb' ? 5 : 2.5, v = num(prevDisplay) * 0.78;
  return v > 0 ? Math.max(step, Math.round(v / step) * step) : 0;
};
export function validateDrops(drops) {
  if (drops === undefined || drops === null) return null;
  if (!Array.isArray(drops) || drops.length > MAX_DROPS) return `Máximo ${MAX_DROPS} drops por serie.`;
  for (const d of drops) {
    const w = +d.weight_kg, r = +d.reps;
    if (!Number.isFinite(w) || w < 0 || w > 1000) return 'Peso del drop fuera de rango (0–1000 kg).';
    if (!Number.isInteger(r) || r < 0 || r > 1000) return 'Repeticiones del drop fuera de rango (0–1000).';
    if (d.unit !== undefined && d.unit !== 'kg' && d.unit !== 'lb') return 'Unidad del drop inválida.';
  }
  return null;
}
export const exerciseVolume = (ex) => (ex.sets || []).reduce((a, s) => a + setVolume(s), 0);
export const workoutVolume = (w) => (w.exercises || []).reduce((a, ex) => a + exerciseVolume(ex), 0);

// ---- 1RM estimado (Epley): w * (1 + reps/30); con 1 rep es el propio peso ----
export function epley(weight, reps) {
  const w = num(weight), r = num(reps);
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}
export const bestE1RM = (sets) => (sets || []).reduce((m, s) => Math.max(m, epley(s.weight_kg, s.reps)), 0);

// ---- Fechas (YYYY-MM-DD, calculadas en UTC para evitar problemas de zona horaria) ----
const toUTC = (str) => { const [y, m, d] = str.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (str, n) => fromUTC(toUTC(str) + n * 86400000);
export const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 86400000);
export const weekdayOf = (str) => new Date(toUTC(str)).getUTCDay(); // 0 = domingo
export const weekStart = (str) => addDays(str, -((weekdayOf(str) + 6) % 7)); // lunes
export function localDateStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export const isDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUTC(s));

// ---- Series efectivas por músculo: principal 1, secundario 0.5 ----
export function muscleSeries(workouts, exById, { from = '0000-00-00', to = '9999-99-99' } = {}) {
  const out = {};
  const slot = (id) => (out[id] ||= { sets: 0, exercises: {} });
  for (const w of workouts || []) {
    if (w.performed_on < from || w.performed_on > to) continue;
    for (const ex of w.exercises || []) {
      const def = exById[ex.exercise_id];
      if (!def) continue;
      const n = (ex.sets || []).reduce((a, s) => a + effectiveSetCount(s), 0);
      if (!n) continue;
      for (const m of def.primary || []) { const s = slot(m); s.sets += n; s.exercises[def.id] = (s.exercises[def.id] || 0) + n; }
      for (const m of def.secondary || []) { const s = slot(m); s.sets += n * 0.5; s.exercises[def.id] = (s.exercises[def.id] || 0) + n * 0.5; }
    }
  }
  return out;
}

// Series semanales (lunes a domingo) de un músculo: [{week:'YYYY-MM-DD', sets}] sin huecos.
export function weeklySeries(workouts, exById, muscleId, weeks = 8, today) {
  const last = weekStart(today);
  const rows = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const wk = addDays(last, -7 * i);
    const r = muscleSeries(workouts, exById, { from: wk, to: addDays(wk, 6) });
    rows.push({ week: wk, sets: round(r[muscleId]?.sets || 0, 1) });
  }
  return rows;
}

export function validateSet(s) {
  const w = +s.weight_kg, r = +s.reps;
  if (!Number.isFinite(w) || w < 0 || w > 1000) return 'Peso fuera de rango (0–1000 kg).';
  if (!Number.isInteger(r) || r < 0 || r > 1000) return 'Repeticiones fuera de rango (0–1000).';
  if (s.rir !== null && s.rir !== undefined && s.rir !== '') {
    const x = +s.rir;
    if (!Number.isInteger(x) || x < 0 || x > 10) return 'RIR debe ser un entero de 0 a 10.';
  }
  return null;
}

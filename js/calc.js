// Funciones puras de cálculo: volumen, 1RM estimado (Epley), series efectivas por músculo y fechas.

const num = (v) => (Number.isFinite(+v) ? +v : 0);
export const round = (n, d = 1) => { const f = 10 ** d; return Math.round((n + Number.EPSILON) * f) / f; };

export const KG_PER_LB = 0.45359237;
export const kgToLb = (kg) => num(kg) / KG_PER_LB;
export const lbToKg = (lb) => num(lb) * KG_PER_LB;
export const toDisplay = (kg, unit) => round(unit === 'lb' ? kgToLb(kg) : num(kg), 1);
export const fromDisplay = (v, unit) => round(unit === 'lb' ? lbToKg(v) : num(v), 2);

// ---- Volumen ----
export const setVolume = (s) => num(s.weight_kg) * num(s.reps);
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
      const n = (ex.sets || []).filter((s) => num(s.reps) > 0).length;
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

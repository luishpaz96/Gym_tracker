// Validación del perfil (puro). Los mismos rangos están en CHECK/trigger de supabase/schema.sql.
export const LIMITS = { age: [13, 100], height: [120, 230], weight: [30, 300], days: [2, 6] };

const inRange = (v, [lo, hi]) => Number.isFinite(v) && v >= lo && v <= hi;
const num = (x) => (x === '' || x === null || x === undefined ? NaN : Number(String(x).replace(',', '.')));

export function validateProfileInput(f, year = new Date().getFullYear(), { needWeight = true } = {}) {
  const errors = {};
  const age = num(f.age), height = num(f.height_cm), weight = num(f.weight_kg), goal = num(f.goal_weight_kg), days = num(f.days_per_week);
  if (!Number.isInteger(age) || !inRange(age, LIMITS.age)) errors.age = 'Edad entre 13 y 100 años.';
  if (f.sex !== 'M' && f.sex !== 'F') errors.sex = 'Elige una opción.';
  if (!inRange(height, LIMITS.height)) errors.height_cm = 'Estatura entre 120 y 230 cm.';
  if (needWeight || f.weight_kg !== '') { if (!inRange(weight, LIMITS.weight)) errors.weight_kg = 'Peso entre 30 y 300 kg.'; }
  if (!inRange(goal, LIMITS.weight)) errors.goal_weight_kg = 'Peso meta entre 30 y 300 kg.';
  if (!Number.isInteger(days) || !inRange(days, LIMITS.days)) errors.days_per_week = 'Entre 2 y 6 días.';
  const r1 = (n) => Math.round(n * 10) / 10;
  return { ok: !Object.keys(errors).length, errors,
    values: { birth_year: year - age, sex: f.sex, height_cm: r1(height), goal_weight_kg: r1(goal), days_per_week: days, weight_kg: Number.isFinite(weight) ? r1(weight) : null } };
}

export const profileComplete = (p) => Boolean(p && p.birth_year && (p.sex === 'M' || p.sex === 'F') && p.height_cm && p.goal_weight_kg && p.days_per_week);
export const ageOf = (p, year = new Date().getFullYear()) => (p?.birth_year ? year - p.birth_year : null);

// Conversión y formato de unidades de peso (puro). La base de datos siempre guarda kg.
export const KG_PER_LB = 0.45359237;
export const UNITS = ['kg', 'lb'];
export const normUnit = (u) => (u === 'lb' ? 'lb' : 'kg');

export const roundTo = (v, step) => Math.round(v / step) * step;
const clean = (n) => Math.round(n * 100) / 100;

// kg -> valor en la unidad de pantalla, redondeado a `step` (0.5 por defecto; 0.1 para peso corporal)
export function toDisplay(kg, unit, step = 0.5) {
  const v = Number(kg) || 0;
  return clean(roundTo(normUnit(unit) === 'lb' ? v / KG_PER_LB : v, step));
}
// valor tecleado en la unidad -> kg con 2 decimales (precisión completa)
export function fromDisplay(v, unit) {
  const n = Number(String(v).replace(',', '.')) || 0;
  return Math.round((normUnit(unit) === 'lb' ? n * KG_PER_LB : n) * 100) / 100;
}
// Convierte un texto tecleado de una unidad a otra ('' se queda ''; texto inválido también)
export function convertTyped(text, from, to, step = 0.5) {
  if (text === '' || text === null || text === undefined) return '';
  const n = Number(String(text).replace(',', '.'));
  if (!Number.isFinite(n)) return '';
  if (normUnit(from) === normUnit(to)) return String(text);
  return String(toDisplay(fromDisplay(n, from), to, step));
}
export const overloadStep = (unit) => (normUnit(unit) === 'lb' ? 5 : 2.5);
export const fmtWeight = (kg, unit, step = 0.5) => `${toDisplay(kg, unit, step)} ${normUnit(unit)}`;

// Unidad por defecto de un ejercicio: la de la última vez que se registró; si no hay historial, la del perfil.
export function resolveExerciseUnit(workouts, exerciseId, fallback = 'kg') {
  const ws = [...(workouts || [])].sort((a, b) => (b.performed_on === a.performed_on ? String(b.created_at || '').localeCompare(String(a.created_at || '')) : b.performed_on.localeCompare(a.performed_on)));
  for (const w of ws) {
    const ex = (w.exercises || []).find((e) => e.exercise_id === exerciseId && (e.sets || []).length);
    if (ex) return normUnit(ex.sets[0].unit || fallback);
  }
  return normUnit(fallback);
}

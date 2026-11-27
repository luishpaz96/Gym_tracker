// Lógica pura de la sesión de entrenamiento: pasos de los +/-, temporizador de descanso y conteos.

// Convierte "2–3 min", "90 s", "1:30", 120 → segundos (el punto medio de un rango). Sin dato: 90.
export function parseRest(v, fallback = 90) {
  if (typeof v === 'number' && v > 0) return Math.round(v);
  const s = String(v ?? '').toLowerCase().replace(',', '.');
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  if (!nums.length) return fallback;
  let unit = /\bmin|m\b/.test(s) ? 60 : /\bs(eg)?\b|seg/.test(s) ? 1 : (nums[0] <= 10 ? 60 : 1);
  const mid = nums.length > 1 ? (nums[0] + nums[1]) / 2 : nums[0];
  return Math.min(900, Math.max(15, Math.round(mid * unit)));
}

// +/- de peso o reps: parte del valor tecleado o, si está vacío, del valor de referencia (placeholder).
// Siempre devuelve texto sin errores de coma flotante; no baja de 0 ni sube de max.
export function stepValue(current, dir, step, { base = 0, max = 1000 } = {}) {
  const cur = current === '' || current === null || current === undefined ? Number(base) || 0 : Number(String(current).replace(',', '.'));
  const start = Number.isFinite(cur) ? cur : 0;
  const next = Math.min(max, Math.max(0, Math.round((start + dir * step) * 100) / 100));
  return String(next);
}
export const weightStep = (unit) => (unit === 'lb' ? 5 : 2.5);

// Temporizador de descanso (estado inmutable; el reloj se inyecta para poder probarlo)
export const startRest = (seconds, now) => ({ total: seconds, endsAt: now + seconds * 1000 });
export const restLeft = (r, now) => (r ? Math.max(0, Math.ceil((r.endsAt - now) / 1000)) : 0);
export const restAdd = (r, seconds, now) => {
  if (!r) return null;
  const left = Math.max(0, (r.endsAt - now) / 1000) + seconds;
  return { total: Math.max(r.total, Math.round(left)), endsAt: now + Math.max(0, left) * 1000 };
};
export const restDone = (r, now) => !!r && now >= r.endsAt;
export const clock = (sec) => { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// Conteo de series hechas / totales de una sesión (borrador)
export function setProgress(exercises) {
  let done = 0, total = 0;
  for (const e of exercises || []) for (const s of e.sets || []) { total++; if (s.done) done++; }
  return { done, total };
}
// Índice del primer ejercicio con series pendientes (o el último si todo está hecho; -1 sin ejercicios)
export function currentExercise(exercises) {
  const list = exercises || [];
  const i = list.findIndex((e) => (e.sets || []).some((s) => !s.done));
  return i >= 0 ? i : list.length - 1;
}

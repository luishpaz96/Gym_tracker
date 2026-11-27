// Última vez que se hizo un ejercicio y sugerencia de sobrecarga progresiva (funciones puras).

// Última sesión anterior con el ejercicio -> { date, sets } o null.
export function lastTime(workouts, exerciseId, beforeDate, excludeId) {
  const cand = (workouts || []).filter((w) => w.id !== excludeId && w.performed_on <= beforeDate)
    .sort((a, b) => (b.performed_on === a.performed_on ? String(b.created_at || '').localeCompare(String(a.created_at || '')) : b.performed_on.localeCompare(a.performed_on)));
  for (const w of cand) {
    const ex = (w.exercises || []).find((e) => e.exercise_id === exerciseId && (e.sets || []).some((s) => +s.reps > 0));
    if (ex) return { date: w.performed_on, sets: ex.sets.filter((s) => +s.reps > 0) };
  }
  return null;
}

// '6–10' | '6-10' | '12' -> [6, 10]; '45 s', '' -> null
export function parseRepRange(txt) {
  const m = String(txt ?? '').trim().match(/^(\d{1,3})\s*(?:[–—-]\s*(\d{1,3}))?$/);
  if (!m) return null;
  const lo = +m[1], hi = m[2] ? +m[2] : lo;
  return lo <= hi ? [lo, hi] : [hi, lo];
}

export const STEP = { kg: 2.5, lb: 5 };

// sets: [{weight_kg, reps}] de la última vez. Devuelve una línea de texto.
export function overloadSuggestion(sets, repRange, unit = 'kg') {
  if (!sets || !sets.length) return 'Primera vez: elige un peso con el que te queden 2–3 repeticiones en reserva.';
  const range = parseRepRange(repRange);
  const step = STEP[unit] || STEP.kg;
  if (range) {
    const hi = range[1];
    if (sets.every((s) => +s.reps >= hi)) return `Sube ${step} ${unit}: completaste ${hi} reps en todas las series.`;
  }
  let idx = 0;
  sets.forEach((s, i) => { if (+s.reps < +sets[idx].reps) idx = i; });
  if (!range && sets.every((s) => +s.reps === +sets[0].reps)) idx = sets.length - 1;
  return `Intenta +1 rep en la serie ${idx + 1} (mismo peso).`;
}

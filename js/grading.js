// Calificación de la sesión: compara cada ejercicio contra su sesión anterior.
import { bestE1RM, exerciseVolume, round } from './calc.js';

export const THRESHOLDS = {
  e1rmUp: 0.01,   // +1 % de 1RM estimado  -> mejoraste
  volUp: 0.03,    // +3 % de volumen (sin caer 1RM más de 3 %) -> mejoraste
  e1rmDown: -0.03, // -3 % de 1RM  -> bajaste
  volDown: -0.05,  // -5 % de volumen -> bajaste
};
export const GRADE_CUTS = { A: 0.75, B: 0.5, C: 0.3 }; // puntaje = (mejoras + 0.5*iguales) / comparables

const pct = (cur, prev) => (prev > 0 ? (cur - prev) / prev : null);

export function compareExercise(prevEx, currEx) {
  const cE = bestE1RM(currEx.sets), cV = exerciseVolume(currEx);
  if (!prevEx) return { status: 'new', label: 'Primera vez', e1rm: round(cE), volume: round(cV, 0) };
  const pE = bestE1RM(prevEx.sets), pV = exerciseVolume(prevEx);
  const dE = pct(cE, pE), dV = pct(cV, pV);
  let status = 'same';
  if (dE !== null && dE >= THRESHOLDS.e1rmUp) status = 'up';
  else if (dV !== null && dV >= THRESHOLDS.volUp && (dE === null || dE > THRESHOLDS.e1rmDown)) status = 'up';
  else if ((dE !== null && dE <= THRESHOLDS.e1rmDown) || (dV !== null && dV <= THRESHOLDS.volDown)) status = 'down';
  const label = { up: 'Mejoraste', same: 'Igual', down: 'Bajaste' }[status];
  return { status, label, e1rm: round(cE), prevE1rm: round(pE), volume: round(cV, 0), prevVolume: round(pV, 0), dE, dV };
}

export function letterFor(score) {
  if (score >= GRADE_CUTS.A) return 'A';
  if (score >= GRADE_CUTS.B) return 'B';
  if (score >= GRADE_CUTS.C) return 'C';
  return 'D';
}

const EXPLAIN = {
  A: 'Excelente: superaste tus marcas en casi todos los ejercicios.',
  B: 'Buena sesión: mejoraste en varios ejercicios y mantuviste el resto.',
  C: 'Sesión regular: te mantuviste, pero hubo pocas mejoras.',
  D: 'Sesión floja comparada con la anterior. Revisa descanso, sueño y comida.',
};

// results: [{status}] ; devuelve {letter, score, text} o null si no hay con qué comparar.
export function gradeWorkout(results) {
  const comparable = results.filter((r) => r.status !== 'new');
  if (!comparable.length) return { letter: null, score: null, text: 'Primera vez con estos ejercicios: aún no hay con qué comparar.' };
  const up = comparable.filter((r) => r.status === 'up').length;
  const same = comparable.filter((r) => r.status === 'same').length;
  const down = comparable.filter((r) => r.status === 'down').length;
  const score = (up + 0.5 * same) / comparable.length;
  const letter = letterFor(score);
  return { letter, score: round(score, 2), up, same, down, text: `${EXPLAIN[letter]} (${up} mejoraron, ${same} igual, ${down} bajaron).` };
}

// Última sesión anterior que contiene el ejercicio (antes de la fecha dada, o misma fecha con otro id).
export function previousExercise(workouts, exerciseId, beforeDate, excludeId) {
  const cand = (workouts || [])
    .filter((w) => w.id !== excludeId && w.performed_on <= beforeDate)
    .sort((a, b) => (b.performed_on === a.performed_on ? String(b.created_at || '').localeCompare(String(a.created_at || '')) : b.performed_on.localeCompare(a.performed_on)));
  for (const w of cand) {
    const ex = (w.exercises || []).find((e) => e.exercise_id === exerciseId && (e.sets || []).some((s) => +s.reps > 0));
    if (ex) return ex;
  }
  return null;
}

export function gradeSession(workouts, workout) {
  const items = (workout.exercises || []).filter((e) => (e.sets || []).some((s) => +s.reps > 0)).map((ex) => {
    const prev = previousExercise(workouts, ex.exercise_id, workout.performed_on, workout.id);
    return { exercise_id: ex.exercise_id, ...compareExercise(prev, ex) };
  });
  return { items, overall: gradeWorkout(items) };
}

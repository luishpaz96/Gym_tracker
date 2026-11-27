// Consejos generados a partir de los datos (funciones puras). Devuelve de 3 a 5.
import { addDays, weekStart, bestE1RM } from './calc.js';
import { compareExercise } from './grading.js';
import { pickForMuscle } from './recommend.js';
import { weightTip } from './weight.js';

const planDaysPerWeek = (plan) => Object.keys(plan?.days || {}).length || 3;
const sessionDates = (workouts) => [...new Set(workouts.map((w) => w.performed_on))];

export function sessionsInWeek(workouts, today) {
  const from = weekStart(today), to = addDays(from, 6);
  return sessionDates(workouts).filter((d) => d >= from && d <= to).length;
}

// Semanas consecutivas cumpliendo la meta de sesiones (la semana en curso cuenta solo si ya la cumpliste).
export function weekStreak(workouts, today, goal) {
  const dates = sessionDates(workouts);
  const count = (wk) => dates.filter((d) => d >= wk && d <= addDays(wk, 6)).length;
  let wk = weekStart(today), n = 0;
  if (count(wk) < goal) wk = addDays(wk, -7);
  while (count(wk) >= goal && n < 520) { n++; wk = addDays(wk, -7); }
  return n;
}

// Sesiones (más reciente primero) que contienen el ejercicio.
function history(workouts, exId) {
  return [...workouts].sort((a, b) => b.performed_on.localeCompare(a.performed_on))
    .map((w) => ({ w, ex: (w.exercises || []).find((e) => e.exercise_id === exId && (e.sets || []).some((s) => +s.reps > 0)) })).filter((x) => x.ex);
}

export function generateTips({ status, workouts, exercises, plan, today, weights = null, weightGoal = null }) {
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const goal = planDaysPerWeek(plan);
  const tips = [];

  const done = sessionsInWeek(workouts, today);
  tips.push({ kind: 'week', text: done >= goal ? `Cumpliste tus ${goal} sesiones de la semana. Buen trabajo.` : `Llevas ${done} de ${goal} sesiones esta semana.${goal - done === 1 ? ' Te falta 1.' : ` Te faltan ${goal - done}.`}` });

  if (weights && weightGoal) tips.push({ kind: 'weight', text: weightTip(weights, weightGoal) });

  const needy = status.filter((m) => m.status === 'red' || m.status === 'yellow').sort((a, b) => (a.sets / a.target) - (b.sets / b.target)).slice(0, 2);
  for (const m of needy) {
    const ex = pickForMuscle(exercises, m.id, 2).map((e) => e.name);
    tips.push({ kind: 'deficit', text: `${m.name} va ${m.status === 'red' ? 'bajo' : 'por debajo'}: ${m.sets}/${m.target} series.${ex.length ? ` Ataca con ${ex.join(' o ')}.` : ''}` });
  }
  if (!needy.length && status.some((m) => m.status === 'green')) tips.push({ kind: 'deficit', text: 'Todos tus músculos con datos van en objetivo esta semana.' });

  // Bajaste vs la sesión anterior (solo ejercicios de tu sesión más reciente)
  const latest = [...workouts].sort((a, b) => b.performed_on.localeCompare(a.performed_on))[0];
  const downs = [], stalled = [];
  const seen = new Set();
  for (const w of [...workouts].sort((a, b) => b.performed_on.localeCompare(a.performed_on)).slice(0, 4)) {
    for (const e of w.exercises || []) {
      if (seen.has(e.exercise_id) || !byId[e.exercise_id]) continue;
      seen.add(e.exercise_id);
      const h = history(workouts, e.exercise_id);
      if (h.length < 2) continue;
      if (h[0].w === latest || h[0].w.performed_on >= addDays(today, -14)) {
        if (compareExercise(h[1].ex, h[0].ex).status === 'down') downs.push(byId[e.exercise_id].name);
      }
      if (h.length >= 3) {
        const cur = bestE1RM(h[0].ex.sets), before = Math.max(bestE1RM(h[1].ex.sets), bestE1RM(h[2].ex.sets));
        if (cur <= before * 1.01 && !downs.includes(byId[e.exercise_id].name)) stalled.push(byId[e.exercise_id].name);
      }
    }
  }
  if (downs.length) tips.push({ kind: 'drop', text: `Bajaste vs la sesión anterior en ${downs.slice(0, 3).join(', ')}. Revisa descanso y sueño, y repite el peso antes de subir.` });

  const streak = weekStreak(workouts, today, goal);
  tips.push({ kind: 'streak', text: streak > 0 ? `Racha: ${streak} semana${streak > 1 ? 's' : ''} seguidas cumpliendo tus ${goal} sesiones.` : `Aún no hay racha: cumple ${goal} sesiones en una semana para empezarla.` });

  if (stalled.length) tips.push({ kind: 'stall', text: `${stalled.slice(0, 2).join(' y ')} lleva${stalled.length > 1 ? 'n' : ''} 3 sesiones sin mejorar: prueba bajar 5–10 % el peso y subir repeticiones, o cambia de variante.` });

  if (!workouts.length) return [{ kind: 'start', text: 'Registra tu primera sesión en Track para recibir consejos personalizados.' }, tips[0], tips[tips.length - 1]];
  return tips.slice(0, 5);
}

// Datos de muestra para el modo ?demo=1 (nunca se suben a ningún servidor).
import { addDays, weekdayOf, localDateStr } from './calc.js';
import { buildWorkout } from './api.js';
import { phaseFor } from './recommend.js';

const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function makeSeed(data) {
  const today = localDateStr();
  const out = [];
  for (let back = 35; back >= 1; back--) {
    const date = addDays(today, -back);
    const wd = String(weekdayOf(date));
    if (!data.plan.days[wd]) continue;
    const phase = phaseFor(data.plan, date) || data.plan.phases[0];
    const session = phase?.sessions?.[wd];
    if (!session) continue;
    const week = Math.floor((35 - back) / 7);
    // Para que el semáforo muestre variedad, en la semana más reciente se omite parte del trabajo.
    const exs = session.exercises.filter((e, i) => !(back <= 7 && i % 3 === 2));
    const w = buildWorkout({
      performed_on: date, plan_day: session.name, notes: '',
      exercises: exs.filter((e) => data.exById[e.id]).map((e) => {
        const base = 20 + (hash(e.id) % 60);
        const n = Array.isArray(e.sets) ? e.sets.length : 3;
        return { exercise_id: e.id, sets: Array.from({ length: n }, (_, i) => ({ weight_kg: Math.round((base * (1 + 0.03 * week) - i * 1.25) * 2) / 2, reps: 10 - Math.min(i, 3) + (week % 2), rir: i === n - 1 ? 1 : 2 })) };
      }),
    });
    out.push(w);
  }
  return out;
}

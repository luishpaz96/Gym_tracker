// Utilidades que combinan datos + lógica pura para varias pantallas.
import { addDays, weekStart, localDateStr, muscleSeries, workoutVolume } from './calc.js';
import { muscleStatus, recommend } from './recommend.js';

export const today = () => localDateStr();

export function weekStatus(ctx) {
  const t = today();
  const series = muscleSeries(ctx.workouts, ctx.data.exById, { from: weekStart(t), to: addDays(weekStart(t), 6) });
  return muscleStatus(ctx.data.muscles, series, ctx.workouts.length > 0);
}
export const doneToday = (ctx) => ctx.workouts.some((w) => w.performed_on === today());
export function routine(ctx) {
  return recommend({ plan: ctx.plan, exercises: ctx.data.exercises, status: weekStatus(ctx), today: today(), doneToday: doneToday(ctx) });
}
export const unitLabel = (ctx) => (ctx.profile?.unit === 'lb' ? 'lb' : 'kg');
export const sessionsByDateAsc = (ws) => [...ws].sort((a, b) => a.performed_on.localeCompare(b.performed_on));
export const totalVolume = (ws) => ws.reduce((a, w) => a + workoutVolume(w), 0);

// ---- Nutrición ----
import { computeTargets } from './nutrition.js';
import { goalFor } from './plan-generator.js';
export function targetsOf(ctx) {
  const p = ctx.profile, w = ctx.weights?.[ctx.weights.length - 1]?.weight_kg;
  if (!p?.birth_year || !p.height_cm || !w) return null;
  const goal = p.goal_weight_kg ? goalFor(w, p.goal_weight_kg) : 'recomp';
  return computeTargets({ sex: p.sex, weight_kg: w, height_cm: p.height_cm, age: new Date().getFullYear() - p.birth_year, days_per_week: p.days_per_week || 3 }, goal);
}
export const foodFrom = () => addDays(today(), -45);

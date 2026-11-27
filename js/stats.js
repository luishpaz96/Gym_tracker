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

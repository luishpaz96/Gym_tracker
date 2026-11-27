// Semáforo muscular y recomendaciones para la siguiente sesión.
import { addDays, weekdayOf, weekStart, round } from './calc.js';

export const SEMAFORO = { green: 1.0, yellow: 0.5 }; // ratio = series efectivas / target_sets
export function semaforo(sets, target, hasData = true) {
  if (!hasData) return 'gray';
  if (!(target > 0)) return 'gray';
  const r = sets / target;
  if (r >= SEMAFORO.green) return 'green';
  if (r >= SEMAFORO.yellow) return 'yellow';
  return 'red';
}
export const STATUS_LABEL = { green: 'En objetivo', yellow: 'Por debajo', red: 'Bajo', gray: 'Sin datos' };

export function muscleStatus(muscles, series, hasData) {
  return muscles.map((m) => {
    const sets = round(series[m.id]?.sets || 0, 1);
    return { id: m.id, name: m.name, view: m.view, target: m.target_sets, sets, ratio: m.target_sets ? sets / m.target_sets : 0,
      status: semaforo(sets, m.target_sets, hasData), exercises: series[m.id]?.exercises || {} };
  });
}

export function phaseFor(plan, date) {
  return (plan?.phases || []).find((p) => date >= p.from && date <= p.to) || null;
}
export function sessionFor(plan, date) {
  const wd = String(weekdayOf(date));
  if (!plan?.days?.[wd]) return null;
  const phase = phaseFor(plan, date);
  const session = phase?.sessions?.[wd] || null;
  return session ? { date, weekday: +wd, dayLabel: plan.days[wd], phase, session } : null;
}
// Próxima sesión del plan. Si ya se entrenó hoy (doneToday) arranca mañana.
export function nextSession(plan, today, doneToday = false, horizon = 60) {
  for (let i = doneToday ? 1 : 0; i <= horizon; i++) {
    const s = sessionFor(plan, addDays(today, i));
    if (s) return s;
  }
  return null;
}

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const planSets = (sets) => (Array.isArray(sets) ? sets.length : +sets || 3);

// Ejercicios de la base cuyo músculo principal es muscleId (los más "aislados" primero).
export function pickForMuscle(exercises, muscleId, n = 1, used = new Set()) {
  return exercises.filter((e) => !used.has(e.id) && (e.primary || []).includes(muscleId))
    .sort((a, b) => (a.primary.length + a.secondary.length) - (b.primary.length + b.secondary.length) || a.id.localeCompare(b.id))
    .slice(0, n);
}

// Rutina recomendada: sesión del plan (hoy, o la siguiente) ajustada con el semáforo de la semana.
export function recommend({ plan, exercises, status, today, doneToday = false, maxExtras = 4 }) {
  const byId = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const next = nextSession(plan, today, doneToday);
  const nameOf = Object.fromEntries(status.map((m) => [m.id, m.name]));
  const needyAll = status.filter((m) => m.status === 'red' || m.status === 'yellow')
    .map((m) => ({ ...m, deficit: round(m.target - m.sets, 1) })).sort((a, b) => b.deficit - a.deficit);
  // Músculos que otra sesión del plan cubrirá más tarde en esta misma semana: no urgen hoy.
  const postponed = new Set();
  if (next && weekStart(next.date) === weekStart(today)) {
    for (let d = addDays(next.date, 1); d <= addDays(weekStart(today), 6); d = addDays(d, 1)) {
      for (const pe of sessionFor(plan, d)?.session?.exercises || []) (byId[pe.id]?.primary || []).forEach((m) => postponed.add(m));
    }
  }
  const needy = needyAll.filter((m) => !postponed.has(m.id));
  const needIds = new Set(needyAll.map((m) => m.id));
  const items = [], covered = new Set();
  for (const pe of next?.session?.exercises || []) {
    const ex = byId[pe.id];
    if (!ex) continue;
    const hits = (ex.primary || []).filter((m) => needIds.has(m));
    (ex.primary || []).forEach((m) => covered.add(m));
    items.push({ exercise: ex, sets: planSets(pe.sets), reps: pe.reps || null, rest: pe.rest || null, source: 'plan',
      reason: hits.length ? `Del plan · refuerza ${hits.map((m) => nameOf[m]).join(', ')}` : 'Del plan', muscles: hits });
  }
  const used = new Set(items.map((i) => i.exercise.id));
  let extras = 0;
  for (const m of needy) {
    if (extras >= maxExtras) break;
    if (covered.has(m.id)) continue;
    const cands = pickForMuscle(exercises, m.id, m.deficit >= 4 ? 2 : 1, used).slice(0, maxExtras - extras);
    for (const ex of cands) {
      used.add(ex.id); extras++;
      items.push({ exercise: ex, sets: clamp(Math.ceil(m.deficit / cands.length), 2, 4), reps: null, rest: null, source: 'deficit',
        reason: `${m.name}: ${m.sets}/${m.target} series esta semana`, muscles: [m.id] });
    }
  }
  const needs = needy.map((m) => ({ id: m.id, name: m.name, sets: m.sets, target: m.target, status: m.status,
    text: `Te falta: ${m.name.toLowerCase()} ${m.sets}/${m.target} series` }));
  return { next, items, needy, needs };
}

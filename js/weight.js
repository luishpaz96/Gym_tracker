// Peso corporal: promedios semanales y consejos de ritmo (funciones puras).
import { weekStart, round } from './calc.js';

export const HEALTHY = { gain: [0.25, 0.5], lose: [0.5, 1.0] }; // % del peso por semana

export function weeklyAverages(entries) {
  const m = new Map();
  for (const e of [...entries].sort((a, b) => a.measured_on.localeCompare(b.measured_on))) {
    const wk = weekStart(e.measured_on);
    const r = m.get(wk) || { week: wk, sum: 0, n: 0 };
    r.sum += +e.weight_kg; r.n++; m.set(wk, r);
  }
  return [...m.values()].map((r) => ({ week: r.week, avg: round(r.sum / r.n, 2), n: r.n }));
}

// Cambio % entre los dos últimos promedios semanales (null si no hay dos semanas).
export function weeklyChangePct(entries) {
  const w = weeklyAverages(entries);
  if (w.length < 2) return null;
  const a = w[w.length - 2].avg, b = w[w.length - 1].avg;
  return round(((b - a) / a) * 100, 2);
}

export function weightTip(entries, goal) {
  if (!entries.length) return 'Registra tu peso (idealmente en ayunas) para seguir tu tendencia semanal.';
  const pct = weeklyChangePct(entries);
  if (pct === null) return 'Registra tu peso al menos en 2 semanas distintas para ver tu ritmo de cambio.';
  const abs = Math.abs(pct);
  if (goal === 'gain') {
    const [lo, hi] = HEALTHY.gain;
    if (pct < 0) return `Tu peso bajó ${abs} % esta semana y tu meta es subir: come un poco más.`;
    if (pct < lo) return `Subes ${abs} %/semana: algo lento. Objetivo sano: ${lo}–${hi} %. Añade ~150 kcal.`;
    if (pct > hi) return `Subes ${abs} %/semana: demasiado rápido, parte puede ser grasa. Objetivo sano: ${lo}–${hi} %.`;
    return `Ritmo ideal: ${pct} %/semana (sano: ${lo}–${hi} %).`;
  }
  if (goal === 'lose') {
    const [lo, hi] = HEALTHY.lose;
    if (pct > 0) return `Tu peso subió ${abs} % esta semana y tu meta es bajar: revisa calorías y pasos.`;
    if (abs < lo) return `Bajas ${abs} %/semana: lento. Objetivo sano: ${lo}–${hi} %. Suma pasos o reduce ~150 kcal.`;
    if (abs > hi) return `Bajas ${abs} %/semana: demasiado rápido, arriesgas perder músculo. Objetivo sano: ${lo}–${hi} %.`;
    return `Ritmo ideal: ${abs} %/semana (sano: ${lo}–${hi} %).`;
  }
  return abs > 0.5 ? `Tu peso cambió ${pct} % esta semana; para recomposición busca mantenerte dentro de ±0.5 %.` : `Peso estable (${pct} %/semana): bien para recomposición.`;
}

// Generador de plan personalizado (funciones puras). Produce el mismo formato que data/plan.json.
import { addDays, weekStart } from './calc.js';

export const GOAL_TOL = 0.5; // kg de diferencia para considerar "mantener"
export const goalFor = (current, goalWeight) => (goalWeight > current + GOAL_TOL ? 'gain' : goalWeight < current - GOAL_TOL ? 'lose' : 'recomp');
export const GOAL_LABEL = { gain: 'Hipertrofia', lose: 'Definición (mantener músculo)', recomp: 'Recomposición' };

// Plantillas de sesión: [músculo, cantidad mínima de ejercicios]. Grandes: 2; pequeños: 1.
const T = {
  fullA: ['Cuerpo completo A', [['pecho', 2], ['dorsales', 1], ['cuadriceps', 1], ['femoral', 1], ['hombro_lateral', 1], ['biceps', 1], ['abdomen', 1]]],
  fullB: ['Cuerpo completo B', [['dorsales', 2], ['espalda_media', 1], ['pecho', 1], ['cuadriceps', 1], ['gluteo', 1], ['triceps', 1], ['hombro_posterior', 1]]],
  pechoBiceps: ['Pecho, bíceps y abdomen', [['pecho', 3], ['biceps', 2], ['abdomen', 2]]],
  pierna: ['Pierna', [['cuadriceps', 2], ['femoral', 1], ['gluteo', 1], ['pantorrilla', 1]]],
  espalda: ['Espalda, hombro, trapecio y tríceps', [['dorsales', 2], ['espalda_media', 1], ['hombro_lateral', 1], ['hombro_posterior', 1], ['trapecio', 1], ['triceps', 2]]],
  torso: ['Torso', [['pecho', 2], ['dorsales', 2], ['hombro_lateral', 1], ['biceps', 1], ['triceps', 1]]],
  piernaAbd: ['Pierna y abdomen', [['cuadriceps', 2], ['femoral', 1], ['gluteo', 1], ['pantorrilla', 1], ['abdomen', 1]]],
  empuje: ['Empuje', [['pecho', 2], ['hombro_frontal', 1], ['hombro_lateral', 1], ['triceps', 2]]],
  jalon: ['Jalón', [['dorsales', 2], ['espalda_media', 1], ['hombro_posterior', 1], ['trapecio', 1], ['biceps', 2]]],
};
export const SPLITS = {
  2: { weekdays: [1, 4], sessions: ['fullA', 'fullB'] },
  3: { weekdays: [1, 3, 5], sessions: ['pechoBiceps', 'pierna', 'espalda'] },
  4: { weekdays: [1, 2, 4, 5], sessions: ['torso', 'piernaAbd', 'torso', 'piernaAbd'] },
  5: { weekdays: [1, 2, 4, 5, 6], sessions: ['torso', 'piernaAbd', 'empuje', 'jalon', 'piernaAbd'] },
  6: { weekdays: [1, 2, 3, 4, 5, 6], sessions: ['empuje', 'jalon', 'pierna', 'empuje', 'jalon', 'pierna'] },
};
export const DAY_NAMES = { 0: 'Domingo', 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado' };
const BIG = new Set(['pecho', 'dorsales', 'cuadriceps', 'femoral', 'gluteo', 'espalda_media']);

const isCompound = (e) => (e.secondary || []).length >= 2 || (e.primary || []).length >= 2;

// Elige n ejercicios para un músculo: gimnasio primero, compuesto primero, equipo variado, evitando repetir los ya usados.
export function pickExercises(exercises, muscle, n, used) {
  const pool = exercises.filter((e) => (e.primary || []).includes(muscle));
  const rank = (e) => [used.has(e.id) ? 1 : 0, (e.where || []).includes('gym') ? 0 : 1, -(e.secondary || []).length, e.id];
  pool.sort((a, b) => { const x = rank(a), y = rank(b); for (let i = 0; i < 4; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; });
  const out = [], eq = new Set();
  for (const e of pool) { if (out.length >= n) break; if (!eq.has(e.equipment) || pool.length - out.length <= n - out.length) { out.push(e); eq.add(e.equipment); } }
  for (const e of pool) { if (out.length >= n) break; if (!out.includes(e)) out.push(e); }
  return out;
}

// Series por ejercicio según la semana del mesociclo (0..3; la 3 es descarga) y la meta.
export function setsFor(goal, weekInBlock, compound) {
  const base = 3;
  if (weekInBlock === 3) return 2;
  if (goal === 'gain') return base + (weekInBlock === 1 ? (compound ? 1 : 0) : weekInBlock === 2 ? 1 : 0);
  if (goal === 'recomp') return base + (weekInBlock === 2 && compound ? 1 : 0);
  return base; // lose: mismo trabajo de fuerza para conservar músculo
}
export const repsFor = (goal, compound) => (compound ? '6–10' : '10–12');

export const PHASE_LABEL = ['Base', 'Progresión', 'Pico', 'Descarga'];

export function generatePlan({ days, goal, exercises, start, weeks = 16 }) {
  const d = Math.min(6, Math.max(2, Math.round(days) || 3));
  const split = SPLITS[d];
  const monday = weekStart(start);
  const used = new Set();
  const dayNames = Object.fromEntries(split.weekdays.map((wd) => [String(wd), DAY_NAMES[wd]]));
  // Ejercicios fijos por sesión (se mantienen todo el bloque para poder progresar en carga)
  const base = split.sessions.map((key, i) => {
    const [label, slots] = T[key];
    const sameBefore = split.sessions.slice(0, i).filter((k) => k === key).length;
    const items = [];
    for (const [m, n] of slots) {
      for (const e of pickExercises(exercises, m, n, used)) { used.add(e.id); items.push(e); }
    }
    const name = sameBefore || split.sessions.filter((k) => k === key).length > 1 ? `${label} ${sameBefore ? 'B' : 'A'}` : label;
    return { wd: String(split.weekdays[i]), name, items };
  });
  const phases = [];
  for (let w = 0; w < weeks; w++) {
    const wib = w % 4, from = addDays(monday, 7 * w);
    const sessions = {};
    for (const s of base) {
      sessions[s.wd] = { name: s.name, exercises: s.items.map((e) => {
        const compound = isCompound(e) || BIG.has(e.primary[0]);
        const n = setsFor(goal, wib, compound);
        return { id: e.id, reps: repsFor(goal, compound), sets: Array(n).fill(n), rest: compound ? '2–3 min' : '60–90 s' };
      }) };
    }
    phases.push({ id: `G-S${w + 1}`, name: `Semana ${w + 1} · ${PHASE_LABEL[wib]}`, from, to: addDays(from, 6), sessions });
  }
  return { start: monday, days: dayNames, phases, meta: { generated: true, goal, days: d, weeks } };
}

// Consejos de nutrición/cardio por meta.
export function goalNotes(goal) {
  if (goal === 'lose') return ['Cardio ligero: 8 000–10 000 pasos al día y 2–3 sesiones de 20–30 min.', 'Déficit calórico moderado (300–500 kcal) y 1.6–2.2 g de proteína por kg para conservar músculo.'];
  if (goal === 'gain') return ['Superávit leve (250–400 kcal) y 1.6–2.2 g de proteína por kg.', 'Duerme 7–9 h: ahí se construye el músculo.'];
  return ['Mantén las calorías cerca del mantenimiento y 1.8–2.2 g de proteína por kg.', 'Progresa en carga o repeticiones cada semana.'];
}

export const planEndDate = (plan) => (plan?.phases?.length ? plan.phases[plan.phases.length - 1].to : null);

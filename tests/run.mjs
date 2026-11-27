// Ejecutar: node --test tests/run.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as calc from '../js/calc.js';
import * as grading from '../js/grading.js';
import * as rec from '../js/recommend.js';
import { normalize, searchExercises } from '../js/search.js';

const EX = [
  { id: 'banca', name: 'Press de banca con barra', group: 'Pecho', primary: ['pecho'], secondary: ['triceps', 'hombro_frontal'], equipment: 'Barra', where: ['gym'], keywords: ['bench', 'press banca'] },
  { id: 'curl', name: 'Curl de bíceps con mancuernas', group: 'Bíceps', primary: ['biceps'], secondary: ['antebrazo'], equipment: 'Mancuernas', where: ['gym', 'casa'], keywords: ['biceps curl'] },
  { id: 'sentadilla', name: 'Sentadilla', group: 'Cuádriceps', primary: ['cuadriceps'], secondary: ['gluteo'], equipment: 'Barra', where: ['gym'], keywords: ['squat'] },
  { id: 'plancha', name: 'Plancha abdominal', group: 'Abdomen', primary: ['abdomen'], secondary: [], equipment: 'Peso corporal', where: ['casa'], keywords: [] },
];
const BY = Object.fromEntries(EX.map((e) => [e.id, e]));
const S = (w, r) => ({ weight_kg: w, reps: r });

test('volumen = suma peso x reps', () => {
  assert.equal(calc.setVolume(S(100, 5)), 500);
  assert.equal(calc.exerciseVolume({ sets: [S(100, 5), S(80, 10)] }), 1300);
  assert.equal(calc.workoutVolume({ exercises: [{ sets: [S(10, 10)] }, { sets: [S(20, 5), S(0, 12)] }] }), 200);
  assert.equal(calc.workoutVolume({ exercises: [] }), 0);
});

test('Epley e1RM', () => {
  assert.equal(calc.epley(100, 1), 100);
  assert.equal(calc.epley(100, 10), 100 * (1 + 10 / 30));
  assert.equal(calc.epley(0, 10), 0);
  assert.equal(calc.epley(100, 0), 0);
  assert.equal(calc.round(calc.bestE1RM([S(100, 5), S(90, 10)]), 1), 120);
});

test('conversión kg/lb', () => {
  assert.ok(Math.abs(calc.kgToLb(100) - 220.462) < 0.01);
  assert.ok(Math.abs(calc.lbToKg(220.462) - 100) < 0.01);
  assert.equal(calc.toDisplay(100, 'kg'), 100);
});

test('fechas', () => {
  assert.equal(calc.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(calc.weekdayOf('2026-11-27'), 5);
  assert.equal(calc.weekStart('2026-11-27'), '2026-11-23');
  assert.equal(calc.weekStart('2026-11-29'), '2026-11-23');
  assert.equal(calc.diffDays('2026-11-27', '2026-11-20'), 7);
});

test('series efectivas por músculo: principal 1, secundario 0.5', () => {
  const ws = [
    { performed_on: '2026-11-24', exercises: [{ exercise_id: 'banca', sets: [S(80, 8), S(80, 8), S(80, 8), S(80, 0)] }] },
    { performed_on: '2026-11-26', exercises: [{ exercise_id: 'curl', sets: [S(15, 10), S(15, 10)] }] },
    { performed_on: '2026-10-01', exercises: [{ exercise_id: 'banca', sets: [S(80, 8)] }] },
  ];
  const r = calc.muscleSeries(ws, BY, { from: '2026-11-21', to: '2026-11-27' });
  assert.equal(r.pecho.sets, 3);
  assert.equal(r.triceps.sets, 1.5);
  assert.equal(r.biceps.sets, 2);
  assert.equal(r.antebrazo.sets, 1);
  assert.equal(r.pecho.exercises.banca, 3);
  const wk = calc.weeklySeries(ws, BY, 'pecho', 3, '2026-11-27');
  assert.deepEqual(wk.map((x) => x.sets), [0, 0, 3]);
});

test('validateSet', () => {
  assert.equal(calc.validateSet({ weight_kg: 50, reps: 8, rir: 2 }), null);
  assert.ok(calc.validateSet({ weight_kg: 1001, reps: 8 }));
  assert.ok(calc.validateSet({ weight_kg: -1, reps: 8 }));
  assert.ok(calc.validateSet({ weight_kg: 10, reps: 1.5 }));
  assert.ok(calc.validateSet({ weight_kg: 10, reps: 5, rir: 11 }));
});

test('calificación por ejercicio (umbrales)', () => {
  const prev = { sets: [S(100, 5)] }; // e1rm 116.67, vol 500
  assert.equal(grading.compareExercise(prev, { sets: [S(105, 5)] }).status, 'up');   // +5 % e1rm
  assert.equal(grading.compareExercise(prev, { sets: [S(100, 5)] }).status, 'same');
  assert.equal(grading.compareExercise(prev, { sets: [S(90, 5)] }).status, 'down');
  // más volumen con mismo e1rm aprox: 3 series -> +200 % vol
  assert.equal(grading.compareExercise(prev, { sets: [S(100, 5), S(100, 5), S(100, 5)] }).status, 'up');
  // e1rm cae ligeramente (-2 %) pero volumen no cambia -> igual
  assert.equal(grading.compareExercise({ sets: [S(100, 10)] }, { sets: [S(98, 10)] }).status, 'same');
  assert.equal(grading.compareExercise(null, prev).status, 'new');
});

test('nota global A-D', () => {
  assert.equal(grading.letterFor(1), 'A');
  assert.equal(grading.letterFor(0.75), 'A');
  assert.equal(grading.letterFor(0.74), 'B');
  assert.equal(grading.letterFor(0.5), 'B');
  assert.equal(grading.letterFor(0.3), 'C');
  assert.equal(grading.letterFor(0.29), 'D');
  assert.equal(grading.gradeWorkout([{ status: 'up' }, { status: 'up' }, { status: 'same' }]).letter, 'A');
  assert.equal(grading.gradeWorkout([{ status: 'down' }, { status: 'down' }]).letter, 'D');
  assert.equal(grading.gradeWorkout([{ status: 'new' }]).letter, null);
});

test('gradeSession usa la sesión anterior', () => {
  const old = { id: 'a', performed_on: '2026-11-20', exercises: [{ exercise_id: 'banca', sets: [S(80, 8)] }] };
  const cur = { id: 'b', performed_on: '2026-11-25', exercises: [{ exercise_id: 'banca', sets: [S(85, 8)] }, { exercise_id: 'curl', sets: [S(10, 10)] }] };
  const g = grading.gradeSession([old, cur], cur);
  assert.equal(g.items[0].status, 'up');
  assert.equal(g.items[1].status, 'new');
  assert.equal(g.overall.letter, 'A');
});

test('semáforo: umbrales 100 % / 50 %', () => {
  assert.equal(rec.semaforo(8, 8), 'green');
  assert.equal(rec.semaforo(10, 8), 'green');
  assert.equal(rec.semaforo(7.9, 8), 'yellow');
  assert.equal(rec.semaforo(4, 8), 'yellow');
  assert.equal(rec.semaforo(3.9, 8), 'red');
  assert.equal(rec.semaforo(0, 8), 'red');
  assert.equal(rec.semaforo(0, 8, false), 'gray');
});

const PLAN = { start: '2026-10-19', days: { 1: 'Lunes', 3: 'Miércoles', 5: 'Viernes' }, phases: [{ id: 'F2', name: 'Fase 2', from: '2026-11-16', to: '2026-12-20', sessions: {
  1: { name: 'Pecho y bíceps', exercises: [{ id: 'banca', reps: '6–10', sets: [3, 4, 4], rest: '2–3 min' }, { id: 'curl', reps: '10–12', sets: [3, 3], rest: '90 s' }] },
  3: { name: 'Pierna', exercises: [{ id: 'sentadilla', reps: '6–8', sets: [4, 4], rest: '3 min' }] },
  5: { name: 'Abdomen', exercises: [{ id: 'plancha', reps: '45 s', sets: [3, 3, 3] }] } } }] };
const MUSCLES = [{ id: 'pecho', name: 'Pecho', view: 'front', target_sets: 8 }, { id: 'biceps', name: 'Bíceps', view: 'front', target_sets: 6 },
  { id: 'cuadriceps', name: 'Cuádriceps', view: 'front', target_sets: 10 }, { id: 'abdomen', name: 'Abdomen', view: 'front', target_sets: 6 },
  { id: 'gluteo', name: 'Glúteo', view: 'back', target_sets: 6 }];

test('plan: sesión de un día y próxima sesión', () => {
  assert.equal(rec.sessionFor(PLAN, '2026-11-27').session.name, 'Abdomen'); // viernes
  assert.equal(rec.sessionFor(PLAN, '2026-11-28'), null); // sábado
  assert.equal(rec.nextSession(PLAN, '2026-11-27', true).date, '2026-11-30'); // lunes
  assert.equal(rec.nextSession(PLAN, '2026-11-28').session.name, 'Pecho y bíceps');
  assert.equal(rec.nextSession(PLAN, '2027-06-01'), null);
});

test('recomendaciones: plan primero + extras por déficit', () => {
  const series = { pecho: { sets: 8, exercises: {} }, biceps: { sets: 1, exercises: {} }, abdomen: { sets: 0, exercises: {} }, cuadriceps: { sets: 0, exercises: {} } };
  const status = rec.muscleStatus(MUSCLES, series, true);
  assert.equal(status.find((m) => m.id === 'pecho').status, 'green');
  assert.equal(status.find((m) => m.id === 'biceps').status, 'red');
  const r = rec.recommend({ plan: PLAN, exercises: EX, status, today: '2026-11-28' });
  assert.equal(r.next.session.name, 'Pecho y bíceps');
  assert.deepEqual(r.items.slice(0, 2).map((i) => i.exercise.id), ['banca', 'curl']);
  assert.equal(r.items[0].sets, 3);
  const ids = r.items.map((i) => i.exercise.id);
  assert.ok(ids.includes('sentadilla') && ids.includes('plancha'));   // extras por músculos en rojo no cubiertos
  assert.equal(r.items.find((i) => i.exercise.id === 'sentadilla').source, 'deficit');
  assert.ok(r.items.find((i) => i.exercise.id === 'curl').reason.includes('Bíceps'));
});

test('búsqueda sin acentos', () => {
  assert.equal(normalize('Bíceps  CURL'), 'biceps curl');
  assert.equal(searchExercises(EX, { query: 'biceps' })[0].id, 'curl');
  assert.equal(searchExercises(EX, { query: 'BÍCEPS' })[0].id, 'curl');
  assert.equal(searchExercises(EX, { query: 'bench' })[0].id, 'banca');       // keyword
  assert.equal(searchExercises(EX, { query: 'press banca' })[0].id, 'banca');
  assert.equal(searchExercises(EX, { query: 'curl mancuernas' })[0].id, 'curl'); // todos los tokens
  assert.equal(searchExercises(EX, { query: 'zzz' }).length, 0);
  assert.equal(searchExercises(EX, { group: 'Abdomen' }).length, 1);
  assert.equal(searchExercises(EX, { where: 'casa' }).length, 2);
  assert.equal(searchExercises(EX, {}).length, 4);
});

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

// ---------- Sobrecarga progresiva ----------
import * as ov from '../js/overload.js';
import { generateTips, sessionsInWeek, weekStreak } from '../js/tips.js';

test('parseRepRange', () => {
  assert.deepEqual(ov.parseRepRange('6–10'), [6, 10]);
  assert.deepEqual(ov.parseRepRange('8-12'), [8, 12]);
  assert.deepEqual(ov.parseRepRange('12'), [12, 12]);
  assert.equal(ov.parseRepRange('45 s'), null);
  assert.equal(ov.parseRepRange(null), null);
});

test('lastTime devuelve fecha y todas las series', () => {
  const ws = [
    { id: 'a', performed_on: '2026-11-16', exercises: [{ exercise_id: 'banca', sets: [S(60, 10), S(60, 9), S(57.5, 8)] }] },
    { id: 'b', performed_on: '2026-11-23', exercises: [{ exercise_id: 'curl', sets: [S(10, 10)] }] },
  ];
  const l = ov.lastTime(ws, 'banca', '2026-11-27');
  assert.equal(l.date, '2026-11-16');
  assert.equal(l.sets.length, 3);
  assert.equal(ov.lastTime(ws, 'banca', '2026-11-10'), null);
  assert.equal(ov.lastTime(ws, 'plancha', '2026-11-27'), null);
});

test('sugerencia de sobrecarga', () => {
  assert.match(ov.overloadSuggestion([S(60, 10), S(60, 10), S(60, 10)], '6–10'), /Sube 2\.5 kg/);
  assert.match(ov.overloadSuggestion([S(60, 10), S(60, 10), S(60, 10)], '6–10', 'lb'), /Sube 5 lb/);
  assert.match(ov.overloadSuggestion([S(60, 10), S(60, 9), S(57.5, 8)], '6–10'), /\+1 rep en la serie 3/);
  assert.match(ov.overloadSuggestion([S(60, 10), S(60, 8), S(60, 9)], '8–12'), /\+1 rep en la serie 1|\+1 rep en la serie 2/);
  assert.match(ov.overloadSuggestion([], '6–10'), /Primera vez/);
  assert.match(ov.overloadSuggestion([S(20, 12), S(20, 12)], null), /\+1 rep/);
});

// ---------- Rutina recomendada ajustada ----------
test('rutina: día no planeado usa la siguiente sesión y marca faltantes con texto', () => {
  const series = { pecho: { sets: 8, exercises: {} }, biceps: { sets: 1, exercises: {} }, abdomen: { sets: 0, exercises: {} }, cuadriceps: { sets: 0, exercises: {} } };
  const status = rec.muscleStatus(MUSCLES, series, true);
  const r = rec.recommend({ plan: PLAN, exercises: EX, status, today: '2026-11-28' });
  assert.equal(r.next.date, '2026-11-30');
  const b = r.needs.find((n) => n.id === 'biceps');
  assert.equal(b.text, 'Te falta: bíceps 1/6 series');
});

test('rutina: músculos que cubre una sesión posterior de la misma semana no se agregan', () => {
  // Lunes 30 nov: hoy toca pecho/bíceps; pierna (miércoles) y abdomen (viernes) vienen después
  const status = rec.muscleStatus(MUSCLES, {}, true); // todo rojo
  const r = rec.recommend({ plan: PLAN, exercises: EX, status, today: '2026-11-30' });
  const ids = r.items.map((i) => i.exercise.id);
  assert.deepEqual(ids, ['banca', 'curl']);               // sin extras de pierna/abdomen
  assert.ok(!r.needs.some((n) => n.id === 'cuadriceps'));
  assert.ok(r.items[0].reason.includes('Pecho'));          // el plan marca qué refuerza
});

test('rutina: si ya entrenaste hoy, propone la siguiente', () => {
  const r = rec.recommend({ plan: PLAN, exercises: EX, status: rec.muscleStatus(MUSCLES, {}, false), today: '2026-11-30', doneToday: true });
  assert.equal(r.next.date, '2026-12-02');
});

// ---------- Tips ----------
test('sesiones de la semana y racha', () => {
  const w = (d) => ({ id: d, performed_on: d, exercises: [] });
  const ws = [w('2026-11-09'), w('2026-11-11'), w('2026-11-13'), w('2026-11-16'), w('2026-11-18'), w('2026-11-20'), w('2026-11-23')];
  assert.equal(sessionsInWeek(ws, '2026-11-25'), 1);
  assert.equal(weekStreak(ws, '2026-11-25', 3), 2); // semana actual no cumple: cuentan las 2 previas
  assert.equal(weekStreak([], '2026-11-25', 3), 0);
  assert.equal(weekStreak([...ws, w('2026-11-25'), w('2026-11-27')], '2026-11-27', 3), 3);
});

test('tips: faltantes, bajaste y estancados, entre 3 y 5', () => {
  const mk = (id, d, ex, sets) => ({ id, performed_on: d, exercises: [{ exercise_id: ex, sets }] });
  const ws = [
    mk('1', '2026-11-02', 'banca', [S(80, 8)]), mk('2', '2026-11-09', 'banca', [S(80, 8)]), mk('3', '2026-11-16', 'banca', [S(80, 8)]),
    mk('4', '2026-11-23', 'curl', [S(15, 10)]), mk('5', '2026-11-25', 'curl', [S(10, 10)]),
  ];
  const series = { pecho: { sets: 3, exercises: {} }, biceps: { sets: 5, exercises: {} }, cuadriceps: { sets: 10, exercises: {} }, abdomen: { sets: 6, exercises: {} }, gluteo: { sets: 6, exercises: {} } };
  const status = rec.muscleStatus(MUSCLES, series, true);
  const tips = generateTips({ status, workouts: ws, exercises: EX, plan: PLAN, today: '2026-11-26' });
  assert.ok(tips.length >= 3 && tips.length <= 5);
  const txt = tips.map((t) => t.text).join('\n');
  assert.match(txt, /Llevas 1 de 3 sesiones|Llevas 2 de 3 sesiones/);
  assert.match(txt, /Pecho va bajo: 3\/8/);
  assert.match(txt, /Bajaste vs la sesión anterior en Curl/);
  assert.ok(tips.some((t) => t.kind === 'streak'));
  const empty = generateTips({ status: rec.muscleStatus(MUSCLES, {}, false), workouts: [], exercises: EX, plan: PLAN, today: '2026-11-26' });
  assert.ok(empty.length >= 3);
});

// ---------- Generador de plan y peso corporal ----------
import * as gen from '../js/plan-generator.js';
import * as wt from '../js/weight.js';
import { readFileSync } from 'node:fs';
const REAL = JSON.parse(readFileSync(new URL('../data/exercises.json', import.meta.url), 'utf8'));
const REALBY = Object.fromEntries(REAL.map((e) => [e.id, e]));

test('goalFor', () => {
  assert.equal(gen.goalFor(70, 75), 'gain');
  assert.equal(gen.goalFor(80, 75), 'lose');
  assert.equal(gen.goalFor(80, 80.3), 'recomp');
});

test('generador: días por semana -> sesiones y días de la semana', () => {
  const expectDays = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 4, 5, 6], 6: [1, 2, 3, 4, 5, 6] };
  for (const d of [2, 3, 4, 5, 6]) {
    const p = gen.generatePlan({ days: d, goal: 'gain', exercises: REAL, start: '2026-11-25', weeks: 8 });
    assert.deepEqual(Object.keys(p.days).map(Number), expectDays[d]);
    assert.equal(p.phases.length, 8);
    assert.equal(p.start, '2026-11-23');
    for (const ph of p.phases) {
      assert.deepEqual(Object.keys(ph.sessions).map(Number), expectDays[d]);
      for (const s of Object.values(ph.sessions)) {
        assert.ok(s.exercises.length >= 4, `${d} días: sesión con pocos ejercicios`);
        for (const e of s.exercises) assert.ok(REALBY[e.id], `id inexistente ${e.id}`);
        assert.equal(new Set(s.exercises.map((e) => e.id)).size, s.exercises.length);
      }
    }
  }
});

test('generador: fases contiguas y semana de descarga', () => {
  const p = gen.generatePlan({ days: 3, goal: 'gain', exercises: REAL, start: '2026-11-23', weeks: 8 });
  p.phases.forEach((ph, i) => { if (i) assert.equal(calc.addDays(p.phases[i - 1].to, 1), ph.from); });
  const n = (ph) => Object.values(ph.sessions)[0].exercises[0].sets.length;
  assert.equal(n(p.phases[0]), 3);
  assert.ok(n(p.phases[1]) >= n(p.phases[0]));
  assert.ok(n(p.phases[2]) >= 4);
  assert.equal(n(p.phases[3]), 2);        // descarga
  assert.equal(n(p.phases[4]), 3);        // nuevo mesociclo
  assert.match(p.phases[3].name, /Descarga/);
});

test('generador: 3 días = split del dueño', () => {
  const p = gen.generatePlan({ days: 3, goal: 'recomp', exercises: REAL, start: '2026-11-23', weeks: 4 });
  const names = Object.values(p.phases[0].sessions).map((s) => s.name);
  assert.deepEqual(names, ['Pecho, bíceps y abdomen', 'Pierna', 'Espalda, hombro, trapecio y tríceps']);
  const prim = (s) => s.exercises.flatMap((e) => REALBY[e.id].primary);
  const [a, b, c] = Object.values(p.phases[0].sessions);
  assert.ok(prim(a).filter((m) => m === 'pecho').length >= 2 && prim(a).includes('biceps') && prim(a).includes('abdomen'));
  assert.ok(prim(b).filter((m) => m === 'cuadriceps').length >= 2);
  assert.ok(prim(c).includes('trapecio') && prim(c).includes('triceps'));
});

test('generador: reps y notas según meta; prefiere gimnasio', () => {
  const g = gen.generatePlan({ days: 4, goal: 'gain', exercises: REAL, start: '2026-11-23', weeks: 1 });
  const first = Object.values(g.phases[0].sessions)[0].exercises[0];
  assert.equal(first.reps, '6–10');
  assert.ok(gen.goalNotes('lose').join(' ').match(/pasos/) && gen.goalNotes('lose').join(' ').match(/déficit/i));
  assert.ok(gen.goalNotes('gain').join(' ').match(/superávit/i));
  const used = new Set();
  const pick = gen.pickExercises(REAL, 'pecho', 2, used);
  assert.equal(pick.length, 2);
  assert.ok(pick.every((e) => e.where.includes('gym')));
});

test('regenerar con otros días cambia el plan', () => {
  const a = gen.generatePlan({ days: 3, goal: 'gain', exercises: REAL, start: '2026-11-23', weeks: 2 });
  const b = gen.generatePlan({ days: 5, goal: 'gain', exercises: REAL, start: '2026-11-23', weeks: 2 });
  assert.notEqual(Object.keys(a.days).length, Object.keys(b.days).length);
  assert.equal(gen.planEndDate(a), '2026-12-06');
});

test('peso: promedios semanales y ritmo', () => {
  const e = [['2026-11-02', 80], ['2026-11-04', 80.2], ['2026-11-09', 80.5], ['2026-11-11', 80.7]].map(([d, w]) => ({ measured_on: d, weight_kg: w }));
  const w = wt.weeklyAverages(e);
  assert.deepEqual(w.map((x) => x.avg), [80.1, 80.6]);
  assert.equal(wt.weeklyChangePct(e), 0.62);
  assert.match(wt.weightTip(e, 'gain'), /demasiado rápido/);
  assert.match(wt.weightTip(e, 'lose'), /subió/);
  assert.match(wt.weightTip([{ measured_on: '2026-11-02', weight_kg: 80 }], 'gain'), /2 semanas/);
  assert.match(wt.weightTip([], 'gain'), /Registra tu peso/);
  const ok = [['2026-11-02', 80], ['2026-11-09', 80.3]].map(([d, w2]) => ({ measured_on: d, weight_kg: w2 }));
  assert.match(wt.weightTip(ok, 'gain'), /Ritmo ideal/);
  const fast = [['2026-11-02', 80], ['2026-11-09', 79]].map(([d, w2]) => ({ measured_on: d, weight_kg: w2 }));
  assert.match(wt.weightTip(fast, 'lose'), /demasiado rápido/);
});

test('tips incluyen consejo de peso', () => {
  const ws = [{ id: '1', performed_on: '2026-11-25', exercises: [] }];
  const tips = generateTips({ status: rec.muscleStatus(MUSCLES, {}, true), workouts: ws, exercises: EX, plan: PLAN, today: '2026-11-26', weightGoal: 'gain', weights: [] });
  assert.ok(tips.some((t) => t.kind === 'weight'));
  assert.ok(tips.length <= 5);
});

// ---------- Perfil ----------
import * as prof from '../js/profile.js';
test('validación de perfil: rangos', () => {
  const ok = { age: '28', sex: 'M', height_cm: '175', weight_kg: '80', goal_weight_kg: '75', days_per_week: '3' };
  const r = prof.validateProfileInput(ok, 2026);
  assert.ok(r.ok);
  assert.equal(r.values.birth_year, 1998);
  for (const [k, v] of [['age', '12'], ['age', '101'], ['age', '20.5'], ['sex', ''], ['height_cm', '119'], ['height_cm', '231'], ['weight_kg', '29'], ['weight_kg', '301'], ['goal_weight_kg', '10'], ['days_per_week', '1'], ['days_per_week', '7']]) {
    const bad = prof.validateProfileInput({ ...ok, [k]: v }, 2026);
    assert.ok(!bad.ok && bad.errors[k === 'age' ? 'age' : k], `${k}=${v} debería fallar`);
  }
  assert.ok(prof.validateProfileInput({ ...ok, age: '13', height_cm: '120', weight_kg: '30', goal_weight_kg: '300', days_per_week: '6' }, 2026).ok);
  assert.ok(prof.validateProfileInput({ ...ok, weight_kg: '' }, 2026, { needWeight: false }).ok);
  assert.ok(prof.profileComplete({ birth_year: 1998, sex: 'F', height_cm: 160, goal_weight_kg: 60, days_per_week: 4 }));
  assert.ok(!prof.profileComplete({ unit: 'kg' }));
  assert.equal(prof.ageOf({ birth_year: 1998 }, 2026), 28);
});

// ---------- Nutrición ----------
import * as nut from '../js/nutrition.js';
const FOOD = { id: 'pollo', name: 'Pechuga', kcal: 120, p: 22.5, c: 0, f: 2.6, fiber: 0, unit: { name: 'pieza', g: 200 } };
const RECIPE = { id: 'mex_tinga', name: 'Tinga', per_serving: { kcal: 300, p: 30, c: 20, f: 10, fiber: 4 } };

test('metas: Mifflin-St Jeor, factor, ajuste por meta y macros', () => {
  const prof = { sex: 'M', weight_kg: 80, height_cm: 175, age: 30, days_per_week: 3 };
  assert.equal(Math.round(nut.bmr(prof)), 1749);
  const m = nut.computeTargets(prof, 'recomp');
  assert.equal(m.tdee, Math.round(1748.75 * 1.45));
  assert.equal(m.kcal, m.tdee);
  assert.equal(m.p, 160); assert.equal(m.f, 72);
  assert.equal(m.fiber, Math.round(14 * m.kcal / 1000));
  assert.ok(Math.abs((4 * m.p + 4 * m.c + 9 * m.f) - m.kcal) < 15);
  const g = nut.computeTargets(prof, 'gain');
  assert.ok(Math.abs(g.kcal - (m.tdee + Math.min(m.tdee * 0.1, 300))) <= 1);
  const l = nut.computeTargets(prof, 'lose');
  assert.ok(Math.abs(l.kcal - Math.max(m.tdee * 0.8, 1748.75 * 1.1)) <= 1);
  assert.equal(l.p, 176);
  const f = nut.computeTargets({ ...prof, sex: 'F' }, 'recomp');
  assert.equal(f.bmr, Math.round(nut.bmr({ ...prof, sex: 'F' })));
  assert.ok(f.bmr < m.bmr);
  assert.equal(nut.computeTargets({ ...prof, days_per_week: 6 }, 'recomp').factor, 1.7);
  // suelo de TMB x 1.1 al bajar con poca actividad
  const small = nut.computeTargets({ sex: 'F', weight_kg: 50, height_cm: 150, age: 40, days_per_week: 2 }, 'lose');
  assert.ok(small.kcal >= Math.round(small.bmr * 1.1) - 1);
});

test('reparto por comida suma 100 % y respeta nombres', () => {
  for (const n of [3, 4, 5, 6]) assert.ok(Math.abs(nut.MEAL_DEFAULTS[n].shares.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const plan = nut.mealPlanOf({ meals_per_day: 4 });
  assert.deepEqual(plan.map((m) => m.name), ['Desayuno', 'Colación', 'Comida', 'Cena']);
  const t = nut.computeTargets({ sex: 'M', weight_kg: 80, height_cm: 175, age: 30, days_per_week: 3 }, 'recomp');
  const split = nut.splitMeals(t, plan);
  assert.ok(Math.abs(split.reduce((a, m) => a + m.kcal, 0) - t.kcal) <= 3);
  assert.equal(nut.mealPlanOf({ meals_per_day: 9 }).length, 6);
  assert.equal(nut.mealPlanOf({ meals_per_day: 4, meal_plan: [{ name: 'Almuerzo', time: '09:15' }] })[0].name, 'Almuerzo');
  assert.equal(nut.mealPlanOf({}).length, 4);
});

test('macros de alimento, receta y totales del registro', () => {
  assert.deepEqual(nut.macrosForFood(FOOD, 200), { kcal: 240, p: 45, c: 0, f: 5.2, fiber: 0 });
  assert.equal(nut.unitGrams(FOOD, 1.5), 300);
  assert.equal(nut.unitGrams({ unit: null }, 2), null);
  assert.equal(nut.macrosForRecipe(RECIPE, 1.5).kcal, 450);
  const a = nut.entryFromFood(FOOD, 150, { id: 'a', logged_on: '2026-11-26', meal_slot: 1 });
  const b = nut.entryFromRecipe(RECIPE, 2, { id: 'b', logged_on: '2026-11-26', meal_slot: 3 });
  assert.equal(a.kcal, 180); assert.equal(b.kcal, 600); assert.equal(b.servings, 2);
  const c = nut.rescaleEntry(b, 0.5);
  assert.equal(c.kcal, 300); assert.equal(c.servings, 1);
  const logs = [a, b, { ...a, id: 'c', logged_on: '2026-11-25' }];
  assert.deepEqual(nut.dayTotals(logs, '2026-11-26'), { kcal: 780, p: 93.8, c: 40, f: 23.9, fiber: 8 });
  assert.equal(nut.mealEntries(logs, '2026-11-26', 3).length, 1);
});

test('adherencia: kcal ±10 % y proteína ≥ 90 %', () => {
  const T = { kcal: 2000, p: 150, c: 200, f: 60, fiber: 28 };
  assert.ok(nut.dayAdheres({ kcal: 2100, p: 140 }, T));
  assert.ok(!nut.dayAdheres({ kcal: 2300, p: 150 }, T));
  assert.ok(!nut.dayAdheres({ kcal: 1700, p: 150 }, T));
  assert.ok(!nut.dayAdheres({ kcal: 2000, p: 130 }, T));
  const mk = (d, slot, kcal, p) => ({ id: d + slot, logged_on: d, meal_slot: slot, kcal, p, c: 0, f: 0, fiber: 0 });
  const logs = [mk('2026-11-26', 1, 1000, 80), mk('2026-11-26', 2, 1000, 70), mk('2026-11-25', 1, 800, 40)];
  const a = nut.adherence(logs, T, '2026-11-27', 14);
  assert.equal(a.days.length, 14);
  assert.equal(a.loggedDays, 2); assert.equal(a.okDays, 1); assert.equal(a.pct, 50); assert.equal(a.mealsLogged, 3);
  assert.equal(nut.adherence([], T, '2026-11-27').pct, null);
});

test('consejos de nutrición', () => {
  const T = { kcal: 2000, p: 150, c: 200, f: 60, fiber: 28 };
  const mk = (d, kcal, p) => ({ id: d, logged_on: d, meal_slot: 1, kcal, p, c: 0, f: 0, fiber: 0 });
  const low = [mk('2026-11-25', 2000, 100), mk('2026-11-26', 2000, 90), mk('2026-11-27', 2000, 150)];
  assert.match(nut.nutritionTips({ logs: low, targets: T, today: '2026-11-27', goal: 'gain' })[0].text, /Proteína baja en 2 de 3/);
  const over = [mk('2026-11-26', 2600, 160), mk('2026-11-27', 2500, 160)];
  assert.match(nut.nutritionTips({ logs: over, targets: T, today: '2026-11-27', goal: 'lose' })[0].text, /sobre tu meta/);
  const stuck = [mk('2026-11-26', 2000, 150), mk('2026-11-27', 2050, 150)];
  assert.match(nut.nutritionTips({ logs: stuck, targets: T, today: '2026-11-27', goal: 'lose', weightPct: 0.2 })[0].text, /el peso no baja/);
  assert.match(nut.nutritionTips({ logs: [], targets: T, today: '2026-11-27', goal: 'lose' })[0].text, /Registra lo que comes/);
  const tips = generateTips({ status: rec.muscleStatus(MUSCLES, {}, true), workouts: [{ id: '1', performed_on: '2026-11-25', exercises: [] }], exercises: EX, plan: PLAN, today: '2026-11-27', weights: [], weightGoal: 'lose', nutrition: { logs: over, targets: T } });
  assert.ok(tips.some((t) => t.kind === 'food') && tips.length <= 5);
});

// ---------- Unidades kg / lb ----------
import * as un from '../js/units.js';
test('unidades: conversión, redondeo y paso de sobrecarga', () => {
  assert.equal(un.toDisplay(60, 'kg'), 60);
  assert.equal(un.toDisplay(60, 'lb'), 132.5);            // 132.277 -> 0.5 más cercano
  assert.equal(un.toDisplay(100, 'lb'), 220.5);           // 220.462
  assert.equal(un.toDisplay(82.63, 'kg', 0.1), 82.6);
  assert.equal(un.toDisplay(82.63, 'lb', 0.1), 182.2);
  assert.equal(un.fromDisplay(135, 'lb'), 61.23);         // 2 decimales
  assert.equal(un.fromDisplay('62,5', 'kg'), 62.5);
  assert.equal(un.fromDisplay('', 'kg'), 0);
  // ida y vuelta: kg -> lb (0.5) -> kg se queda a menos de 0.25 lb
  for (const kg of [20, 42.5, 60, 87.5, 100, 142.5]) {
    const back = un.fromDisplay(un.toDisplay(kg, 'lb'), 'lb');
    assert.ok(Math.abs(back - kg) <= 0.25 * un.KG_PER_LB + 0.01, `${kg} -> ${back}`);
  }
  assert.equal(un.convertTyped('135', 'lb', 'kg'), '61');
  assert.equal(un.convertTyped('60', 'kg', 'lb'), '132.5');
  assert.equal(un.convertTyped('', 'kg', 'lb'), '');
  assert.equal(un.convertTyped('abc', 'kg', 'lb'), '');
  assert.equal(un.convertTyped('60', 'kg', 'kg'), '60');
  assert.equal(un.overloadStep('kg'), 2.5); assert.equal(un.overloadStep('lb'), 5);
  assert.equal(un.fmtWeight(60, 'lb'), '132.5 lb');
  assert.equal(un.normUnit('xx'), 'kg');
  assert.match(ov.overloadSuggestion([S(60, 10), S(60, 10)], '6–10', 'lb'), /Sube 5 lb/);
  assert.match(ov.overloadSuggestion([S(60, 10), S(60, 10)], '6–10', 'kg'), /Sube 2\.5 kg/);
});

// ---------- Enlaces de correo (confirmación / recuperación) ----------
import * as al from '../js/authlink.js';
test('parseAuthUrl: query, hash y errores', () => {
  const a = al.parseAuthUrl('?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired', '');
  assert.equal(a.error.code, 'otp_expired'); assert.equal(a.error.description, 'Email link is invalid or has expired'); assert.ok(a.touched);
  assert.equal(al.parseAuthUrl('?code=abc', '').code, 'abc');
  const h = al.parseAuthUrl('', '#access_token=a&refresh_token=b&type=recovery');
  assert.deepEqual(h.tokens, { access_token: 'a', refresh_token: 'b' }); assert.equal(h.type, 'recovery'); assert.ok(h.authHash);
  const he = al.parseAuthUrl('', '#error=access_denied&error_code=otp_expired&error_description=expired');
  assert.equal(he.error.code, 'otp_expired');
  const none = al.parseAuthUrl('', '#/track');
  assert.ok(!none.touched && !none.error && !none.code);
});
test('classifyAuthError', () => {
  assert.equal(al.classifyAuthError({ code: 'otp_expired' }), 'expired');
  assert.equal(al.classifyAuthError({ message: 'Email link is invalid or has expired' }), 'expired');
  assert.equal(al.classifyAuthError({ message: 'PKCE code verifier not found in storage' }), 'verifier');
  assert.equal(al.classifyAuthError({ message: 'invalid flow state, no valid flow state found' }), 'verifier');
  assert.equal(al.classifyAuthError({ message: 'Failed to fetch' }), 'generic');
  assert.match(al.linkNotice({ message: 'code verifier' }).text, /quedó confirmado/);
});

// ---------- Proteína en polvo ----------
const POWDER = { id: 'on_gold_std_choc', brand: 'Optimum Nutrition', product: 'Gold Standard 100% Whey', serving_g: 30.4, kcal: 120, p: 24, c: 3, f: 1, fiber: 1 };
test('scoops -> macros de proteína en polvo', () => {
  assert.deepEqual(nut.macrosForPowder(POWDER, 1), { kcal: 120, p: 24, c: 3, f: 1, fiber: 1 });
  assert.deepEqual(nut.macrosForPowder(POWDER, 1.5), { kcal: 180, p: 36, c: 4.5, f: 1.5, fiber: 1.5 });
  assert.equal(nut.macrosForPowder(POWDER, 0.5).p, 12);
  assert.equal(nut.macrosForPowder({ ...POWDER, fiber: undefined }, 2).fiber, 0);
  assert.equal(nut.gramsFromScoops(POWDER, 2), 60.8);
  assert.equal(nut.scoopsFromGrams(POWDER, 60.8), 2);
  assert.equal(nut.powderProteinPct(POWDER), 79);
  const e = nut.entryFromPowder(POWDER, 1.5, { id: 'x', logged_on: '2026-11-27', meal_slot: 2 });
  assert.equal(e.source, 'powder'); assert.equal(e.servings, 1.5); assert.equal(e.grams, 45.6); assert.equal(e.p, 36);
  assert.equal(e.label, 'Optimum Nutrition Gold Standard 100% Whey');
  assert.equal(nut.sumEntries([e, e]).p, 72);
  assert.equal(nut.rescaleEntry(e, 2 / 1.5).servings, 2);
});

// ---------- Unidad por ejercicio ----------
test('unidad por defecto de un ejercicio: la última usada, si no la del perfil', () => {
  const w = (id, d, ex, unit) => ({ id, performed_on: d, created_at: d + 'T10:00', exercises: [{ exercise_id: ex, sets: [{ weight_kg: 60, reps: 8, unit }] }] });
  const ws = [w('1', '2026-11-10', 'banca', 'kg'), w('2', '2026-11-17', 'banca', 'lb'), w('3', '2026-11-18', 'curl', 'kg')];
  assert.equal(un.resolveExerciseUnit(ws, 'banca', 'kg'), 'lb');   // la más reciente de banca
  assert.equal(un.resolveExerciseUnit(ws, 'curl', 'lb'), 'kg');
  assert.equal(un.resolveExerciseUnit(ws, 'sentadilla', 'lb'), 'lb'); // sin historial -> perfil
  assert.equal(un.resolveExerciseUnit([], 'x', 'kg'), 'kg');
  assert.equal(un.resolveExerciseUnit([{ id: 'o', performed_on: '2026-01-01', exercises: [{ exercise_id: 'x', sets: [{ weight_kg: 10, reps: 5 }] }] }], 'x', 'lb'), 'lb'); // datos viejos sin unidad
});
test('sin deriva: lb -> kg (2 decimales) -> lb muestra lo tecleado', () => {
  for (let lb = 5; lb <= 1000; lb += 0.5) assert.equal(un.toDisplay(un.fromDisplay(lb, 'lb'), 'lb'), lb, `${lb} lb`);
  assert.equal(un.toDisplay(un.fromDisplay(135, 'lb'), 'lb'), 135);
  assert.equal(un.fromDisplay(135, 'lb'), 61.23);
  for (let kg = 2.5; kg <= 400; kg += 2.5) assert.equal(un.toDisplay(un.fromDisplay(kg, 'kg'), 'kg'), kg);
});

test('validación de proteína personalizada', () => {
  const ok = { brand: 'Birdman', product: 'Falcon', serving_g: '33', kcal: '120', p: '24', c: '3', f: '1.5' };
  const r = nut.validateCustomPowder(ok);
  assert.ok(r.ok); assert.deepEqual(r.value, { brand: 'Birdman', product: 'Falcon', serving_g: 33, kcal: 120, p: 24, c: 3, f: 1.5 });
  for (const [k, v] of [['brand', ''], ['product', 'x'.repeat(61)], ['serving_g', '4'], ['serving_g', '101'], ['kcal', '1001'], ['p', '-1'], ['c', 'abc']]) assert.ok(!nut.validateCustomPowder({ ...ok, [k]: v }).ok, `${k}=${v}`);
  assert.ok(!nut.validateCustomPowder({ ...ok, serving_g: '30', p: '30', c: '10', f: '5' }).ok); // macros > scoop
  assert.equal(nut.MAX_CUSTOM_POWDERS, 10);
});

test('isSchemaError reconoce columnas/tablas ausentes de PostgREST', async () => {
  const { isSchemaError } = await import('../js/api.js').catch(() => ({}));
  if (!isSchemaError) return; // api.js depende del navegador en algunos entornos
  assert.ok(isSchemaError({ code: '42703', message: 'column profiles.custom_powders does not exist' }));
  assert.ok(isSchemaError({ code: 'PGRST205', message: "Could not find the table 'public.food_logs' in the schema cache" }));
  assert.ok(isSchemaError({ code: 'PGRST204', message: "Could not find the 'meal_plan' column of 'profiles' in the schema cache" }));
  assert.ok(!isSchemaError({ message: 'Failed to fetch' }));
});

test('drop sets: volumen, series efectivas, validación y texto', async () => {
  const c = await import('../js/calc.js');
  const s = { weight_kg: 60, reps: 8, drops: [{ weight_kg: 45, reps: 8, unit: 'kg' }, { weight_kg: 35, reps: 6, unit: 'kg' }] };
  assert.equal(c.setVolume(s), 60 * 8 + 45 * 8 + 35 * 6);
  assert.equal(c.setVolume({ weight_kg: 60, reps: 8 }), 480); // sin drops, igual que antes
  assert.equal(c.bestE1RM([s]), c.epley(60, 8)); // e1RM solo con la serie principal
  assert.equal(c.effectiveSetCount({ reps: 8 }), 1);
  assert.equal(c.effectiveSetCount({ reps: 8, drops: [{ reps: 5, weight_kg: 1 }] }), 1.5);
  assert.equal(c.effectiveSetCount(s), 2);
  assert.equal(c.effectiveSetCount({ reps: 8, drops: [1, 2, 3, 4].map(() => ({ reps: 5, weight_kg: 1 })) }), 2); // tope +1
  const exById = { x: { id: 'x', primary: ['m1'], secondary: ['m2'] } };
  const ms = c.muscleSeries([{ performed_on: '2026-01-05', exercises: [{ exercise_id: 'x', sets: [s, { weight_kg: 50, reps: 10 }] }] }], exById);
  assert.equal(ms.m1.sets, 3); assert.equal(ms.m2.sets, 1.5);
  assert.equal(c.validateDrops([]), null);
  assert.ok(c.validateDrops(Array.from({ length: 7 }, () => ({ weight_kg: 1, reps: 1 }))));
  assert.ok(c.validateDrops([{ weight_kg: -1, reps: 5 }]));
  assert.ok(c.validateDrops([{ weight_kg: 10, reps: 2.5 }]));
  assert.equal(c.describeSet(s, 'kg', (kg) => kg), '60 kg × 8 → drop 45 kg × 8 → 35 kg × 6');
  assert.equal(c.suggestDrop(60, 'kg'), 47.5); assert.equal(c.suggestDrop(135, 'lb'), 105); assert.equal(c.suggestDrop('', 'kg'), 0);
});

test('sesión: pasos +/- , descanso y progreso', async () => {
  const s = await import('../js/session.js');
  assert.equal(s.stepValue('60', 1, 2.5), '62.5'); assert.equal(s.stepValue('', 1, 2.5, { base: 57.5 }), '60');
  assert.equal(s.stepValue('0.1', 1, 0.2), '0.3'); assert.equal(s.stepValue('1', -1, 2.5), '0'); assert.equal(s.stepValue('abc', 1, 1), '1');
  assert.equal(s.stepValue('135', 1, s.weightStep('lb')), '140'); assert.equal(s.stepValue('999', 1, 5), '1000'); assert.equal(s.stepValue('1000', 1, 5), '1000');
  assert.equal(s.parseRest('2–3 min'), 150); assert.equal(s.parseRest('90 s'), 90); assert.equal(s.parseRest('2 min'), 120); assert.equal(s.parseRest(null), 90); assert.equal(s.parseRest(75), 75);
  let r = s.startRest(90, 1000);
  assert.equal(s.restLeft(r, 1000), 90); assert.equal(s.restLeft(r, 31000), 60); assert.ok(!s.restDone(r, 50000)); assert.ok(s.restDone(r, 91000));
  r = s.restAdd(r, 15, 31000); assert.equal(s.restLeft(r, 31000), 75); assert.equal(s.restLeft(r, 999999), 0);
  assert.equal(s.clock(75), '1:15'); assert.equal(s.clock(-3), '0:00');
  const ex = [{ sets: [{ done: true }, { done: true }] }, { sets: [{ done: true }, { done: false }] }, { sets: [{}] }];
  assert.deepEqual(s.setProgress(ex), { done: 3, total: 5 }); assert.equal(s.currentExercise(ex), 1);
  assert.equal(s.currentExercise([{ sets: [{ done: true }] }]), 0); assert.equal(s.currentExercise([]), -1);
});

test('buscador: sin espacios encuentra nombres con espacio (facepull)', async () => {
  const { searchExercises } = await import('../js/search.js');
  const list = [{ id: 'facepull', name: 'Face pull con cuerda', group: 'Hombro', equipment: 'Polea', keywords: [] }, { id: 'x', name: 'Press de banca', group: 'Pecho', equipment: 'Barra', keywords: [] }];
  assert.equal(searchExercises(list, { query: 'facepull' })[0]?.id, 'facepull');
  assert.equal(searchExercises(list, { query: 'face pull' })[0]?.id, 'facepull');
  assert.equal(searchExercises(list, { query: 'facepull' }).length, 1);
});

test('fotos de recetas: licencias y elección del resultado', async () => {
  const rp = await import('../js/recipe-photos.js');
  for (const ok of ['CC0', 'Public domain', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 2.0 DE', 'CC-BY-SA-4.0', 'PD']) assert.ok(rp.licenseOk(ok), ok);
  for (const bad of ['CC BY-NC 4.0', 'CC BY-ND 2.0', 'CC BY-NC-SA 3.0', 'Copyrighted free use', 'All rights reserved', '', undefined]) assert.ok(!rp.licenseOk(bad), String(bad));
  const page = (index, mime, lic, extra = {}) => ({ index, imageinfo: [{ mime, thumburl: `https://upload.wikimedia.org/x${index}.jpg`, descriptionshorturl: `https://commons.wikimedia.org/w/index.php?curid=${index}`, extmetadata: { LicenseShortName: { value: lic }, Artist: { value: '<a href="//x">Ana <b>Pérez</b></a>' } }, ...extra }] });
  const json = { query: { pages: { 11: page(3, 'image/jpeg', 'CC BY 4.0'), 12: page(1, 'image/svg+xml', 'CC0'), 13: page(2, 'image/png', 'CC BY-NC 2.0'), 14: page(4, 'image/webp', 'CC0') } } };
  const r = rp.pickPhoto(json); // índice 1 es svg, 2 es NC: gana el 3
  assert.equal(r.thumb, 'https://upload.wikimedia.org/x3.jpg'); assert.equal(r.author, 'Ana Pérez'); assert.equal(r.license, 'CC BY 4.0'); assert.match(r.page, /commons\.wikimedia\.org/);
  assert.equal(rp.pickPhoto({ query: { pages: { 1: page(1, 'image/jpeg', 'CC BY-NC 4.0') } } }), null);
  assert.equal(rp.pickPhoto({}), null);
  assert.equal(rp.pickPhoto({ query: { pages: { 1: { index: 1, imageinfo: [{ mime: 'image/jpeg', thumburl: 'https://evil.example/a.jpg', extmetadata: { LicenseShortName: { value: 'CC0' } } }] } } } }), null);
  assert.match(rp.searchUrl('pozole rojo'), /origin=%2A|origin=\*/); assert.match(rp.searchUrl('pozole rojo'), /gsrsearch=pozole\+rojo\+filetype%3Abitmap/);
});

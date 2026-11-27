import { el, fmtDate, fmtNum, openModal } from '../ui.js';
import { drawChart } from '../charts.js';
import { workoutVolume, bestE1RM, toDisplay, weeklySeries, exerciseVolume } from '../calc.js';
import { sessionsByDateAsc, today } from '../stats.js';
import { renderGrade } from './grade.js';

const chartBox = (title, canvasLabel) => {
  const canvas = el('canvas', { role: 'img', 'aria-label': canvasLabel });
  return { canvas, node: el('section', { class: 'card' }, el('h2', { text: title }), el('div', { class: 'chart-wrap' }, canvas)) };
};
const shortDate = (s) => s.slice(8) + '/' + s.slice(5, 7);

export async function render(ctx, root) {
  const unit = ctx.profile?.unit === 'lb' ? 'lb' : 'kg';
  root.append(el('h1', { text: 'Progreso' }));
  if (!ctx.workouts.length) { root.append(el('p', { class: 'card muted', text: 'Registra tu primera sesión para ver tus gráficas.' })); return; }
  const asc = sessionsByDateAsc(ctx.workouts);

  // 1. Volumen por sesión
  const c1 = chartBox('Volumen por sesión', 'Gráfica de volumen por sesión');
  root.append(c1.node);
  const last = asc.slice(-20);

  // 2. 1RM estimado por ejercicio
  const used = [...new Set(asc.flatMap((w) => w.exercises.map((e) => e.exercise_id)))].filter((id) => ctx.data.exById[id])
    .sort((a, b) => ctx.data.exById[a].name.localeCompare(ctx.data.exById[b].name, 'es'));
  const exSel = el('select', { class: 'input', 'aria-label': 'Ejercicio' }, used.map((id) => el('option', { value: id, text: ctx.data.exById[id].name })));
  const c2 = chartBox('1RM estimado (Epley)', 'Gráfica de 1RM estimado por ejercicio');
  c2.node.insertBefore(exSel, c2.node.children[1]);
  root.append(c2.node);

  // 3. Series semanales por músculo
  const mSel = el('select', { class: 'input', 'aria-label': 'Músculo' }, ctx.data.muscles.map((m) => el('option', { value: m.id, text: m.name })));
  const c3 = chartBox('Series semanales por músculo', 'Gráfica de series semanales por músculo');
  c3.node.insertBefore(mSel, c3.node.children[1]);
  root.append(c3.node);

  const d1 = () => drawChart(c1.canvas, { type: 'bar', labels: last.map((w) => shortDate(w.performed_on)), yTitle: unit,
    datasets: [{ label: `Volumen (${unit})`, data: last.map((w) => Math.round(toDisplay(workoutVolume(w), unit))) }] });
  const d2 = () => {
    const rows = asc.map((w) => ({ w, ex: w.exercises.find((e) => e.exercise_id === exSel.value) })).filter((r) => r.ex);
    drawChart(c2.canvas, { type: 'line', labels: rows.map((r) => shortDate(r.w.performed_on)), yTitle: unit,
      datasets: [{ label: `1RM est. (${unit})`, data: rows.map((r) => toDisplay(bestE1RM(r.ex.sets), unit)) }] });
  };
  const d3 = () => {
    const m = ctx.data.muscleById[mSel.value];
    const rows = weeklySeries(ctx.workouts, ctx.data.exById, m.id, 8, today());
    drawChart(c3.canvas, { type: 'bar', labels: rows.map((r) => shortDate(r.week)), yTitle: 'series',
      datasets: [{ label: 'Series efectivas', data: rows.map((r) => r.sets) }, { label: `Objetivo (${m.target_sets})`, type: 'line', data: rows.map(() => m.target_sets), pointRadius: 0, borderDash: [6, 4] }] });
  };
  exSel.addEventListener('change', d2); mSel.addEventListener('change', d3);
  requestAnimationFrame(() => { d1(); d2(); d3(); });

  // Historial
  const hist = el('ul', { class: 'list' });
  [...ctx.workouts].slice(0, 30).forEach((w) => {
    hist.append(el('li', {}, el('button', { class: 'pick', type: 'button', on: { click: () => openSession(ctx, w, unit) } },
      el('span', { class: 'grow' }, el('strong', { text: `${fmtDate(w.performed_on)}${w.pending ? ' · pendiente de subir' : ''}` }),
        el('span', { class: 'muted small block', text: `${w.plan_day || 'Sesión libre'} · ${w.exercises.length} ejercicios · ${fmtNum(toDisplay(workoutVolume(w), unit))} ${unit}` })),
      el('span', { class: 'plus', 'aria-hidden': 'true', text: '›' }))));
  });
  root.append(el('section', { class: 'card' }, el('h2', { text: 'Historial' }), hist));
}

function openSession(ctx, w, unit) {
  const body = el('div', {}, renderGrade(ctx, w), el('h3', { text: 'Series' }),
    w.exercises.map((e) => el('div', { class: 'detail-ex' }, el('strong', { text: ctx.data.exById[e.exercise_id]?.name || e.exercise_id }),
      el('div', { class: 'muted small', text: e.sets.map((s) => `${toDisplay(s.weight_kg, unit)}×${s.reps}${s.rir !== null ? ` (RIR ${s.rir})` : ''}`).join('  ·  ') + `  —  vol. ${fmtNum(toDisplay(exerciseVolume(e), unit))} ${unit}`}))),
    w.notes ? el('p', { class: 'muted', text: `Notas: ${w.notes}` }) : null);
  openModal(`Sesión del ${fmtDate(w.performed_on)}`, body);
}

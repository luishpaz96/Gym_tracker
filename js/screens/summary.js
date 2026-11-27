// Summary: mapa semanal con semáforo, peso corporal, consejos y gráficas.
import { el, toast, fmtNum } from '../ui.js';
import { weekStatus, today, targetsOf } from '../stats.js';
import { adherence } from '../nutrition.js';
import { generateTips } from '../tips.js';
import { drawChart } from '../charts.js';
import { weeklyAverages } from '../weight.js';
import { weekStart } from '../calc.js';
import { goalOf } from '../planctl.js';
import { LIMITS } from '../profile.js';
import * as body from './bodymap_panel.js';
import * as charts from './charts_panel.js';

const short = (s) => s.slice(8) + '/' + s.slice(5, 7);

function weightCard(ctx) {
  const goalKg = ctx.profile?.goal_weight_kg;
  const card = el('section', { class: 'card' }, el('h2', { text: 'Peso corporal' }));
  const last = ctx.weights[ctx.weights.length - 1];
  card.append(el('p', { class: 'muted', text: last ? `Actual: ${fmtNum(last.weight_kg, 1)} kg${goalKg ? ` · Meta: ${fmtNum(goalKg, 1)} kg` : ''}` : 'Aún no registras tu peso.' }));
  const date = el('input', { class: 'input', type: 'date', value: today(), max: today(), min: '2000-01-01', 'aria-label': 'Fecha del peso' });
  const w = el('input', { class: 'input', type: 'text', inputmode: 'decimal', placeholder: 'kg', maxlength: 6, 'aria-label': 'Peso en kg', autocomplete: 'off' });
  const btn = el('button', { class: 'btn primary', type: 'button' }, 'Registrar peso');
  btn.addEventListener('click', async () => {
    const kg = Number(w.value.replace(',', '.'));
    if (!Number.isFinite(kg) || kg < LIMITS.weight[0] || kg > LIMITS.weight[1]) return toast('Peso entre 30 y 300 kg.', 'bad');
    if (!date.value || date.value > today()) return toast('Elige una fecha válida.', 'bad');
    btn.disabled = true;
    try { await ctx.api.addBodyWeight(date.value, Math.round(kg * 10) / 10); ctx.weights = await ctx.api.listBodyWeights(); toast('Peso registrado'); location.reload(); }
    catch { toast('No se pudo guardar el peso.', 'bad'); btn.disabled = false; }
  });
  card.append(el('div', { class: 'weight-form' }, date, w, btn));
  if (ctx.weights.length) {
    const rows = ctx.weights.slice(-90);
    const avg = Object.fromEntries(weeklyAverages(ctx.weights).map((a) => [a.week, a.avg]));
    const canvas = el('canvas', { role: 'img', 'aria-label': 'Gráfica de peso corporal con promedio semanal y meta' });
    card.append(el('div', { class: 'chart-wrap' }, canvas));
    const datasets = [{ label: 'Peso (kg)', data: rows.map((r) => r.weight_kg) }, { label: 'Promedio semanal', data: rows.map((r) => avg[weekStart(r.measured_on)]), pointRadius: 0, borderWidth: 3 }];
    if (goalKg) datasets.push({ label: `Meta (${fmtNum(goalKg, 1)})`, data: rows.map(() => goalKg), pointRadius: 0, borderDash: [6, 4], borderWidth: 2 });
    requestAnimationFrame(() => drawChart(canvas, { type: 'line', labels: rows.map((r) => short(r.measured_on)), datasets, yTitle: 'kg', zero: false }));
  }
  return card;
}

function nutritionCard(ctx) {
  const t = targetsOf(ctx);
  if (!t) return null;
  const a = adherence(ctx.foodLogs, t, today(), 14);
  const card = el('section', { class: 'card' }, el('h2', { text: 'Alimentación (14 días)' }));
  if (!a.loggedDays) { card.append(el('p', { class: 'muted', text: 'Aún no registras comidas. Hazlo en Comida y aquí verás tu avance.' })); return card; }
  const stat = (v, l) => el('div', { class: 'stat' }, el('strong', { text: v }), l);
  card.append(el('div', { class: 'stat-row' }, stat(`${a.pct}%`, 'adherencia'), stat(`${a.okDays}/${a.loggedDays}`, 'días en meta'), stat(String(a.mealsLogged), 'comidas')),
    el('p', { class: 'muted small', text: 'Día en meta: calorías dentro de ±10 % y proteína ≥ 90 % de tu objetivo.' }));
  const mk = (title, key, target, unit) => {
    const canvas = el('canvas', { role: 'img', 'aria-label': `Gráfica de ${title} contra tu meta` });
    card.append(el('h3', { text: title }), el('div', { class: 'chart-wrap short' }, canvas));
    requestAnimationFrame(() => drawChart(canvas, { type: 'bar', labels: a.days.map((d) => short(d.date)), yTitle: unit,
      datasets: [{ label: title, data: a.days.map((d) => Math.round(d.tot[key])) }, { label: `Meta (${target})`, type: 'line', data: a.days.map(() => target), pointRadius: 0, borderDash: [6, 4] }] }));
  };
  mk('Calorías', 'kcal', t.kcal, 'kcal'); mk('Proteína', 'p', t.p, 'g');
  return card;
}

export async function render(ctx, root) {
  root.append(el('h1', { text: 'Summary' }));
  await body.render(ctx, root);
  root.append(weightCard(ctx));
  const nc = nutritionCard(ctx); if (nc) root.append(nc);
  const tips = generateTips({ status: weekStatus(ctx), workouts: ctx.workouts, exercises: ctx.data.exercises, plan: ctx.plan, today: today(),
    weights: ctx.weights, weightGoal: ctx.profile?.goal_weight_kg ? goalOf(ctx.profile, ctx.weights) : null,
    nutrition: targetsOf(ctx) ? { logs: ctx.foodLogs, targets: targetsOf(ctx) } : null });
  root.append(el('section', { class: 'card' }, el('h2', { text: 'Consejos' }),
    el('ul', { class: 'tips' }, tips.map((t) => el('li', { class: `tip tip-${t.kind}`, text: t.text })))));
  await charts.render(ctx, root);
}

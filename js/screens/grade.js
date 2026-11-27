// Muestra la calificación de una sesión (nota global + por ejercicio).
import { el, fmtNum } from '../ui.js';
import { gradeSession } from '../grading.js';
import { workoutVolume, toDisplay } from '../calc.js';

const ICON = { up: '▲', same: '＝', down: '▼', new: '★' };

export function renderGrade(ctx, workout, { compact = false } = {}) {
  const g = gradeSession(ctx.workouts, workout);
  const unit = ctx.profile?.unit === 'lb' ? 'lb' : 'kg';
  const head = el('div', { class: 'grade-head' },
    el('div', { class: `grade-letter g-${g.overall.letter || 'none'}`, 'aria-label': g.overall.letter ? `Nota ${g.overall.letter}` : 'Sin nota' }, g.overall.letter || '–'),
    el('div', {}, el('strong', { text: `Volumen: ${fmtNum(toDisplay(workoutVolume(workout), unit))} ${unit}` }), el('p', { class: 'muted small', text: g.overall.text })));
  if (compact) return head;
  return el('div', {}, head, el('ul', { class: 'list' }, g.items.map((it) => {
    const name = ctx.data.exById[it.exercise_id]?.name || it.exercise_id;
    const detail = it.status === 'new' ? `1RM est. ${fmtNum(toDisplay(it.e1rm, unit), 1)} ${unit}`
      : `1RM est. ${fmtNum(toDisplay(it.prevE1rm, unit), 1)} → ${fmtNum(toDisplay(it.e1rm, unit), 1)} ${unit} · vol. ${fmtNum(toDisplay(it.prevVolume, unit))} → ${fmtNum(toDisplay(it.volume, unit))}`;
    return el('li', { class: 'list-item' }, el('span', { class: `badge s-${it.status}`, text: `${ICON[it.status]} ${it.label}` }),
      el('div', { class: 'grow' }, el('strong', { text: name }), el('div', { class: 'muted small', text: detail })));
  })));
}

import { el, fmtDate } from '../ui.js';
import { sessionFor } from '../recommend.js';
import { today, doneToday } from '../stats.js';
import { openTechnique } from '../technique.js';
import { renderRecs } from './recs.js';
import { renderGrade } from './grade.js';
import { startDraftFromPlan, clearDraft } from './registrar.js';

export async function render(ctx, root) {
  const t = today();
  const ses = sessionFor(ctx.data.plan, t);
  const done = doneToday(ctx);
  root.append(el('h1', { text: 'Hoy' }), el('p', { class: 'muted', text: fmtDate(t) }));

  const card = el('section', { class: 'card' });
  if (ses) {
    card.append(el('p', { class: 'eyebrow', text: ses.phase.name }), el('h2', { text: ses.session.name }));
    card.append(el('ul', { class: 'list' }, ses.session.exercises.map((pe) => {
      const ex = ctx.data.exById[pe.id];
      if (!ex) return null;
      return el('li', { class: 'list-item' },
        el('div', { class: 'grow' }, el('strong', { text: ex.name }),
          el('div', { class: 'muted small', text: `${pe.sets.length} × ${pe.reps}${pe.rest ? ` · descanso ${pe.rest}` : ''}` })),
        el('button', { class: 'btn small', type: 'button', 'aria-label': `Técnica de ${ex.name}`, on: { click: () => openTechnique(ex.id) } }, 'Técnica'));
    })));
    card.append(el('button', { class: 'btn primary block', type: 'button', on: { click: () => { startDraftFromPlan(ctx, ses); location.hash = '#/registrar'; } } },
      done ? 'Registrar otra sesión' : 'Empezar entrenamiento'));
  } else {
    card.append(el('h2', { text: 'Día de descanso' }), el('p', { class: 'muted', text: 'Hoy no hay sesión en tu plan. Puedes registrar un entrenamiento libre.' }),
      el('button', { class: 'btn block', type: 'button', on: { click: () => { clearDraft(); location.hash = '#/registrar'; } } }, 'Registrar entrenamiento libre'));
  }
  root.append(card);

  const last = ctx.workouts[0];
  if (last) {
    root.append(el('section', { class: 'card' }, el('h2', { text: 'Última sesión' }),
      el('p', { class: 'muted', text: `${fmtDate(last.performed_on)}${last.plan_day ? ` · ${last.plan_day}` : ''}` }), renderGrade(ctx, last, { compact: true })));
  } else {
    root.append(el('section', { class: 'card' }, el('h2', { text: 'Bienvenido' }), el('p', { text: 'Aún no tienes entrenamientos. Empieza el primero y aquí verás tu calificación y progreso.' })));
  }
  root.append(renderRecs(ctx));
}

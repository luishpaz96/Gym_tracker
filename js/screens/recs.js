// Tarjeta de recomendaciones para la siguiente sesión (se usa en Hoy y Cuerpo).
import { el } from '../ui.js';
import { fmtDate } from '../ui.js';
import { recommendations } from '../stats.js';
import { openTechnique } from '../technique.js';

export function renderRecs(ctx) {
  const r = recommendations(ctx);
  const box = el('section', { class: 'card' }, el('h2', { text: 'Para tu siguiente sesión' }));
  if (r.next) box.append(el('p', { class: 'muted' }, `${r.next.dayLabel} ${fmtDate(r.next.date)} · ${r.next.session.name}`));
  else box.append(el('p', { class: 'muted', text: 'No hay una sesión del plan próxima; estas son sugerencias según tus músculos.' }));
  if (!r.items.length) { box.append(el('p', { text: 'Sin sugerencias por ahora.' })); return box; }
  box.append(el('ul', { class: 'list' }, r.items.map((it) => el('li', { class: 'list-item' },
    el('div', { class: 'grow' },
      el('strong', { text: it.exercise.name }),
      el('div', { class: 'muted small' }, `${it.sets} series${it.reps ? ` · ${it.reps} reps` : ''}${it.rest ? ` · descanso ${it.rest}` : ''}`),
      el('div', { class: `chip-src ${it.source}` }, it.reason)),
    el('button', { class: 'btn small', type: 'button', 'aria-label': `Técnica de ${it.exercise.name}`, on: { click: () => openTechnique(it.exercise.id) } }, 'Técnica')))));
  return box;
}

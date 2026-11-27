// Guía de primera vez: 3 tarjetas (Track, Comida, Summary). Se muestra una vez por usuario tras el onboarding.
import { el, icon, pageHead } from '../ui.js';
import { lsGet, lsSet } from '../api.js';

export const introKey = (uid) => `gt_intro_${uid || 'local'}`;
export const introSeen = (uid) => !!lsGet(introKey(uid), false);

export function renderIntro(root, uid, done) {
  const card = (ic, title, text) => el('div', { class: 'intro-card' }, el('div', { class: 'row gap' }, icon(ic), el('strong', { text: title })), el('p', { class: 'muted', text }));
  const finish = () => { lsSet(introKey(uid), true); done(); };
  root.append(el('section', { class: 'card intro' },
    pageHead('¡Listo! Así se usa', 'Tres pasos y ya estás dentro.'),
    el('div', { class: 'intro-cards' },
      card('track', 'Track', 'Toca "Empezar entrenamiento", elige ejercicios y marca cada serie como hecha. Te avisamos cuando termine el descanso.'),
      card('comida', 'Comida', 'Registra lo que comes por comida y compara con tus metas de calorías y proteína.'),
      card('summary', 'Summary', 'Ve tu semana en el mapa del cuerpo, tu peso y consejos para mejorar.')),
    el('button', { class: 'btn primary big block', type: 'button', on: { click: finish } }, 'Entendido'),
    el('button', { class: 'link center', type: 'button', on: { click: finish } }, 'Omitir')));
}

// "API" de técnica: animación (free-exercise-db, Unlicense) + puntos clave + enlace a Fitwill.
// Fitwill no tiene API pública ni permite incrustar su video: solo se abre su página en otra pestaña.
import { loadData } from './data.js';
import { el, openModal } from './ui.js';

const FRAMES_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';

export function safeHttpsUrl(u) {
  try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; }
}

export async function getTechnique(exerciseId) {
  const { exById } = await loadData();
  const ex = exById[exerciseId];
  if (!ex) return null;
  const id = ex.fedb && /^[A-Za-z0-9_\-().']+$/.test(ex.fedb) ? ex.fedb : null;
  return {
    frames: id ? [`${FRAMES_BASE}${id}/0.jpg`, `${FRAMES_BASE}${id}/1.jpg`] : [],
    cues: ex.cues || [],
    fitwillUrl: ex.fitwill ? safeHttpsUrl(ex.fitwill) : null,
  };
}

export function buildAnimation(frames, alt) {
  if (!frames.length) return el('div', { class: 'anim empty' }, 'Sin animación disponible');
  const imgs = frames.map((src, i) => el('img', { src, alt: i === 0 ? alt : '', loading: 'lazy', class: i === 0 ? 'on' : '', referrerpolicy: 'no-referrer' }));
  const box = el('div', { class: 'anim', role: 'img', 'aria-label': alt }, imgs);
  let i = 0;
  const timer = setInterval(() => {
    if (!box.isConnected) { clearInterval(timer); return; }
    imgs[i].classList.remove('on'); i = (i + 1) % imgs.length; imgs[i].classList.add('on');
  }, 800);
  imgs.forEach((im) => im.addEventListener('error', () => { box.classList.add('empty'); box.textContent = 'No se pudo cargar la animación (¿sin conexión?)'; clearInterval(timer); }));
  return box;
}

export async function openTechnique(exerciseId) {
  const { exById, muscleById } = await loadData();
  const ex = exById[exerciseId];
  if (!ex) return;
  const t = await getTechnique(exerciseId);
  const names = (ids) => (ids || []).map((m) => muscleById[m]?.name || m).join(', ') || '—';
  const body = el('div', { class: 'tech' },
    buildAnimation(t.frames, `Animación de ${ex.name}`),
    el('p', { class: 'muted small' }, `${ex.group} · ${ex.equipment} · ${(ex.where || []).map((w) => (w === 'gym' ? 'Gimnasio' : 'Casa')).join(' / ')}`),
    el('p', {}, el('strong', { text: 'Principal: ' }), names(ex.primary)),
    el('p', {}, el('strong', { text: 'Secundarios: ' }), names(ex.secondary)),
    el('h3', { text: 'Técnica' }),
    el('ul', { class: 'cues' }, t.cues.map((c) => el('li', { text: c }))),
    ex.alt ? el('p', {}, el('strong', { text: 'Alternativa: ' }), ex.alt) : null,
    t.fitwillUrl ? el('a', { class: 'btn primary block', href: t.fitwillUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Ver video en Fitwill') : null,
    el('p', { class: 'muted tiny' }, 'Animación: free-exercise-db (dominio público).'));
  openModal(ex.name, body);
}

// "API" de técnica: animación (free-exercise-db, Unlicense) + puntos clave + enlace a Fitwill.
// Fitwill no tiene API pública ni permite incrustar su video: solo se abre su página en otra pestaña.
import { loadData } from './data.js';
import { el, openModal, icon } from './ui.js';

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

// Botón ▶ (≥44 px) que abre la animación; no propaga el clic a la fila que lo contiene.
export function playButton(exerciseId, name) {
  return el('button', { class: 'play-btn', type: 'button', 'aria-label': `Ver animación de ${name}`, on: { click: (e) => { e.stopPropagation(); e.preventDefault(); openTechnique(exerciseId); } } }, icon('video'));
}

// Animación que arranca sola, con botón de pausa / reproducir.
export function buildAnimation(frames, alt) {
  if (!frames.length) return el('div', { class: 'anim empty' }, 'Sin animación disponible');
  const imgs = frames.map((src, i) => el('img', { src, alt: i === 0 ? alt : '', loading: 'lazy', class: i === 0 ? 'on' : '', referrerpolicy: 'no-referrer' }));
  const box = el('div', { class: 'anim', role: 'img', 'aria-label': alt }, imgs);
  const toggle = el('button', { class: 'btn small block', type: 'button', 'aria-pressed': 'true' }, 'Pausar');
  let i = 0, timer = null;
  const tick = () => { if (!box.isConnected) { clearInterval(timer); return; } imgs[i].classList.remove('on'); i = (i + 1) % imgs.length; imgs[i].classList.add('on'); };
  const play = () => { clearInterval(timer); timer = setInterval(tick, 800); toggle.textContent = 'Pausar'; toggle.setAttribute('aria-pressed', 'true'); };
  const pause = () => { clearInterval(timer); timer = null; toggle.textContent = 'Reproducir'; toggle.setAttribute('aria-pressed', 'false'); };
  toggle.addEventListener('click', () => (timer ? pause() : play()));
  imgs.forEach((im) => im.addEventListener('error', () => { box.classList.add('empty'); box.textContent = 'No se pudo cargar la animación (¿sin conexión?)'; pause(); toggle.disabled = true; }));
  play();
  return el('div', { class: 'anim-wrap' }, box, toggle);
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
  const m = openModal(ex.name, body);
  body.append(el('button', { class: 'btn block', type: 'button', on: { click: () => m.close() } }, 'Cerrar'));
}

// Silueta humana (frente / espalda) en SVG inline: un <path> por músculo, con lado izquierdo y derecho.
// Los trazos se escriben para un lado (x < 100) y se espejan automáticamente (x -> 200 - x).
import { svg } from './ui.js';

const mirror = (d) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_, x, y) => `${200 - Number(x)} ${y}`);
const both = (d) => `${d} ${mirror(d)}`;

// Contorno (no interactivo)
const BASE = [
  'M100 52 L74 58 C62 62 58 74 58 90 L62 130 C64 150 70 170 72 192 L72 200 C70 230 70 255 76 275 L80 345 L78 372 L96 372 L98 345 L99 275 L99 200 Z', // tronco + pierna
  'M60 70 C50 74 46 90 44 108 L40 132 L38 175 L36 192 L50 194 L56 176 L60 132 L66 100 Z', // brazo
];
const HEAD = { cx: 100, cy: 30, rx: 15, ry: 19 };

const FRONT = {
  trapecio: 'M98 50 L86 56 L74 60 L82 70 L98 66 Z',
  hombro_frontal: 'M70 70 C64 68 58 72 58 80 L58 94 L66 94 C70 86 72 78 70 70 Z',
  hombro_lateral: 'M56 72 C50 76 48 86 50 94 L57 94 C58 86 58 78 56 72 Z',
  pecho: 'M98 70 C88 66 78 68 72 74 C70 84 74 94 84 98 C92 100 98 98 98 92 Z',
  biceps: 'M56 98 C52 102 49 112 50 126 L60 126 C62 116 64 106 62 98 Z',
  antebrazo: 'M46 132 L58 132 L56 174 L44 174 Z',
  abdomen: 'M98 102 L86 102 C84 120 84 140 88 160 L98 168 Z',
  oblicuos: 'M84 102 L74 104 C72 120 72 140 76 160 L86 160 C82 140 82 120 84 102 Z',
  aductores: 'M99 202 L89 200 C91 224 92 244 90 262 L99 248 Z',
  cuadriceps: 'M88 200 L74 196 C72 222 74 248 79 268 L90 268 C93 244 91 222 88 200 Z',
  pantorrilla: 'M80 284 L94 284 L91 340 L83 340 Z',
};
const BACK = {
  trapecio: 'M98 50 L76 60 L84 80 L98 98 Z',
  hombro_posterior: 'M68 66 C60 66 56 72 55 80 L58 94 L68 92 Z',
  hombro_lateral: 'M56 72 C50 76 48 86 50 94 L56 94 C57 86 57 78 56 72 Z',
  espalda_media: 'M98 100 L86 90 L82 106 L88 124 L98 126 Z',
  dorsales: 'M82 108 L72 100 C68 116 70 136 78 152 L88 152 L86 128 Z',
  lumbar: 'M98 128 L88 126 L88 154 L92 168 L98 170 Z',
  triceps: 'M56 98 C52 102 49 112 50 126 L60 126 C62 116 64 106 62 98 Z',
  antebrazo: 'M46 132 L58 132 L56 174 L44 174 Z',
  gluteo: 'M98 172 L76 176 C72 190 76 204 90 206 L98 204 Z',
  femoral: 'M90 210 L75 208 C73 232 75 256 80 272 L92 272 C94 250 94 230 90 210 Z',
  pantorrilla: 'M80 282 C76 300 80 326 84 340 L92 340 C96 320 96 298 94 282 Z',
};
const SHAPES = { front: FRONT, back: BACK };

export function buildBodyMap(view, muscleById, { onSelect, statusOf }) {
  const root = svg('svg', { viewBox: '20 4 160 380', class: 'bodymap', role: 'group', 'aria-label': view === 'front' ? 'Cuerpo, vista frontal' : 'Cuerpo, vista posterior' });
  const g = svg('g', { class: 'base' });
  g.append(svg('ellipse', { ...HEAD, class: 'silhouette' }));
  g.append(svg('rect', { x: 92, y: 46, width: 16, height: 12, class: 'silhouette' }));
  BASE.forEach((d) => g.append(svg('path', { d: both(d), class: 'silhouette' })));
  root.append(g);
  const parts = svg('g', { class: 'muscles' });
  const nodes = {};
  for (const [id, d] of Object.entries(SHAPES[view])) {
    const m = muscleById[id];
    if (!m) continue;
    const p = svg('path', { d: both(d), class: 'muscle', 'data-muscle': id, tabindex: '0', role: 'button' });
    const activate = () => onSelect(id);
    p.addEventListener('click', activate);
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    p.append(svg('title', {}, m.name));
    nodes[id] = p; parts.append(p);
  }
  root.append(parts);
  const api = {
    root,
    paint(statusMap) {
      for (const [id, p] of Object.entries(nodes)) {
        const s = statusMap[id];
        p.setAttribute('class', `muscle st-${s?.status || 'gray'}`);
        p.setAttribute('aria-label', `${muscleById[id].name}: ${s ? `${s.sets} de ${s.target} series, ${statusOf(s.status)}` : 'sin datos'}`);
      }
    },
    select(id) { for (const [k, p] of Object.entries(nodes)) p.classList.toggle('sel', k === id); },
  };
  return api;
}
export const MAPPED = { front: Object.keys(FRONT), back: Object.keys(BACK) };

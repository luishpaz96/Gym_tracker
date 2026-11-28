// Mapa muscular (frente / espalda) en SVG inline, dibujo original: silueta color piel con un <path> por músculo.
// Cada trazo se escribe para el lado izquierdo del espectador (x < 100) y se espeja (x -> 200 - x).
// Solo se usan comandos M L C Z con pares de coordenadas, para que el espejo sea exacto.
import { svg } from './ui.js';

const mirror = (d) => d.replace(/(\d+(?:\.\d+)?) (\d+(?:\.\d+)?)/g, (_, x, y) => `${+(200 - Number(x)).toFixed(2)} ${y}`);
const both = (d) => `${d} ${mirror(d)}`;

// Silueta: cuello, tronco, brazo abierto y pierna (un lado) + mano y pie
const BODY = 'M100 44 L92 44 C91 50 88 54 80 57 C72 59 66 61 62 63 C54 66 50 74 50 86 C48 100 46 114 44 128 C42 144 40 156 37 168 L49 168 C51 156 54 142 57 128 C59 118 62 108 65 100 C67 112 71 124 72 134 C72 146 70 158 68 172 C66 190 66 206 70 222 C72 232 73 240 72 248 C70 258 70 270 72 284 C74 294 76 300 76 308 L68 318 C65 323 66 326 71 326 L88 326 C90 322 88 312 87 306 C88 296 90 280 91 268 C92 258 94 250 94 244 C95 230 97 210 98 196 C99 188 99.5 180 100 172 Z';
const HAND = 'M37 168 L49 168 C52 176 52 184 52 190 C53 196 52 204 49 207 C46 205 45 200 44 197 C43 203 42 211 39 213 C36 209 35 201 35 195 C32 197 30 193 28 187 C27 183 30 181 33 183 C34 177 36 172 37 168 Z';

const FRONT = {
  trapecio: 'M92 47 C86 53 74 57 63 63 C70 68 80 70 91 68 Z',
  hombro_lateral: 'M62 65 C55 64 50 70 50 80 C50 90 52 98 56 102 C58 96 60 88 60 80 C60 74 61 69 62 65 Z',
  hombro_frontal: 'M63 65 C68 64 72 68 70 76 C68 86 66 94 66 98 C62 100 59 102 57 102 C59 96 61 88 61 80 C61 74 62 69 63 65 Z',
  pecho: 'M98 70 C88 66 77 70 71 77 C67 85 67 93 69 98 C77 104 91 104 98 100 Z',
  biceps: 'M54 105 C58 101 63 101 65 105 C64 113 60 122 57 127 L47 127 C49 118 50 111 54 105 Z',
  antebrazo: 'M47 131 L58 131 C56 142 52 156 48 167 L38 167 C41 154 44 142 47 131 Z',
  abdomen: 'M90 106 L98.6 106 L98.6 115 L89.5 115 Z M89.5 117 L98.6 117 L98.6 127 L89 127 Z M89 129 L98.6 129 L98.6 139 L89 139 Z M89.5 141 L98.6 141 L98.6 152 C94 153 91 151 89.5 149 Z',
  oblicuos: 'M70 104 L87 107 L87 150 C83 157 77 161 70 160 C71 150 72 138 72 130 C71 120 70 112 70 104 Z',
  cuadriceps: 'M68 173 C74 171 80 173 82 177 C82 200 82 224 80 238 C76 242 72 242 71 240 C68 224 66 196 68 173 Z M84 178 C88 178 90 182 90 188 C90 206 90 224 88 238 C86 240 83 240 82 238 C84 224 84 200 84 178 Z M91 204 C93 208 94 214 94 220 C94 228 93 236 91 240 C89 240 88 238 87 235 C89 226 90 212 91 204 Z',
  aductores: 'M91 176 L99 171 L99 188 C98 198 96 206 94 212 C92 202 90 190 91 176 Z',
  pantorrilla: 'M73 258 C77 254 83 254 87 258 C89 272 89 290 87 304 L79 304 C75 290 72 272 73 258 Z',
};
const BACK = {
  trapecio: 'M92 47 C86 53 74 57 63 63 C70 76 84 90 98 100 L98 52 Z',
  hombro_posterior: 'M62 65 C55 64 50 70 50 80 C50 90 52 98 56 102 L65 100 C69 92 71 82 70 75 C68 69 66 66 62 65 Z',
  triceps: 'M54 105 C58 101 63 101 65 105 C64 113 60 122 57 127 L47 127 C49 118 50 111 54 105 Z',
  antebrazo: 'M47 131 L58 131 C56 142 52 156 48 167 L38 167 C41 154 44 142 47 131 Z',
  espalda_media: 'M98 103 L85 99 C81 107 81 118 85 127 L98 129 Z',
  dorsales: 'M66 104 C72 100 79 100 83 103 C80 113 80 121 85 130 L89 133 L89 156 C83 159 77 161 71 158 C72 140 70 122 66 104 Z',
  lumbar: 'M98 133 L91 133 C90 144 90 156 92 166 L98 169 Z',
  gluteo: 'M99 170 C88 168 76 170 70 177 C68 188 72 200 82 205 C90 208 96 206 99 203 Z',
  femoral: 'M70 210 C75 208 80 208 82 209 C83 224 82 236 80 244 L73 244 C71 232 70 220 70 210 Z M85 209 C89 208 93 209 96 212 C96 224 94 236 92 244 L85 244 C86 232 86 220 85 209 Z',
  aductores: 'M97 211 L99 205 L99 224 C98 232 96 238 94 242 C96 232 97 222 97 211 Z',
  pantorrilla: 'M73 257 C77 253 82 253 83 257 C84 272 83 288 81 297 L77 297 C74 286 72 270 73 257 Z M86 257 C89 253 92 255 92 259 C92 274 90 288 88 297 L84 297 C83 286 85 270 86 257 Z',
};
const SHAPES = { front: FRONT, back: BACK };

export function buildBodyMap(view, muscleById, { onSelect, statusOf }) {
  const root = svg('svg', { viewBox: '16 0 168 332', class: 'bodymap', role: 'group', 'aria-label': view === 'front' ? 'Cuerpo, vista frontal' : 'Cuerpo, vista posterior' });
  const g = svg('g', { class: 'base' });
  g.append(svg('ellipse', { cx: 100, cy: 23, rx: 14, ry: 19.5, class: 'silhouette' }));
  g.append(svg('ellipse', { cx: 85.5, cy: 25, rx: 2.6, ry: 5, class: 'silhouette' }), svg('ellipse', { cx: 114.5, cy: 25, rx: 2.6, ry: 5, class: 'silhouette' }));
  g.append(svg('path', { d: both(BODY), class: 'silhouette' }), svg('path', { d: both(HAND), class: 'silhouette' }));
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

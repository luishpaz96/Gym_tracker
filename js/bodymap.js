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
  pecho: 'M98 68 C90 66 80 68 73 74 C79 77 90 77 98 76 Z M98 79 C90 79 79 78 72 79 C68 86 68 93 70 98 C78 104 91 104 98 100 Z',
  biceps: 'M54 105 C57 102 60 102 61 105 C60 114 58 121 56 127 L48 127 C50 118 51 111 54 105 Z M62 105 C64 105 65 107 65 108 C64 114 61 122 58 127 L57 127 C59 120 61 112 62 105 Z',
  antebrazo: 'M47 131 L52 131 C51 142 48 156 44 167 L38 167 C41 154 44 142 47 131 Z M54 131 L58 131 C56 142 52 156 48 167 L45 167 C49 156 52 142 54 131 Z',
  abdomen: 'M90 106 L98.6 106 L98.6 115 L89.5 115 Z M89.5 117 L98.6 117 L98.6 127 L89 127 Z M89 129 L98.6 129 L98.6 139 L89 139 Z M89.5 141 L98.6 141 L98.6 152 C94 153 91 151 89.5 149 Z',
  oblicuos: 'M72 108 L87 107 L87 150 C83 157 77 161 70 160 C71 150 72 138 72 130 C72 122 72 114 72 108 Z M67 102 L73 104 L72 108 L67 106 Z M68 109 L73 111 L72 115 L68 113 Z M69 116 L73 118 L72 122 L69 120 Z',
  cuadriceps: 'M68 174 C73 172 79 176 80 182 C82 204 80 226 78 240 C75 243 72 243 71 241 C68 224 66 196 68 174 Z M83 178 C86 177 89 181 88 188 C88 208 88 226 86 238 C84 240 82 240 81 238 C83 224 83 200 83 178 Z M90 208 C93 212 94 218 94 224 C94 232 93 238 91 241 C88 241 86 239 86 236 C88 228 89 216 90 208 Z M77 172 L81 172 C86 192 92 216 96 236 L93 238 C88 220 81 196 77 172 Z',
  aductores: 'M92 178 L99 172 L99 190 C98 200 96 208 94 214 C92 202 91 190 92 178 Z',
  pantorrilla: 'M72 256 C75 254 78 256 78 262 C78 276 77 290 76 298 C73 290 70 274 72 256 Z M80 262 C83 258 86 259 87 263 C88 276 87 290 85 302 L82 302 C80 290 79 276 80 262 Z',
};
const BACK = {
  trapecio: 'M98 48 C90 50 78 56 63 63 C70 74 76 84 80 94 C86 106 92 120 98 134 Z',
  hombro_posterior: 'M62 65 C55 64 50 70 50 80 C50 90 52 98 56 102 L65 100 C69 92 71 82 70 75 C68 69 66 66 62 65 Z M72 82 C78 80 85 84 86 92 C84 99 78 103 73 101 C69 96 69 88 72 82 Z',
  triceps: 'M54 105 C57 102 60 102 61 105 C60 114 58 121 56 127 L48 127 C50 118 51 111 54 105 Z M62 105 C64 105 65 107 65 108 C64 114 61 122 58 127 L57 127 C59 120 61 112 62 105 Z',
  antebrazo: 'M47 131 L52 131 C51 142 48 156 44 167 L38 167 C41 154 44 142 47 131 Z M54 131 L58 131 C56 142 52 156 48 167 L45 167 C49 156 52 142 54 131 Z',
  espalda_media: 'M90 90 L96 100 L96 126 L90 124 C88 112 88 100 90 90 Z M67 104 C72 102 78 104 79 108 C77 112 72 114 68 112 Z',
  dorsales: 'M66 114 C74 114 80 118 84 124 C88 134 92 142 96 148 L92 160 C84 160 76 158 71 154 C72 138 70 124 66 114 Z',
  lumbar: 'M98 136 L93 134 C91 146 91 158 93 168 L98 170 Z M97 112 L92 110 C90 120 91 128 93 132 L98 134 Z',
  gluteo: 'M99 173 C90 171 80 173 74 181 C70 190 74 202 84 206 C92 208 97 206 99 203 Z M70 166 C76 162 86 164 92 168 C84 171 77 174 73 179 C69 176 68 170 70 166 Z',
  femoral: 'M70 210 C75 208 80 208 82 209 C83 224 82 236 80 244 L73 244 C71 232 70 220 70 210 Z M84 209 C87 208 90 209 91 211 C91 224 90 236 88 244 L84 244 C85 232 85 220 84 209 Z M92 212 C94 213 96 214 96 216 C96 226 94 236 93 243 L90 243 C91 232 92 222 92 212 Z',
  aductores: 'M97 211 L99 205 L99 224 C98 232 96 238 94 242 C96 232 97 222 97 211 Z',
  pantorrilla: 'M73 257 C77 253 82 253 83 257 C84 272 83 288 81 299 L77 299 C74 288 72 272 73 257 Z M86 257 C89 253 92 255 92 259 C92 274 90 288 88 299 L84 299 C83 288 85 272 86 257 Z',
};
const SHAPES = { front: FRONT, back: BACK };

// Estrías de fibra: líneas finas por músculo (dirección θ en grados desde la vertical, o abanico desde un origen)
const STRIA = {
  front: { trapecio: { a: 70, s: 2.2 }, hombro_lateral: { a: 6, s: 2 }, hombro_frontal: { a: -10, s: 2 }, pecho: { o: [66, 86], s: 2.4 }, biceps: { a: -8, s: 2 }, antebrazo: { a: -12, s: 2 },
    oblicuos: { a: -28, s: 2.4 }, cuadriceps: { a: 3, s: 2.4 }, aductores: { a: -15, s: 2.4 }, pantorrilla: { a: 2, s: 2.2 } },
  back: { trapecio: { o: [98, 128], s: 3 }, hombro_posterior: { a: 10, s: 2 }, triceps: { a: -6, s: 2 }, antebrazo: { a: -12, s: 2 }, espalda_media: { a: 62, s: 2.4 },
    dorsales: { o: [64, 108], s: 2.8 }, lumbar: { a: 0, s: 2.4 }, gluteo: { a: -35, s: 2.4 }, femoral: { a: 2, s: 2.4 }, aductores: { a: 0, s: 2.4 }, pantorrilla: { a: 2, s: 2.2 } },
};
function striaPath(d, spec) {
  const nums = (d.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 3;
  const out = [];
  const f = (n) => +n.toFixed(1);
  if (spec.o) {
    const [ox, oy] = spec.o, vx = cx - ox, vy = cy - oy, dist = Math.hypot(vx, vy) || 1, nx = -vy / dist, ny = vx / dist;
    for (let k = -R; k <= R; k += spec.s) {
      const tx = cx + nx * k - ox, ty = cy + ny * k - oy, l = Math.hypot(tx, ty) || 1, L = dist + R;
      out.push(`M${f(ox)} ${f(oy)} L${f(ox + (tx / l) * L)} ${f(oy + (ty / l) * L)}`);
    }
  } else {
    const t = (spec.a * Math.PI) / 180, dx = Math.sin(t), dy = Math.cos(t), nx = dy, ny = -dx;
    for (let k = -R; k <= R; k += spec.s) out.push(`M${f(cx + nx * k - dx * R)} ${f(cy + ny * k - dy * R)} L${f(cx + nx * k + dx * R)} ${f(cy + ny * k + dy * R)}`);
  }
  return out.join(' ');
}

export function buildBodyMap(view, muscleById, { onSelect, statusOf }) {
  const root = svg('svg', { viewBox: '16 0 168 332', class: 'bodymap', role: 'group', 'aria-label': view === 'front' ? 'Cuerpo, vista frontal' : 'Cuerpo, vista posterior' });
  const g = svg('g', { class: 'base' });
  g.append(svg('ellipse', { cx: 100, cy: 23, rx: 14, ry: 19.5, class: 'silhouette' }));
  g.append(svg('ellipse', { cx: 85.5, cy: 25, rx: 2.6, ry: 5, class: 'silhouette' }), svg('ellipse', { cx: 114.5, cy: 25, rx: 2.6, ry: 5, class: 'silhouette' }));
  g.append(svg('path', { d: both(BODY), class: 'silhouette' }), svg('path', { d: both(HAND), class: 'silhouette' }));
  root.append(g);
  const defs = svg('defs'); root.append(defs);
  const parts = svg('g', { class: 'muscles' });
  const nodes = {};
  for (const [id, d] of Object.entries(SHAPES[view])) {
    const m = muscleById[id];
    if (!m) continue;
    const full = both(d), cid = `bm-${view}-${id}`;
    defs.append(svg('clipPath', { id: cid }, svg('path', { d: full })));
    const p = svg('path', { d: full, class: 'muscle', 'data-muscle': id, tabindex: '0', role: 'button' });
    const spec = STRIA[view][id];
    const activate = () => onSelect(id);
    p.addEventListener('click', activate);
    p.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
    p.append(svg('title', {}, m.name));
    nodes[id] = p; parts.append(p);
    if (spec) parts.append(svg('path', { d: both(striaPath(d, spec)), class: 'stria', 'clip-path': `url(#${cid})`, 'aria-hidden': 'true' }));
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

// Fotos ilustrativas de recetas desde Wikimedia Commons (consulta desde el teléfono; sin llaves ni servidor).
// Solo se aceptan licencias libres: CC0, dominio público, CC BY y CC BY-SA. Resultado (incluso "sin foto") en caché 30 días.
import { el } from './ui.js';

const API = 'https://commons.wikimedia.org/w/api.php';
const TTL = 30 * 24 * 3600 * 1000;
const MAX_CONCURRENT = 4;
const MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// ---- Lógica pura (con pruebas) ----
export const licenseOk = (name) => {
  const s = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s || /\b(nc|nd)\b|non-?commercial|no derivatives/.test(s)) return false;
  return /^cc0\b/.test(s) || /^public domain/.test(s) || /^pd\b/.test(s) || /^cc[ -]by(?:[ -]sa)?(?:[ -]\d|\b)/.test(s);
};
export function stripHtml(html) {
  const s = String(html || '');
  if (typeof DOMParser !== 'undefined') return (new DOMParser().parseFromString(s, 'text/html').body.textContent || '').trim();
  return s.replace(/<[^>]*>/g, '').trim();
}
export const searchUrl = (q) => `${API}?${new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrsearch: `${q} filetype:bitmap`, gsrlimit: '6', prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '480' })}`;
// Elige la primera imagen (por relevancia) jpeg/png/webp con licencia libre.
export function pickPhoto(json) {
  const pages = Object.values(json?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii || !MIMES.has(ii.mime)) continue;
    const md = ii.extmetadata || {};
    const lic = md.LicenseShortName?.value;
    if (!licenseOk(lic)) continue;
    const thumb = ii.thumburl || ii.url;
    if (!/^https:\/\/upload\.wikimedia\.org\//.test(thumb || '')) continue;
    const page = ii.descriptionshorturl || ii.descriptionurl || '';
    return { thumb, page: /^https:\/\/commons\.wikimedia\.org\//.test(page) ? page : '', author: stripHtml(md.Artist?.value) || 'Autor desconocido', license: String(lic).trim() };
  }
  return null;
}

// ---- Caché, cola y deduplicación ----
const key = (id) => `gt_rphoto_${id}`;
function readCache(id) {
  try { const v = JSON.parse(localStorage.getItem(key(id))); if (v && Date.now() - v.t < TTL) return v; } catch { /* sin caché */ }
  return null;
}
function writeCache(id, photo) { try { localStorage.setItem(key(id), JSON.stringify({ t: Date.now(), v: photo })); } catch { /* sin espacio */ } }
const inflight = new Map(), waiting = []; let active = 0;
function pump() {
  while (active < MAX_CONCURRENT && waiting.length) { active++; waiting.shift()().finally(() => { active--; pump(); }); }
}
const schedule = (job) => new Promise((res) => { waiting.push(() => job().then(res, () => res(undefined))); pump(); });

// Devuelve {thumb,page,author,license}, null (no hay foto) o undefined (error de red: no se guarda)
export function getRecipePhoto(recipe, fetchFn = (u) => fetch(u)) {
  const c = readCache(recipe.id);
  if (c) return Promise.resolve(c.v);
  if (inflight.has(recipe.id)) return inflight.get(recipe.id);
  const q = recipe.photo_q || recipe.name;
  const p = schedule(async () => {
    const r = await fetchFn(searchUrl(q));
    if (!r.ok) throw new Error(String(r.status));
    const photo = pickPhoto(await r.json());
    writeCache(recipe.id, photo);
    return photo;
  }).finally(() => inflight.delete(recipe.id));
  inflight.set(recipe.id, p);
  return p;
}

// ---- Interfaz ----
// Sin foto no se muestra nada: la tarjeta/detalle queda como antes. La imagen se inserta solo cuando cargó bien.
const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); e.target.dispatchEvent(new Event('gt-visible')); }
}, { rootMargin: '200px' }) : null;

// size: 'thumb' (64x64, se antepone a `host`) o 'hero' (16:9 + pie, se antepone a `host`).
export function attachPhoto(recipe, host, { size = 'thumb' } = {}) {
  let started = false;
  const load = async () => {
    if (started) return; started = true;
    const photo = await getRecipePhoto(recipe);
    if (!photo) return;
    const img = el('img', { alt: size === 'hero' ? `Foto ilustrativa de ${recipe.name}` : '', decoding: 'async', referrerpolicy: 'no-referrer' });
    img.addEventListener('load', () => {
      const box = el('div', { class: `rphoto ${size}` }, img);
      if (size !== 'hero') { host.prepend(box); return; }
      const txt = `Foto ilustrativa · ${photo.author} · ${photo.license} · Wikimedia Commons`;
      host.prepend(box, el('p', { class: 'muted tiny rphoto-cap' }, photo.page ? el('a', { href: photo.page, target: '_blank', rel: 'noopener noreferrer', text: txt }) : txt));
    });
    img.addEventListener('error', () => { /* sin foto: no se muestra nada */ });
    img.src = photo.thumb;
  };
  if (size === 'hero' || !io) load();
  else { host.addEventListener('gt-visible', load); io.observe(host); }
}

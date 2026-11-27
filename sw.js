// Service worker: solo cachea archivos estáticos propios, data/*.json y las 2 librerías CDN fijadas (con SRI).
// Nunca intercepta ni guarda respuestas de Supabase (otro origen) ni peticiones que no sean GET.
const VERSION = 'gt-v12';
const SHELL = ['./', 'index.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/main.js', 'js/config.js', 'js/calc.js', 'js/search.js', 'js/grading.js', 'js/recommend.js', 'js/ui.js', 'js/data.js', 'js/api.js', 'js/supabase.js',
  'js/auth.js', 'js/demo.js', 'js/stats.js', 'js/charts.js', 'js/bodymap.js', 'js/technique.js',
  'js/overload.js', 'js/plan-generator.js', 'js/weight.js', 'js/profile.js', 'js/planctl.js', 'js/screens/onboarding.js', 'js/tips.js', 'js/screens/track.js', 'js/screens/summary.js', 'js/screens/bodymap_panel.js', 'js/screens/charts_panel.js', 'js/screens/biblioteca.js', 'js/screens/cuenta.js', 'js/screens/grade.js',
  'js/units.js', 'js/authlink.js', 'js/nutrition.js', 'js/screens/powders.js', 'js/screens/comida.js', 'js/screens/recetas.js', 'js/screens/logentry.js',
  'data/muscles.json', 'data/exercises.json', 'data/plan.json', 'data/foods.json', 'data/recipes.json', 'data/recipe_categories.json', 'data/protein_powders.json'];
const CDN_ALLOW = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js',
];
const FRAMES = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const cdn = CDN_ALLOW.includes(req.url) || req.url.startsWith(FRAMES);
  if (!own && !cdn) return;                       // Supabase y todo lo demás: directo a la red
  if (own && url.search.includes('code=')) return; // retorno de OAuth/PKCE: sin caché
  const imgs = req.url.startsWith(FRAMES);
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (cdn) { // inmutables (versión fija): caché primero
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && (res.type === 'cors' || res.type === 'basic') && !imgs) cache.put(req, res.clone());
      else if (res.ok && imgs) cache.put(req, res.clone());
      return res;
    }
    try { // propios: red primero, saltando la caché HTTP (GitHub Pages cachea 10 min); caché si no hay red
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
      throw err;
    }
  })());
});

// Arranque, enrutador y shell de la app.
import * as config from './config.js';
import { loadData, loadFoods } from './data.js';
import { createRemoteApi, createDemoApi } from './api.js';
import { makeSeed } from './demo.js';
import { renderAuth } from './auth.js';
import { el, clear, icon, toast, $ } from './ui.js';
import { foodFrom } from './stats.js';
import { profileComplete } from './profile.js';
import { ensurePlan } from './planctl.js';
import { renderOnboarding } from './screens/onboarding.js';

const demo = new URLSearchParams(location.search).get('demo') === '1';
const viewEl = () => $('#view');

// ---- Tema (oscuro por defecto) ----
const themeKey = 'gt_theme';
const getTheme = () => { try { return localStorage.getItem(themeKey) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };
const applyTheme = (t) => { document.documentElement.dataset.theme = t; };
applyTheme(getTheme());

const ROUTES = {
  track: () => import('./screens/track.js'),
  comida: () => import('./screens/comida.js'),
  recetas: () => import('./screens/recetas.js'),
  summary: () => import('./screens/summary.js'),
  biblioteca: () => import('./screens/biblioteca.js'),
  cuenta: () => import('./screens/cuenta.js'),
};
const ALIAS = { alimentacion: 'comida', 'alimentación': 'comida', hoy: 'track', registrar: 'track', progreso: 'summary', cuerpo: 'summary' };
const NAV = [['track', 'Track'], ['comida', 'Comida'], ['recetas', 'Recetas'], ['summary', 'Summary'], ['biblioteca', 'Biblioteca']];

function message(title, text, extra) {
  const root = viewEl(); clear(root);
  root.append(el('div', { class: 'card center-card' }, el('h1', { text: title }), el('p', { text }), extra));
}

function shell(ctx) {
  $('#app-header').classList.remove('hidden');
  $('#nav').classList.remove('hidden');
  const nav = $('#nav'); clear(nav);
  NAV.forEach(([id, label]) => nav.append(el('a', { class: 'nav-item', href: `#/${id}`, dataset: { route: id } }, icon(id), el('span', { text: label }))));
  const head = $('#app-header'); clear(head);
  head.append(...[el('span', { class: 'brand-sm', text: 'Gym Tracker' }), ctx.api.mode === 'demo' ? el('span', { class: 'demo-badge', text: 'MODO DEMO · datos de muestra' }) : null,
    el('a', { class: 'icon-btn', href: '#/cuenta', 'aria-label': 'Cuenta y ajustes' }, icon('cuenta'))].filter(Boolean));
}

async function route(ctx) {
  const id = (location.hash.replace(/^#\/?/, '') || 'hoy').split('/')[0];
  const name = ROUTES[id] ? id : (ALIAS[id] || 'track');
  document.querySelectorAll('.nav-item').forEach((a) => { const on = a.dataset.route === name; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const root = clear(viewEl());
  try {
    const mod = await ROUTES[name]();
    await mod.render(ctx, root);
  } catch (e) {
    console.error(e);
    clear(root).append(el('p', { class: 'banner bad', text: 'Ocurrió un error al mostrar esta pantalla.' }));
  }
  window.scrollTo(0, 0);
  root.focus({ preventScroll: true });
}

async function startApp(api, data) {
  const ctx = { api, data, workouts: [], weights: [], foodLogs: [], plan: null, planSource: null, profile: { unit: 'kg' },
    theme: getTheme,
    toggleTheme() { const t = getTheme() === 'dark' ? 'light' : 'dark'; try { localStorage.setItem(themeKey, t); } catch { /* sin almacenamiento */ } applyTheme(t); },
    async refresh() { ctx.workouts = await api.listWorkouts(); },
    async refreshFood() { ctx.foodLogs = await api.listFoodLogs(foodFrom()); } };
  try { ctx.profile = { unit: 'kg', ...(await api.getProfile()) }; } catch { /* se queda en kg */ }
  try { ctx.weights = await api.listBodyWeights(); } catch { /* sin conexión */ }
  if (!profileComplete(ctx.profile)) {
    $('#app-header').classList.add('hidden'); $('#nav').classList.add('hidden');
    await new Promise((done) => renderOnboarding(ctx, clear(viewEl()), done));
  }
  await ensurePlan(ctx);
  try { await api.flush(); } catch { /* sin conexión */ }
  try { await ctx.refreshFood(); } catch (e) { console.warn(e?.message); }
  try { await ctx.refresh(); } catch (e) { console.warn(e?.message); toast('No se pudieron cargar tus entrenamientos', 'bad'); }
  shell(ctx);
  window.addEventListener('online', async () => { const n = await api.flush().catch(() => 0); if (n) { toast(`Se subieron ${n} sesión(es) pendientes`); await ctx.refresh(); } });
  window.addEventListener('hashchange', () => route(ctx));
  await route(ctx);
}

async function boot() {
  let data;
  try { data = await loadData(); } catch (e) { return message('No se pudieron cargar los datos', 'Revisa tu conexión e intenta de nuevo.'); }

  if (demo) {
    data.foods = (await loadFoods()).foods;
    const api = createDemoApi(() => makeSeed(data));
    await api.init();
    return startApp(api, data);
  }
  if (!config.isConfigured()) {
    $('#app-header').classList.add('hidden'); $('#nav').classList.add('hidden');
    return message('Configuración pendiente', 'Falta conectar Supabase. Pega SUPABASE_URL y SUPABASE_ANON_KEY en js/config.js (pasos en supabase/README.md).',
      el('p', {}, el('a', { class: 'btn', href: '?demo=1' }, 'Probar el modo demo')));
  }
  let api;
  try { api = createRemoteApi(); await api.init(); } catch (e) { return message('Sin conexión con el servicio', e.message || 'No se pudo iniciar.'); }
  let started = false;
  const show = async (recovery = false) => {
    $('#app-header').classList.add('hidden'); $('#nav').classList.add('hidden');
    const root = clear(viewEl()); renderAuth(root, api, { recovery });
  };
  api.onAuthChange(async (event, user) => {
    if (event === 'PASSWORD_RECOVERY') return show(true);
    if (event === 'SIGNED_OUT') { location.hash = ''; location.reload(); return; }
    if (event === 'SIGNED_IN' && user && !started) { started = true; location.reload(); }
  });
  if (api.user) { started = true; return startApp(api, data); }
  show();
}

boot();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* sin SW: la app sigue funcionando */ });
}

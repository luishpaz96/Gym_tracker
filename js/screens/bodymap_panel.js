import { el, clear } from '../ui.js';
import { playButton } from '../technique.js';
import { buildBodyMap } from '../bodymap.js';
import { weekStatus } from '../stats.js';
import { STATUS_LABEL } from '../recommend.js';
import { fmtNum } from '../ui.js';

export async function render(ctx, root) {
  const status = weekStatus(ctx);
  const byId = Object.fromEntries(status.map((s) => [s.id, s]));
  root.append(el('h2', { text: 'Semana actual (lun–dom)' }), el('p', { class: 'muted small', text: 'Series efectivas de esta semana contra tu objetivo semanal.' }));

  const VKEY = 'gt_mapview';
  let view = 'front';
  try { const v = localStorage.getItem(VKEY); if (v === 'front' || v === 'back') view = v; } catch { /* sin almacenamiento */ }
  let selected = null;
  const detail = el('section', { class: 'card', 'aria-live': 'polite' });
  const maps = {};
  const mapHost = el('div', { class: 'map-host' });
  const toggle = el('div', { class: 'seg', role: 'group', 'aria-label': 'Vista del cuerpo' });
  const mkMap = (v) => { maps[v] = buildBodyMap(v, ctx.data.muscleById, { onSelect: select, statusOf: (s) => STATUS_LABEL[s] }); maps[v].paint(byId); return maps[v]; };
  function setView(v) {
    view = v; try { localStorage.setItem(VKEY, v); } catch { /* sin almacenamiento */ }
    clear(mapHost); mapHost.append(el('div', { class: 'map-single' }, (maps[v] || mkMap(v)).root));
    [...toggle.children].forEach((b) => { const on = b.dataset.view === v; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    maps[v].select(selected);
  }
  [['front', 'Frente'], ['back', 'Espalda']].forEach(([v, label]) => toggle.append(el('button', { class: 'seg-btn', type: 'button', dataset: { view: v }, on: { click: () => setView(v) } }, label)));
  function select(id) {
    selected = id; Object.values(maps).forEach((m) => m.select(id)); showDetail();
  }
  function showDetail() {
    clear(detail);
    if (!selected) { detail.append(el('p', { class: 'muted', text: 'Toca un músculo para ver sus series y ejercicios.' })); return; }
    const s = byId[selected];
    const pct = s.target ? Math.round((s.sets / s.target) * 100) : 0;
    detail.append(el('div', { class: 'row between' }, el('h2', { text: s.name }), el('span', { class: `badge st-${s.status}`, text: STATUS_LABEL[s.status] })),
      el('p', { text: `${fmtNum(s.sets, 1)} de ${s.target} series (${pct} %)` }));
    const exs = Object.entries(s.exercises);
    detail.append(exs.length ? el('ul', { class: 'list' }, exs.map(([id, n]) => el('li', { class: 'list-item' }, ctx.data.exById[id] ? playButton(id, ctx.data.exById[id].name) : null, el('span', { class: 'grow', text: ctx.data.exById[id]?.name || id }), el('span', { class: 'muted', text: `${fmtNum(n, 1)} series` }))))
      : el('p', { class: 'muted', text: 'Sin series esta semana.' }));
  }

  root.append(toggle, el('div', { class: 'card' }, mapHost,
    el('ul', { class: 'legend' }, ['green', 'yellow', 'red', 'gray'].map((k) => el('li', {}, el('span', { class: `dot st-${k}` }), `${STATUS_LABEL[k]}${{ green: ' (≥100 %)', yellow: ' (50–99 %)', red: ' (<50 %)', gray: '' }[k]}`)))));
  setView(view); showDetail();
  root.append(detail);

  // Lista accesible de todos los músculos
  root.append(el('section', { class: 'card' }, el('h2', { text: 'Todos los músculos' }), el('ul', { class: 'list' }, status.map((s) =>
    el('li', {}, el('button', { class: 'pick', type: 'button', on: { click: () => { const mv = ctx.data.muscleById[s.id]?.view; if ((mv === 'front' || mv === 'back') && mv !== view) setView(mv); select(s.id); mapHost.scrollIntoView({ block: 'nearest' }); } } },
      el('span', { class: `dot st-${s.status}`, 'aria-hidden': 'true' }), el('span', { class: 'grow', text: s.name }),
      el('span', { class: 'muted small', text: `${fmtNum(s.sets, 1)}/${s.target} · ${STATUS_LABEL[s.status]}` })))))));
}

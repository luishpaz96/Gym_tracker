// Utilidades de DOM. Nunca se usa innerHTML: todo texto entra por textContent / nodos de texto.
const SVG_NS = 'http://www.w3.org/2000/svg';

// el('div', {class:'x', on:{click:fn}, dataset:{a:1}, aria-label:'..'}, 'texto', hijo, [hijos])
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  applyAttrs(n, attrs);
  append(n, children);
  return n;
}
export function svg(tag, attrs = {}, ...children) {
  const n = document.createElementNS(SVG_NS, tag);
  applyAttrs(n, attrs);
  append(n, children);
  return n;
}
function applyAttrs(n, attrs) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.setAttribute('class', v);
    else if (k === 'text') n.textContent = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
    else if (k === 'dataset') for (const [dk, dv] of Object.entries(v)) n.dataset[dk] = dv;
    else if (k === 'value') n.value = v;
    else if (k === 'style') continue; // el CSP prohíbe estilos en línea: usa clases
    else n.setAttribute(k, v === true ? '' : v);
  }
}
function append(n, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); return n; };
export const $ = (sel, root = document) => root.querySelector(sel);

// ---- Iconos (trazos simples, 24x24) ----
const ICONS = {
  track: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  summary: 'M4 19V5M4 19h16M8 15l4-5 3 3 5-7',
  comida: 'M7 3v7M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 3c-2.2 1.6-3 4.2-3 7h3v11',
  recetas: 'M7 14a3.5 3.5 0 1 1 1.6-6.6A3.6 3.6 0 0 1 15.4 7.4 3.5 3.5 0 1 1 17 14v6H7z',
  hoy: 'M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z',
  registrar: 'M12 5v14M5 12h14',
  progreso: 'M4 19V5M4 19h16M8 15l4-5 3 3 5-7',
  cuerpo: 'M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM6 9h12M12 9v6M9 21l3-6 3 6',
  biblioteca: 'M5 4h4v16H5zM11 4h4v16h-4zM17 6l3 .8-3.5 13.2-3-.8',
  cuenta: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.3 3h-4l-.4 2.7a7 7 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  cerrar: 'M6 6l12 12M18 6L6 18',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  video: 'M5 5l14 7-14 7z',
  borrar: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
};
export function icon(name) {
  return svg('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    svg('path', { d: ICONS[name] || '' }));
}

// ---- Toast ----
let toastTimer;
export function toast(msg, kind = 'info') {
  const host = $('#toast');
  if (!host) return;
  host.textContent = msg;
  host.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { host.className = 'toast'; }, 3800);
}

// ---- Modal accesible (foco, Esc, clic fuera) ----
export function openModal(title, bodyNode, { wide = false } = {}) {
  const prev = document.activeElement;
  const root = $('#modal-root');
  const close = () => { clear(root); document.removeEventListener('keydown', onKey); if (prev?.focus) prev.focus(); modal.dispatchEvent(new Event('closed')); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  const closeBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Cerrar', on: { click: close } }, icon('cerrar'));
  const modal = el('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    el('div', { class: 'modal-head' }, el('h2', { text: title }), closeBtn), el('div', { class: 'modal-body' }, bodyNode));
  const backdrop = el('div', { class: 'backdrop', on: { click: (e) => { if (e.target === backdrop) close(); } } }, modal);
  clear(root).append(backdrop);
  document.addEventListener('keydown', onKey);
  closeBtn.focus();
  return { close, modal };
}

export function confirmDialog(title, message, okLabel = 'Confirmar', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const body = el('div', {}, el('p', { text: message }),
      el('div', { class: 'row end gap' },
        el('button', { class: 'btn', type: 'button', on: { click: () => { finish(false); m.close(); } } }, 'Cancelar'),
        el('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', on: { click: () => { finish(true); m.close(); } } }, okLabel)));
    const m = openModal(title, body);
    m.modal.addEventListener('closed', () => finish(false));
  });
}

export const fmtDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};
export const fmtNum = (n, d = 0) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: d });

// Pide escribir una palabra exacta para confirmar (sustituye a prompt()).
export function confirmWord(title, message, word, okLabel) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const input = el('input', { class: 'input', type: 'text', autocomplete: 'off', 'aria-label': `Escribe ${word}` });
    const ok = el('button', { class: 'btn danger', type: 'button', disabled: true, on: { click: () => { finish(true); m.close(); } } }, okLabel);
    input.addEventListener('input', () => { ok.disabled = input.value.trim() !== word; });
    const body = el('div', {}, el('p', { text: message }), el('p', { class: 'muted small', text: `Escribe ${word} para confirmar.` }), input,
      el('div', { class: 'row end gap' }, el('button', { class: 'btn', type: 'button', on: { click: () => { finish(false); m.close(); } } }, 'Cancelar'), ok));
    const m = openModal(title, body);
    m.modal.addEventListener('closed', () => finish(false));
  });
}

// Selector segmentado kg | lb. onChange(nuevaUnidad)
export function unitToggle(current, onChange, label = 'Unidad de peso') {
  const box = el('div', { class: 'seg unit-seg', role: 'group', 'aria-label': label });
  ['kg', 'lb'].forEach((u) => box.append(el('button', { class: `seg-btn${current === u ? ' on' : ''}`, type: 'button', 'aria-pressed': String(current === u), on: { click: () => { if (u !== current) onChange(u); } } }, u)));
  return box;
}

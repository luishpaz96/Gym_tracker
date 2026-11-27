import { el, toast, confirmWord } from '../ui.js';

function download(name, obj) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function render(ctx, root) {
  const { api } = ctx;
  root.append(el('h1', { text: 'Cuenta' }));
  if (api.mode === 'demo') root.append(el('p', { class: 'banner warn', text: 'MODO DEMO: los datos son de muestra y viven solo en este navegador. No se conecta a Supabase.' }));
  root.append(el('section', { class: 'card' }, el('h2', { text: 'Sesión' }), el('p', {}, el('strong', { text: 'Correo: ' }), api.user?.email || api.user?.phone || '—')));

  // Preferencias
  const unitBtns = ['kg', 'lb'].map((u) => el('button', { class: `seg-btn${ctx.profile.unit === u ? ' on' : ''}`, type: 'button', 'aria-pressed': String(ctx.profile.unit === u), on: { click: async () => {
    ctx.profile = { ...ctx.profile, unit: u };
    try { await api.saveProfile(ctx.profile); } catch { toast('No se pudo guardar la preferencia', 'bad'); }
    unitBtns.forEach((b, i) => { const on = ['kg', 'lb'][i] === u; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  } } }, u));
  const themeBtn = el('button', { class: 'btn', type: 'button', on: { click: () => { ctx.toggleTheme(); themeBtn.textContent = `Tema: ${ctx.theme() === 'dark' ? 'oscuro' : 'claro'} (cambiar)`; } } }, `Tema: ${ctx.theme() === 'dark' ? 'oscuro' : 'claro'} (cambiar)`);
  root.append(el('section', { class: 'card' }, el('h2', { text: 'Preferencias' }), el('p', { class: 'muted small', text: 'Unidad de peso (los datos se guardan siempre en kg)' }), el('div', { class: 'seg' }, unitBtns), themeBtn));

  // Cola sin conexión
  const pend = api.pendingCount();
  if (pend) {
    const b = el('button', { class: 'btn', type: 'button', on: { click: async () => { const n = await api.flush(); await ctx.refresh(); toast(n ? `Se subieron ${n} sesiones` : 'Aún sin conexión'); location.reload(); } } }, 'Reintentar subida');
    root.append(el('section', { class: 'card' }, el('h2', { text: 'Pendientes de subir' }), el('p', { text: `${pend} sesión(es) guardadas en este dispositivo.` }), b));
  }

  // Datos
  root.append(el('section', { class: 'card' }, el('h2', { text: 'Mis datos' }),
    el('button', { class: 'btn block', type: 'button', on: { click: async () => { try { download('gym-tracker-datos.json', await api.exportAll()); } catch { toast('No se pudo exportar', 'bad'); } } } }, 'Exportar mis datos (JSON)')));

  if (api.mode === 'demo') {
    root.append(el('section', { class: 'card' }, el('button', { class: 'btn block', type: 'button', on: { click: () => { api.resetDemo(); location.hash = '#/hoy'; location.reload(); } } }, 'Reiniciar datos de la demo'),
      el('a', { class: 'btn block', href: location.pathname }, 'Salir de la demo')));
    return;
  }
  root.append(el('section', { class: 'card' },
    el('button', { class: 'btn block', type: 'button', on: { click: async () => { await api.signOut(); location.hash = '#/hoy'; } } }, 'Cerrar sesión'),
    el('h2', { class: 'danger-t', text: 'Zona de peligro' }),
    el('p', { class: 'muted small', text: 'Borra tu cuenta y todos tus entrenamientos de forma permanente. No se puede deshacer.' }),
    el('button', { class: 'btn danger block', type: 'button', on: { click: async () => {
      if (!(await confirmWord('Borrar cuenta', 'Se eliminarán tu cuenta y todos tus datos de forma permanente.', 'BORRAR', 'Borrar todo'))) return;
      try { await api.deleteAccount(); toast('Cuenta eliminada'); location.hash = '#/hoy'; } catch { toast('No se pudo borrar la cuenta', 'bad'); }
    } } }, 'Borrar mi cuenta y datos')));
}

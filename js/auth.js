// Pantalla de acceso: email+contraseña, enlace mágico, recuperación y (opcional) teléfono.
import { el, clear, toast } from './ui.js';
import { MIN_PASSWORD, PHONE_AUTH_ENABLED } from './config.js';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

// Mensajes genéricos: no revelan si un correo ya existe.
function friendly(err) {
  const m = String(err?.message || err || '');
  if (/invalid login|invalid credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/email not confirmed/i.test(m)) return 'Primero confirma tu correo con el enlace que te enviamos.';
  if (/rate limit|too many|429/i.test(m)) return 'Demasiados intentos. Espera unos minutos.';
  if (/password/i.test(m) && /weak|leak|pwned|short|least/i.test(m)) return 'Esa contraseña no es aceptable: usa una más larga y poco común.';
  if (/captcha/i.test(m)) return 'Falló la verificación CAPTCHA.';
  if (/fetch|network/i.test(m)) return 'Sin conexión. Intenta de nuevo.';
  return 'No se pudo completar la acción. Intenta de nuevo.';
}

function field(label, attrs) {
  const input = el('input', { class: 'input', ...attrs });
  return { input, node: el('label', { class: 'field' }, el('span', { text: label }), input) };
}

export function renderAuth(root, api, { recovery = false } = {}) {
  let mode = recovery ? 'nueva' : 'entrar';
  const msg = el('p', { class: 'form-msg', role: 'status', 'aria-live': 'polite' });
  const setMsg = (t, bad = false) => { msg.textContent = t; msg.className = `form-msg${bad ? ' bad' : ''}`; };
  const card = el('div', { class: 'card auth' });
  root.append(el('div', { class: 'auth-wrap' }, el('h1', { class: 'brand', text: 'Gym Tracker' }), el('p', { class: 'muted', text: 'Registra tus entrenamientos y mide tu progreso.' }), card));

  const tabs = [['entrar', 'Entrar'], ['crear', 'Crear cuenta'], ['magico', 'Enlace mágico']];
  if (PHONE_AUTH_ENABLED) tabs.push(['telefono', 'Teléfono']);

  async function run(btn, fn) {
    btn.disabled = true; setMsg('');
    try { await fn(); } catch (e) { setMsg(friendly(e), true); } finally { btn.disabled = false; }
  }

  function draw() {
    clear(card); setMsg('');
    if (mode !== 'nueva' && mode !== 'olvide') {
      card.append(el('div', { class: 'tabs', role: 'tablist' }, tabs.map(([id, label]) =>
        el('button', { class: `tab${mode === id ? ' on' : ''}`, type: 'button', role: 'tab', 'aria-selected': String(mode === id), on: { click: () => { mode = id; draw(); } } }, label))));
    }
    const form = el('form', { novalidate: true });
    const email = field('Correo electrónico', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true, maxlength: 254 });
    const pass = field('Contraseña', { type: 'password', autocomplete: mode === 'crear' || mode === 'nueva' ? 'new-password' : 'current-password', required: true, minlength: MIN_PASSWORD, maxlength: 128 });
    const submit = (label) => el('button', { class: 'btn primary block', type: 'submit' }, label);
    let handler;

    if (mode === 'entrar') {
      const b = submit('Entrar');
      form.append(email.node, pass.node, b, el('button', { class: 'link', type: 'button', on: { click: () => { mode = 'olvide'; draw(); } } }, '¿Olvidaste tu contraseña?'));
      handler = () => run(b, async () => {
        if (!EMAIL_RE.test(email.input.value.trim()) || !pass.input.value) throw new Error('Datos incompletos');
        await api.signIn(email.input.value.trim(), pass.input.value);
      });
    } else if (mode === 'crear') {
      const b = submit('Crear cuenta');
      form.append(email.node, pass.node, el('p', { class: 'muted small', text: `Mínimo ${MIN_PASSWORD} caracteres. Te enviaremos un correo para confirmar tu cuenta.` }), b);
      handler = () => run(b, async () => {
        const e = email.input.value.trim();
        if (!EMAIL_RE.test(e)) return setMsg('Escribe un correo válido.', true);
        if (pass.input.value.length < MIN_PASSWORD) return setMsg(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`, true);
        await api.signUp(e, pass.input.value);
        setMsg('Listo. Revisa tu correo y confirma tu cuenta para poder entrar.');
      });
    } else if (mode === 'magico' || mode === 'olvide') {
      const b = submit(mode === 'magico' ? 'Enviar enlace' : 'Enviar enlace de recuperación');
      form.append(...(mode === 'olvide' ? [el('h2', { text: 'Recuperar contraseña' })] : []), email.node, b);
      if (mode === 'olvide') form.append(el('button', { class: 'link', type: 'button', on: { click: () => { mode = 'entrar'; draw(); } } }, 'Volver'));
      handler = () => run(b, async () => {
        const e = email.input.value.trim();
        if (!EMAIL_RE.test(e)) return setMsg('Escribe un correo válido.', true);
        await (mode === 'magico' ? api.magicLink(e) : api.resetPassword(e));
        setMsg('Si el correo es válido, recibirás un enlace en unos minutos. Ábrelo en este mismo navegador.');
      });
    } else if (mode === 'nueva') {
      const b = submit('Guardar nueva contraseña');
      form.append(el('h2', { text: 'Nueva contraseña' }), pass.node, b);
      handler = () => run(b, async () => {
        if (pass.input.value.length < MIN_PASSWORD) return setMsg(`Mínimo ${MIN_PASSWORD} caracteres.`, true);
        await api.updatePassword(pass.input.value); toast('Contraseña actualizada'); location.hash = '#/track'; location.reload();
      });
    } else if (mode === 'telefono') {
      const phone = field('Teléfono (con lada, ej. +5215512345678)', { type: 'tel', autocomplete: 'tel', inputmode: 'tel', maxlength: 20, placeholder: '+52…' });
      const code = field('Código de 6 dígitos', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 6, pattern: '[0-9]*' });
      const b = submit('Enviar código');
      let sent = false;
      form.append(phone.node, el('div', { class: 'hidden', 'data-code': '' }, code.node), b);
      handler = () => run(b, async () => {
        const p = phone.input.value.trim();
        if (!/^\+[1-9]\d{7,14}$/.test(p)) return setMsg('Usa el formato internacional: +52…', true);
        if (!sent) { await api.phoneOtp(p); sent = true; form.querySelector('[data-code]').classList.remove('hidden'); b.textContent = 'Verificar código'; setMsg('Te enviamos un SMS con el código.'); }
        else { if (!/^\d{6}$/.test(code.input.value.trim())) return setMsg('El código tiene 6 dígitos.', true); await api.verifyPhone(p, code.input.value.trim()); }
      });
    }
    form.addEventListener('submit', (ev) => { ev.preventDefault(); handler(); });
    card.append(form, msg);
  }
  draw();
}

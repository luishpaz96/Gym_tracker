// Interpreta el retorno de los enlaces de correo de Supabase (confirmación, enlace mágico, recuperación). Puro.

// search: location.search, hash: location.hash -> { code, error, tokens, type, cleanHash }
export function parseAuthUrl(search = '', hash = '') {
  const q = new URLSearchParams(search);
  const h = new URLSearchParams(String(hash).replace(/^#\/?/, '').includes('=') ? String(hash).replace(/^#\/?/, '') : '');
  const pick = (k) => q.get(k) || h.get(k) || null;
  const errCode = pick('error_code'), errDesc = pick('error_description'), err = pick('error');
  const access = h.get('access_token'), refresh = h.get('refresh_token');
  const authHash = Boolean(access || h.get('error') || h.get('error_code') || h.get('type') === 'recovery');
  return {
    code: q.get('code'),
    error: err || errCode ? { error: err, code: errCode, description: (errDesc || '').replace(/\+/g, ' ') } : null,
    tokens: access && refresh ? { access_token: access, refresh_token: refresh } : null,
    type: pick('type'),
    touched: Boolean(q.get('code') || q.get('error') || q.get('error_code') || authHash),
    authHash,
  };
}

// err: { code, message, description, error } -> 'expired' | 'verifier' | 'generic'
export function classifyAuthError(err) {
  const text = `${err?.code || ''} ${err?.error || ''} ${err?.message || ''} ${err?.description || ''}`.toLowerCase();
  if (/verifier|flow state|pkce|both auth code/.test(text)) return 'verifier';
  if (/otp_expired|expired|invalid or has expired|email link is invalid/.test(text)) return 'expired';
  return 'generic';
}

export const LINK_MESSAGES = {
  expired: 'El enlace del correo ya no es válido o venció (a veces el antivirus o el correo lo abre antes que tú). Si ya habías confirmado, inicia sesión con tu correo y contraseña. Si no, pide un correo nuevo.',
  verifier: 'Tu correo quedó confirmado, pero abriste el enlace en otro navegador o dispositivo. Inicia sesión con tu correo y contraseña aquí. (Los enlaces mágicos deben abrirse en el mismo navegador donde los pediste.)',
  generic: 'No se pudo completar el enlace del correo. Si ya confirmaste tu correo, inicia sesión con tu contraseña; si no, pide un correo nuevo.',
};
export const linkNotice = (err) => { const kind = classifyAuthError(err); return { kind, text: LINK_MESSAGES[kind] }; };

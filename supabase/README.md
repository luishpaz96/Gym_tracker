# Configurar Supabase para Gym Tracker

La app es un sitio estático; los datos de cada persona viven en Supabase (Auth + Postgres con RLS). Tiempo estimado: 15 minutos.

## 1. Crear el proyecto
1. Entra a <https://supabase.com> e inicia sesión (puedes usar GitHub).
2. **New project** → elige organización, nombre (`gym-tracker`), una contraseña fuerte para la base de datos (guárdala en tu gestor de contraseñas) y la región más cercana (por ejemplo *East US* o *South America (São Paulo)*).
3. Espera a que termine de aprovisionarse.

## 2. Crear tablas, políticas y funciones
1. En el panel: **SQL Editor → New query**.
2. Copia **todo** el contenido de [`schema.sql`](schema.sql), pégalo y presiona **Run**. Es seguro volver a ejecutarlo.
3. Verifica en **Table Editor** que `profiles`, `workouts`, `workout_exercises` y `sets` existen y muestran el candado de *RLS enabled*. En **Authentication → Policies** debe haber 4 políticas por tabla.

## 3. Configuración de Auth (Authentication)
**URL Configuration**
- **Site URL**: `https://luishpaz96.github.io/gym_tracker/`
- **Redirect URLs** (agrega cada una):
  - `https://luishpaz96.github.io/gym_tracker/`
  - `https://luishpaz96.github.io/gym_tracker/**`
  - Para desarrollo local (opcional): `http://localhost:8000/**`

**Sign In / Providers → Email**
- **Enable Email provider**: ON.
- **Confirm email**: **ON** (obligatorio: nadie entra sin confirmar su correo).
- **Secure email change** y **Secure password change**: ON.
- **Minimum password length**: 10 (la app también lo valida).
- **Password requirements**: letras minúsculas, mayúsculas y dígitos (recomendado).
- **Prevent use of leaked passwords** (protección contra contraseñas filtradas, HaveIBeenPwned): **ON** (disponible en planes de pago; actívalo si tu plan lo permite).
- Magic link (OTP por correo) funciona con este mismo proveedor; no requiere pasos extra.

**Attack Protection → CAPTCHA** (recomendado)
- Activa **Enable CAPTCHA protection** con **Cloudflare Turnstile** o **hCaptcha** y pega la *secret key* del proveedor.
- Importante: al activar CAPTCHA, supabase-js exige un `captchaToken` en registro/login/magic link. Hoy `js/auth.js` no incluye el widget; si activas CAPTCHA tendrás que cargar el widget del proveedor y su dominio en la CSP de `index.html` (`script-src`, `frame-src`, `connect-src`). Hasta entonces, usa los límites de tasa de abajo.

**Rate Limits** (Authentication → Rate Limits)
- Reduce *emails sent per hour*, *sign-ups and sign-ins per 5 min per IP* y *OTP/magic links* a valores bajos (p. ej. 3–5 correos/hora, 30 inicios/5 min/IP).
- Para enviar más correos del límite gratuito configura **SMTP propio** (Authentication → SMTP Settings).

**Sessions** (opcional): define *Inactivity timeout* o *Time-box* si quieres que la sesión caduque.

## 4. Teléfono (SMS) más adelante, con Twilio
La app ya incluye el flujo de código SMS, apagado por defecto.
1. Crea una cuenta en <https://www.twilio.com> y un *Messaging Service* con un número que pueda enviar SMS a México.
2. En Supabase: **Authentication → Providers → Phone** → *Enable*, elige **Twilio**, y pega *Account SID*, *Auth Token* y *Message Service SID*.
3. Mantén CAPTCHA y límites de tasa activos: el SMS cuesta dinero y es objetivo de abuso.
4. En `js/config.js` cambia `PHONE_AUTH_ENABLED` a `true`, confirma el cambio en el repo y espera a que Pages se republique.

## 5. Pegar la URL y la anon key en la app
1. En Supabase: **Project Settings → API** (o **Connect**).
2. Copia **Project URL** (`https://xxxxxxxx.supabase.co`) y la clave **anon / publishable** (`anon public`).
3. Pégalas en [`js/config.js`](../js/config.js):
   ```js
   export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...tu-anon-key...';
   ```
4. Haz commit y push a `main`. GitHub Pages republica en ~1 minuto.

> **La anon key es pública por diseño** (viaja en el navegador de cualquiera). Lo que protege los datos es RLS: cada fila solo es visible para su dueño.
> **Nunca** pegues la clave `service_role` ni la contraseña de la base de datos en el repo ni en la app.

## 6. Seguridad: lista de verificación
- [ ] RLS activo en las 4 tablas (candado verde en Table Editor).
- [ ] *Confirm email* ON.
- [ ] Contraseña mínima de 10 caracteres y protección de contraseñas filtradas.
- [ ] CAPTCHA y límites de tasa configurados.
- [ ] Solo la anon key está en `js/config.js`.
- [ ] Prueba con dos cuentas: la cuenta B no debe ver los entrenamientos de la cuenta A.

## 7. Notas
- **frame-ancestors**: GitHub Pages no permite enviar cabeceras HTTP propias y `frame-ancestors` no funciona en `<meta>`. La app no puede impedir que otro sitio la incruste en un iframe; es un riesgo de *clickjacking* que Pages no deja mitigar. Si necesitas esa protección, sirve el sitio tras Cloudflare/Netlify con cabecera `Content-Security-Policy: frame-ancestors 'none'`.
- **Borrar cuenta**: el botón *Borrar mi cuenta y datos* llama a la función `delete_my_account()` (SECURITY DEFINER, `search_path` fijo) que elimina únicamente al usuario autenticado y todos sus datos.
- **Exportar datos**: *Cuenta → Exportar mis datos* descarga un JSON con todo lo guardado.

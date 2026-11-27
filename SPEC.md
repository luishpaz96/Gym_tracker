# Gym Tracker — especificación (contrato entre agentes)

App web móvil (PWA) en español de México para registrar entrenamientos, con usuarios.
Repo: https://github.com/luishpaz96/gym_tracker (público). Se publica con GitHub Pages desde `main` (raíz):
https://luishpaz96.github.io/gym_tracker/

## Arquitectura
- Sitio estático, sin paso de build: `index.html`, `css/`, `js/` (módulos ES), `data/` (JSON de solo lectura), `sw.js`, `manifest.webmanifest`, `icons/`.
- Backend: **Supabase** (Auth + Postgres con Row Level Security). El progreso de cada usuario vive en Supabase, **nunca en el repo** (el repo es público).
- `js/config.js` contiene `SUPABASE_URL` y `SUPABASE_ANON_KEY` (la anon key es pública por diseño; la seguridad la da RLS). Si están vacíos, la app muestra una pantalla "Configuración pendiente".
- `supabase/schema.sql`: tablas, índices, RLS, funciones. `supabase/README.md`: pasos para crear el proyecto.
- Librerías por CDN con versión exacta y `integrity` (SRI) + `crossorigin`: `@supabase/supabase-js` (UMD) y `chart.js`. Nada más.

## Datos de solo lectura (los genera el agente lector en `data/`)
### data/muscles.json
`[{ "id": "pecho", "name": "Pecho", "view": "front"|"back"|"both", "target_sets": 8 }]`
IDs fijos: pecho, dorsales, espalda_media, lumbar, trapecio, hombro_frontal, hombro_lateral, hombro_posterior, biceps, triceps, antebrazo, abdomen, oblicuos, cuadriceps, femoral, gluteo, aductores, pantorrilla.
`target_sets` = series semanales objetivo (series efectivas: músculo principal cuenta 1, secundario 0.5).

### data/exercises.json
```
[{ "id": "banca",                       // id estable (el del proyecto Python cuando exista)
   "name": "Press de banca con barra",
   "group": "Pecho",                    // grupo para filtrar: Pecho, Espalda, Hombro, Trapecio, Bíceps, Tríceps, Antebrazo, Abdomen, Cuádriceps, Femoral y glúteo, Pantorrilla
   "primary": ["pecho"], "secondary": ["triceps","hombro_frontal"],   // IDs de muscles.json
   "equipment": "Barra",                // Barra, Mancuernas, Máquina, Polea, Smith, Peso corporal, Otro
   "where": ["gym"]|["casa"]|["gym","casa"],
   "cues": ["...", "...", "..."],       // técnica en español
   "alt": "Alternativa..." | null,
   "fitwill": "https://fitwill.app/es/exercise/0757/..." | null,
   "fedb": "Barbell_Bench_Press_-_Medium_Grip" | null,   // id en free-exercise-db (para la animación)
   "keywords": ["bench", "press banca", ...]             // sinónimos para el buscador
}]
```
Animación: frames `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/<fedb>/0.jpg` y `/1.jpg` (alternar cada ~800 ms). Licencia Unlicense.

### data/plan.json
```
{ "start": "2026-10-19",
  "days": { "1": "Lunes", "3": "Miércoles", "5": "Viernes" },   // weekday JS (0=domingo)
  "phases": [ { "id": "F2", "name": "Fase 2 · Construcción", "from": "2026-11-16", "to": "2026-12-20",
                "sessions": { "1": {"name": "Pecho, bíceps y abdomen", "exercises": [ {"id":"banca","reps":"6–10","sets":[3,4,4],"rest":"2–3 min"} ]},
                              "3": {...}, "5": {...} } }, ... ] }
```
Cubre fase 1, fase 2, semana 10, fase 3 y los bloques H/F/E de la etapa 2 con sus fechas reales.

## Funciones de la app
1. **Auth** (pantalla inicial): registro e inicio con email + contraseña, enlace mágico, recuperación de contraseña. Teléfono (OTP por SMS) implementado detrás de `config.PHONE_AUTH_ENABLED=false` (se activa al conectar Twilio en Supabase). Cerrar sesión, borrar cuenta y datos, exportar mis datos (JSON).
2. **Hoy**: sesión del plan que toca hoy (según plan.json y la fecha), con ejercicios recomendados. Botón "Empezar entrenamiento".
3. **Registrar**: elegir ejercicios por grupo muscular (chips de grupo) + **buscador** (sin acentos, por nombre y keywords). Por ejercicio: sets con peso (kg, opción lb), reps, RIR opcional. Guardar la sesión.
4. **Volumen**: volumen = Σ peso × reps por set; por sesión, por ejercicio y por músculo (series efectivas).
5. **Progreso**: gráficas Chart.js: volumen por sesión, 1RM estimado (Epley) por ejercicio, series semanales por músculo.
6. **Calificación de la sesión**: comparar cada ejercicio con su sesión anterior (mejor e1RM y volumen): "Mejoraste / Igual / Bajaste" por ejercicio y nota global (A–D) con explicación corta.
7. **Resumen corporal**: SVG de cuerpo humano (frente y espalda) con cada músculo coloreado por semáforo en los últimos 7 días: verde ≥ 100% de target_sets, amarillo 50–99%, rojo < 50%, gris sin datos. Tocar un músculo muestra series y ejercicios.
8. **Recomendaciones para la siguiente sesión**: según el día del plan que sigue + músculos en rojo/amarillo, sugerir ejercicios de la base (prefiriendo los del plan) con series sugeridas.
9. **Biblioteca**: base de ejercicios con buscador y filtro por grupo; ficha con animación, técnica, alternativa y "Ver video" (módulo `js/technique.js`).
10. **Técnica / "API" de video**: `js/technique.js` exporta `getTechnique(exerciseId)` → `{frames:[url0,url1], cues, fitwillUrl}` y `openTechnique(exerciseId)` que abre un modal con la animación. Fitwill no tiene API pública ni permite incrustar su video, así que el modal muestra la animación y un botón "Ver video en Fitwill" que abre la página.

## Seguridad (obligatorio)
- RLS activado en todas las tablas; políticas `user_id = auth.uid()` para select/insert/update/delete. Ningún service key en el cliente.
- Content-Security-Policy en `<meta>`: `default-src 'self'`; scripts solo 'self' + cdn.jsdelivr.net; `connect-src` 'self' + https://*.supabase.co + wss://*.supabase.co; `img-src` 'self' data: cdn.jsdelivr.net; `frame-ancestors` no aplica en meta (documentarlo); sin `unsafe-inline` en scripts (nada de JS inline ni handlers `onclick=`).
- SRI en todo script de CDN. `referrer` = `strict-origin-when-cross-origin`.
- Nunca `innerHTML` con datos del usuario o de la BD: usar `textContent` / `createElement`.
- Validación en cliente y en la BD (CHECK constraints: peso 0–1000, reps 0–1000, sets ≤ 50 por ejercicio, textos con longitud máxima).
- Contraseña mínima 10 caracteres; confirmar email obligatorio (documentado en supabase/README.md); recomendar activar protección de contraseñas filtradas y CAPTCHA (hCaptcha/Turnstile) y límites de tasa en Supabase.
- Sesión: supabase-js con `persistSession` y refresh automático; cerrar sesión limpia caché local.
- Service worker: solo cachea archivos estáticos propios y `data/*.json`; nunca respuestas de Supabase.
- Funcion `delete_my_account()` SECURITY DEFINER con `search_path` fijo que borra solo los datos de `auth.uid()`.

## Diseño
Mobile first (360–430 px), barra de navegación inferior (Hoy, Registrar, Progreso, Cuerpo, Biblioteca), modo oscuro por defecto con tema claro, botones grandes (≥ 44 px), tipografía del sistema, colores del semáforo accesibles con etiqueta de texto (no solo color). Funciona offline para consultar la biblioteca; el registro sin conexión se guarda en cola local y se sube al reconectar.

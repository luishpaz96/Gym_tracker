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

## Navegación
Barra inferior: **Track**, **Comida** (Alimentación), **Recetas**, **Summary**, **Biblioteca**. La cuenta vive en el engrane del encabezado (`#/cuenta`). Las rutas antiguas (`#/hoy`, `#/registrar`, `#/progreso`, `#/cuerpo`) redirigen a Track o Summary.

## Funciones de la app
1. **Auth** (pantalla inicial): registro e inicio con email + contraseña, enlace mágico, recuperación de contraseña. Teléfono (OTP por SMS) detrás de `config.PHONE_AUTH_ENABLED=false`. Cerrar sesión, borrar cuenta y datos, exportar mis datos (JSON) en Cuenta.
2. **Onboarding** (obligatorio tras registrarse, editable en Cuenta): edad (13–100, se guarda `birth_year`), sexo (Hombre/Mujer), estatura (120–230 cm), peso actual (30–300 kg), peso meta (30–300 kg), días de entrenamiento por semana (2–6). Validación en cliente (`js/profile.js`) y en BD (CHECK + trigger de edad). El peso actual crea la primera fila de `body_weights`. Al terminar se genera y guarda el plan.
3. **Plan personalizado** (`js/plan-generator.js`, puro): días/semana → división (2: cuerpo completo A/B; 3: pecho+bíceps+abdomen / pierna / espalda+hombro+trapecio+tríceps; 4: torso/pierna ×2; 5: torso/pierna/empuje/jalón/pierna; 6: empuje/jalón/pierna ×2). Ejercicios de `data/exercises.json` (gimnasio primero; 2 por músculo grande, 1 por pequeño). Meta según peso meta vs actual: subir = hipertrofia (6–12 reps, mesociclos de 4 semanas con semana 4 de descarga y progresión de series), bajar = mismo trabajo de fuerza + consejos de cardio/pasos y déficit, igual = recomposición. Se guarda en `user_plans` (jsonb, un plan por usuario); se regenera al cambiar días o meta (con confirmación) y si vence. `data/plan.json` queda como preset "Plan Regreso al gym (3 días)" seleccionable en Cuenta.
4. **Track** (único lugar para registrar):
   - "Rutina recomendada": sesión del plan activo de hoy (o la siguiente pendiente), ajustada por el semáforo semanal (músculos en rojo/amarillo se marcan "Te falta: …" y se agregan 1–2 ejercicios). Botón "Usar esta rutina".
   - Buscador sin acentos + chips de grupo + sección "Recomendados" (plan de hoy, luego ejercicios para músculos en rojo/amarillo).
   - Por ejercicio: series con peso y reps (RIR opcional, colapsado), "+ Serie".
   - Panel "Última vez" por ejercicio: fecha y todas las series, más una sugerencia de sobrecarga (`js/overload.js`): todas las series en el tope del rango del plan → "Sube 2.5 kg"; si no → "Intenta +1 rep en la serie N". Los valores anteriores son placeholders.
   - Guardar → pantalla de calificación (A–D y Mejoraste/Igual/Bajaste por ejercicio). Sin conexión: cola local.
5. **Summary**: mapa corporal (frente/espalda) con semáforo de la semana actual (lun–dom: verde ≥100 % de `target_sets`, amarillo 50–99 %, rojo <50 %, gris sin datos; con etiqueta de texto); tocar un músculo muestra series y ejercicios; **Peso corporal** (registro rápido en cualquier fecha, gráfica con promedio semanal y línea de peso meta); **Consejos** (`js/tips.js`, 3–5: sesiones vs plan, ritmo de peso sano —subir 0.25–0.5 %/sem, bajar 0.5–1 %/sem—, músculos por reforzar, ejercicios que bajaron o se estancaron, racha); gráficas: volumen por sesión, series semanales por músculo, 1RM estimado (Epley) por ejercicio; historial.
6. **Volumen**: Σ peso × reps por set; por sesión, ejercicio y músculo (series efectivas: principal 1, secundario 0.5).
7. **Biblioteca**: búsqueda y filtro por grupo; ficha con animación, técnica, alternativa y "Ver video" (`js/technique.js`).
8. **Técnica / "API" de video**: `getTechnique(exerciseId)` → `{frames, cues, fitwillUrl}` y `openTechnique(exerciseId)`. Fitwill no permite incrustar su video: se muestra la animación y un botón que abre su página.
9. **Modo demo** (`?demo=1`): datos falsos en localStorage (perfil, 6 semanas de pesos, plan generado y sesiones), claramente rotulado; nunca toca Supabase.

## Unidades kg / lb
Selector kg | lb en Track (sesión), Summary (peso corporal), onboarding y Cuenta. Se guarda en `profiles.unit`; los pesos siempre se almacenan en kg (`js/units.js`: 1 lb = 0.45359237 kg, pantalla redondeada a 0.5; peso corporal a 0.1; al guardar se conserva kg con 2 decimales). Al cambiar la unidad se convierten los valores ya tecleados; la sobrecarga sugiere +2.5 kg o +5 lb.

Cada tarjeta de ejercicio tiene su propio kg | lb. Por defecto usa la unidad de la última vez que se registró ese ejercicio (`sets.unit`), y si no hay, `profiles.unit`. El selector de sesión significa "aplicar a todos". Se guarda en kg y la unidad original, así "Última vez" muestra exactamente lo capturado (135 lb se queda en 135 lb).

## Flujo de Track (UX)
1) Vacío: "Empezar entrenamiento" y "Usar rutina recomendada". 2) Entrenando: barra fija con tiempo, series hechas/total y "Terminar"; tarjetas colapsables (una abierta); peso/reps con −/+ (2.5 kg / 5 lb y ±1), "Serie hecha" inicia el descanso (hoja inferior con −15/+15 s, Saltar y vibración); "Última vez" en una línea; RIR y Drop set en el menú ⋯ de cada serie. 3) Terminar → calificación. Lógica pura en `js/session.js`. El selector de ejercicios (`js/screens/picker.js`) es una hoja a pantalla completa con Recomendados, Recientes, selección múltiple y "Mostrar más" (escala a cientos de ejercicios); Comida usa la misma hoja con Recientes primero. Tras el onboarding se muestra una guía de 3 tarjetas (una vez por usuario).

## Fotos de recetas
`js/recipe-photos.js` consulta Wikimedia Commons desde el teléfono (CORS `origin=*`, sin llaves) con `photo_q` (o el nombre) y toma la primera imagen jpeg/png/webp con licencia CC0, dominio público, CC BY o CC BY-SA; el resultado (también "sin foto") se guarda 30 días en localStorage, con máx. 4 consultas a la vez y solo para tarjetas visibles. Sin foto o sin red no se muestra nada (la tarjeta queda como sin fotos); la imagen se inserta solo después de cargar bien. CSP: `connect-src` commons.wikimedia.org e `img-src` upload.wikimedia.org.

## Drop sets
Cada serie tiene "Drop set": sub-panel con Drop 1…6 (peso y reps en la unidad del ejercicio; el peso sugerido es ~22 % menos que el anterior, a 2.5 kg / 5 lb). Se guardan en `sets.drops` (jsonb, arreglo de {weight_kg, reps, unit}, máx. 6, CHECK en BD). Volumen y calificación incluyen los drops; el 1RM estimado y la sobrecarga usan solo la serie principal; las series efectivas por músculo cuentan una serie con drops como 1 + 0.5 por drop, hasta +1. Si la columna falta (schema.sql sin re-ejecutar), los drops quedan en el dispositivo y aparece el aviso de actualizar la base.

## Botón ▶ de técnica
`playButton` (js/technique.js) abre la animación de técnica sin seleccionar el ejercicio (≥44 px). Está en el selector de Track (búsqueda, por grupo, Recomendados), Rutina recomendada, tarjetas de sesión, Biblioteca y detalle de músculo en Summary. La animación se reproduce sola, con botón Pausar/Reproducir.

## Proteínas en polvo
Comida → Proteínas → "Proteína en polvo" (`data/protein_powders.json`, valores por scoop de etiqueta de EE. UU.; fibra/azúcar pueden ser null). Búsqueda sin acentos, agrupado por marca, detalle con fuente, agregar por scoops (0.5) o gramos (`food_logs.source = 'powder'`, servings = scoops). "Mi proteína" (`profiles.favorite_powder`) con botón "+1 scoop" en cada comida. "Agregar mi proteína": hasta 10 por usuario en `profiles.custom_powders` (jsonb, validado en cliente y CHECK en BD), con chip "personalizada".

## Alimentación y recetas (ver NUTRITION_SPEC.md)
- **Comida**: metas diarias (kcal, P, C, G, fibra) con `js/nutrition.js` a partir del perfil (Mifflin-St Jeor, factor por días de entreno, ajuste por meta, "¿Cómo se calcula?"); pestañas Día / Proteínas / Plan. Plan de comidas: 3–6 por día con nombre y hora (`profiles.meals_per_day`, `meal_plan`), reparto de kcal y proteína por comida. Registro por comida y fecha desde recetas (porciones decimales), alimentos (gramos o porción casera) y "Proteínas populares" (`protein_pick`); barras de avance por comida y por día, editar, quitar y copiar la comida de ayer.
- **Recetas**: categorías de `recipe_categories.json`, búsqueda sin acentos (nombre, ingrediente, etiqueta), filtros (alta en proteína, <30 min, <500 kcal, favoritas), listas paginadas, `recipes.json` cargado una sola vez bajo demanda; detalle con macros por porción, ingredientes (g y porción casera), pasos y "Agregar a comida".
- `food_logs`: snapshot de kcal/P/C/G/fibra y etiqueta por renglón (no depende del catálogo). Cola sin conexión (`gt_fqueue_<uid>`). Se incluye en exportar y en `delete_my_account()`.
- **Summary** suma adherencia (días con kcal ±10 % y proteína ≥90 %), comidas registradas, gráficas de 14 días y consejos de nutrición.

## Datos de usuario (Supabase)
`profiles` (unit, display_name, birth_year, sex, height_cm, goal_weight_kg, days_per_week), `workouts`, `workout_exercises`, `sets`, `food_logs`, `body_weights` (único por usuario y fecha), `user_plans` (plan jsonb + source generated|preset). Todo con RLS por `user_id`.

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
Mobile first (360–430 px), barra de navegación inferior (Track, Summary, Biblioteca), modo oscuro por defecto con tema claro, botones grandes (≥ 44 px), tipografía del sistema, colores del semáforo accesibles con etiqueta de texto (no solo color). Funciona offline para consultar la biblioteca; el registro sin conexión se guarda en cola local y se sube al reconectar.

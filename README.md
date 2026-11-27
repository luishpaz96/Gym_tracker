# Gym Tracker

App web móvil (PWA) en español de México para registrar entrenamientos. Menús: **Track** (rutina recomendada, registro de series con "última vez" y sugerencia de sobrecarga, calificación A–D), **Summary** (mapa corporal con semáforo semanal, peso corporal, consejos y gráficas) y **Comida** (metas de calorías y macros, plan de comidas y registro por comida), **Recetas** (1 200 recetas por categoría con "Agregar a comida"), **Biblioteca** (ejercicios con animación y técnica). La cuenta está en el engrane. Tras registrarte, un onboarding (edad, sexo, estatura, peso, peso meta, días por semana) genera tu plan personalizado.

**App:** <https://luishpaz96.github.io/gym_tracker/>
**Demo sin cuenta:** <https://luishpaz96.github.io/gym_tracker/?demo=1> (datos de muestra en tu navegador; no usa Supabase).

El progreso de cada persona vive en **Supabase** (Auth + Postgres con RLS), nunca en este repositorio público.

## Activar GitHub Pages
1. En GitHub: **Settings → Pages**.
2. **Build and deployment → Source: Deploy from a branch**.
3. **Branch: `main`** y carpeta **`/ (root)`** → **Save**.
4. En ~1 minuto estará en `https://luishpaz96.github.io/gym_tracker/`.

## Conectar Supabase
Sigue [`supabase/README.md`](supabase/README.md) (crear proyecto, ejecutar `schema.sql`, configurar Auth) y pega `SUPABASE_URL` y `SUPABASE_ANON_KEY` en [`js/config.js`](js/config.js). Mientras estén vacíos, la app muestra "Configuración pendiente".

## Estructura
- `index.html`, `css/app.css`, `js/` (módulos ES, sin paso de build), `sw.js`, `manifest.webmanifest`, `icons/`.
- `data/` — músculos, ejercicios y plan (JSON de solo lectura).
- `js/calc.js`, `grading.js`, `recommend.js`, `search.js`, `overload.js`, `tips.js`, `weight.js`, `plan-generator.js`, `profile.js`, `nutrition.js` — lógica pura con pruebas.
- `supabase/schema.sql` — tablas, RLS, restricciones y `delete_my_account()`.

## Pruebas
```
node --test tests/run.mjs
```

## Desarrollo local
```
python3 -m http.server 8000
# http://localhost:8000/?demo=1
```

## Seguridad (resumen)
CSP en `<meta>` sin scripts ni estilos en línea, SRI en las librerías del CDN, sin `innerHTML` con datos, RLS en todas las tablas, restricciones CHECK en la base, contraseña mínima de 10 caracteres y confirmación de correo obligatoria. Detalles y límites (p. ej. `frame-ancestors`) en `supabase/README.md`.

Animaciones de ejercicios: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense). Los videos de Fitwill solo se enlazan (no se incrustan).

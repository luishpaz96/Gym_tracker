// Formulario de perfil: onboarding obligatorio tras registrarse y edición posterior (Cuenta).
import { el, toast, confirmDialog } from '../ui.js';
import { validateProfileInput, ageOf } from '../profile.js';
import { today } from '../stats.js';
import { regenerate, latestWeight } from '../planctl.js';

function field(label, input, hint) {
  const err = el('span', { class: 'field-err', role: 'alert' });
  return { err, node: el('label', { class: 'field' }, el('span', { text: label }), input, hint ? el('small', { class: 'muted', text: hint }) : null, err) };
}
const numInput = (name, ph, inputmode = 'decimal', value = '') => el('input', { class: 'input', name, type: 'text', inputmode, placeholder: ph, value: value === null ? '' : String(value), autocomplete: 'off', maxlength: 6 });

// mode: 'onboarding' | 'edit'. onDone() se llama tras guardar.
export function renderProfileForm(ctx, host, { mode, onDone }) {
  const p = ctx.profile || {};
  const cur = latestWeight(ctx.weights || []);
  const f = {
    age: numInput('age', 'ej. 28', 'numeric', ageOf(p) ?? ''),
    sex: el('select', { class: 'input', name: 'sex', 'aria-label': 'Sexo' }, el('option', { value: '', text: 'Elegir…' }), el('option', { value: 'M', text: 'Hombre' }), el('option', { value: 'F', text: 'Mujer' })),
    height_cm: numInput('height_cm', 'ej. 175', 'decimal', p.height_cm ?? ''),
    weight_kg: numInput('weight_kg', 'ej. 80', 'decimal', mode === 'edit' ? '' : (cur ?? '')),
    goal_weight_kg: numInput('goal_weight_kg', 'ej. 75', 'decimal', p.goal_weight_kg ?? ''),
    days_per_week: el('select', { class: 'input', name: 'days_per_week', 'aria-label': 'Días por semana' }, el('option', { value: '', text: 'Elegir…' }), [2, 3, 4, 5, 6].map((n) => el('option', { value: String(n), text: `${n} días` }))),
  };
  f.sex.value = p.sex || ''; f.days_per_week.value = p.days_per_week ? String(p.days_per_week) : '';
  const rows = {
    age: field('Edad (años)', f.age), sex: field('Sexo', f.sex), height_cm: field('Estatura (cm)', f.height_cm),
    weight_kg: field(mode === 'edit' ? 'Peso actual (kg) — opcional, registra hoy' : 'Peso actual (kg)', f.weight_kg),
    goal_weight_kg: field('Peso meta (kg)', f.goal_weight_kg), days_per_week: field('Días de entrenamiento por semana', f.days_per_week, 'Define tu plan: 2 a 6 días.'),
  };
  const btn = el('button', { class: 'btn primary block big', type: 'submit' }, mode === 'edit' ? 'Guardar perfil' : 'Guardar y crear mi plan');
  const form = el('form', { novalidate: true }, Object.values(rows).map((r) => r.node), btn);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const raw = Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value.trim()]));
    const v = validateProfileInput(raw, new Date().getFullYear(), { needWeight: mode !== 'edit' });
    Object.entries(rows).forEach(([k, r]) => { r.err.textContent = v.errors[k] || ''; });
    if (!v.ok) return;
    btn.disabled = true;
    try {
      const changedPlanInputs = mode === 'edit' && (v.values.days_per_week !== p.days_per_week || v.values.goal_weight_kg !== p.goal_weight_kg);
      if (changedPlanInputs && !(await confirmDialog('Regenerar plan', 'Cambiaste tus días o tu peso meta. ¿Quieres regenerar tu plan de entrenamiento con estos datos?', 'Regenerar plan'))) {
        // Se guardan los datos, pero se conserva el plan actual
        v.keepPlan = true;
      }
      ctx.profile = { ...p, unit: p.unit || 'kg', birth_year: v.values.birth_year, sex: v.values.sex, height_cm: v.values.height_cm, goal_weight_kg: v.values.goal_weight_kg, days_per_week: v.values.days_per_week };
      await ctx.api.saveProfile(ctx.profile);
      if (v.values.weight_kg) { await ctx.api.addBodyWeight(today(), v.values.weight_kg); ctx.weights = await ctx.api.listBodyWeights(); }
      if (mode === 'onboarding' || (changedPlanInputs && !v.keepPlan)) await regenerate(ctx);
      toast(mode === 'edit' ? 'Perfil guardado' : 'Listo, tu plan está creado');
      onDone?.();
    } catch (e) { console.warn(e?.message); toast('No se pudo guardar. Revisa los datos e intenta de nuevo.', 'bad'); }
    finally { btn.disabled = false; }
  });
  host.append(form);
}

export function renderOnboarding(ctx, root, onDone) {
  root.append(el('div', { class: 'auth-wrap' }, el('h1', { text: 'Cuéntanos de ti' }),
    el('p', { class: 'muted', text: 'Con estos datos creamos tu plan de entrenamiento y seguimos tu peso. Podrás editarlos en Cuenta.' }),
    (() => { const c = el('div', { class: 'card' }); renderProfileForm(ctx, c, { mode: 'onboarding', onDone }); return c; })()));
}

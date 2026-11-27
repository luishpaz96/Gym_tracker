// Plan activo del usuario: generado a partir del perfil o el preset data/plan.json.
import { generatePlan, goalFor, planEndDate } from './plan-generator.js';
import { weekStart } from './calc.js';
import { profileComplete } from './profile.js';
import { today } from './stats.js';

export const PRESET_NAME = 'Plan Regreso al gym (3 días)';

export const latestWeight = (weights) => (weights.length ? weights[weights.length - 1].weight_kg : null);
export const goalOf = (profile, weights) => {
  const cur = latestWeight(weights);
  return cur && profile?.goal_weight_kg ? goalFor(cur, profile.goal_weight_kg) : 'recomp';
};

export function buildGenerated(ctx) {
  return generatePlan({ days: ctx.profile.days_per_week, goal: goalOf(ctx.profile, ctx.weights), exercises: ctx.data.exercises, start: weekStart(today()), weeks: 16 });
}
export function presetPlan(ctx) { return { ...ctx.data.plan, meta: { name: PRESET_NAME, preset: true } }; }

export async function regenerate(ctx) {
  const plan = buildGenerated(ctx);
  await ctx.api.savePlan(plan, 'generated');
  ctx.plan = plan; ctx.planSource = 'generated';
}
export async function usePreset(ctx) {
  const plan = presetPlan(ctx);
  await ctx.api.savePlan(plan, 'preset');
  ctx.plan = plan; ctx.planSource = 'preset';
}

// Carga el plan activo; si falta o venció (y es generado), lo genera de nuevo con los mismos datos.
export async function ensurePlan(ctx) {
  let r = null;
  try { r = await ctx.api.getPlan(); } catch { /* sin conexión */ }
  if (r?.plan && (r.source === 'preset' || (planEndDate(r.plan) || '') >= today())) { ctx.plan = r.plan; ctx.planSource = r.source; return; }
  if (profileComplete(ctx.profile)) {
    try { await regenerate(ctx); return; } catch { ctx.plan = buildGenerated(ctx); ctx.planSource = 'generated'; return; }
  }
  ctx.plan = r?.plan || presetPlan(ctx); ctx.planSource = r?.source || 'preset';
}

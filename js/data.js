// Carga de datos de solo lectura (data/*.json).
let cache = null;
async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`No se pudo cargar ${path} (${r.status})`);
  return r.json();
}
const lazy = {};
async function tryJSON(path, fallback) { try { return await getJSON(path); } catch { return fallback; } }
// Catálogos de nutrición (estáticos). recipes.json es grande: se carga una sola vez y solo cuando se necesita.
export function loadFoods() { return (lazy.foods ||= tryJSON('data/foods.json', []).then((foods) => ({ foods, foodById: Object.fromEntries(foods.map((f) => [f.id, f])) }))); }
export function loadPowders() { return (lazy.powders ||= tryJSON('data/protein_powders.json', []).then((powders) => ({ powders, powderById: Object.fromEntries(powders.map((x) => [x.id, x])) }))); }
export function loadRecipes() {
  return (lazy.recipes ||= Promise.all([tryJSON('data/recipes.json', []), tryJSON('data/recipe_categories.json', []), loadFoods()]).then(([recipes, categories, fd]) => ({ recipes, categories, recipeById: Object.fromEntries(recipes.map((r) => [r.id, r])), ...fd })));
}
export async function loadData() {
  if (cache) return cache;
  const [muscles, exercises, plan] = await Promise.all([getJSON('data/muscles.json'), getJSON('data/exercises.json'), getJSON('data/plan.json')]);
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const muscleById = Object.fromEntries(muscles.map((m) => [m.id, m]));
  const groups = [...new Set(exercises.map((e) => e.group))];
  cache = { muscles, exercises, plan, exById, muscleById, groups };
  return cache;
}

// Carga de datos de solo lectura (data/*.json).
let cache = null;
async function getJSON(path) {
  const r = await fetch(path, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`No se pudo cargar ${path} (${r.status})`);
  return r.json();
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

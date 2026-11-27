// Buscador de ejercicios sin acentos, por nombre y sinónimos (keywords).
export const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function scoreExercise(ex, q) {
  const tokens = q.split(' ').filter(Boolean);
  if (!tokens.length) return 1;
  const name = normalize(ex.name);
  const kws = (ex.keywords || []).map(normalize);
  const rest = normalize([ex.group, ex.equipment].join(' '));
  const hay = [name, ...kws, rest].join(' | ');
  if (!tokens.every((t) => hay.includes(t))) return 0;
  let score = 10;
  if (name.startsWith(q)) score += 100;
  else if (name.split(' ').some((w) => w.startsWith(q))) score += 60;
  else if (name.includes(q)) score += 40;
  if (kws.some((k) => k === q)) score += 50;
  else if (kws.some((k) => k.includes(q))) score += 20;
  for (const t of tokens) if (name.includes(t)) score += 5;
  return score;
}

export function searchExercises(list, { query = '', group = null, where = null } = {}) {
  const q = normalize(query);
  return (list || [])
    .filter((e) => (!group || e.group === group) && (!where || (e.where || []).includes(where)))
    .map((e) => ({ e, s: scoreExercise(e, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name, 'es'))
    .map((x) => x.e);
}

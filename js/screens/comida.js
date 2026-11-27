// Alimentación: metas diarias, plan de comidas y registro por comida; proteínas populares.
import { el, clear, icon, toast, fmtNum, openModal, confirmDialog, openSheet, pageHead, emptyState } from '../ui.js';
import { loadFoods, loadRecipes } from '../data.js';
import { allPowders, renderPowders, openPowder, matchPowder, quickAddScoop, favoritePowder, powderTitle } from './powders.js';
import { normalize } from '../search.js';
import { today, targetsOf } from '../stats.js';
import { addDays } from '../calc.js';
import { mealPlanOf, splitMeals, dayTotals, mealEntries, sumEntries, MEAL_DEFAULTS, clampMeals } from '../nutrition.js';
import { newId } from '../api.js';
import { openLogEntry, openEditEntry } from './logentry.js';
import { GOAL_LABEL } from '../plan-generator.js';

const st = { date: null, tab: 'dia' };
const dayLabel = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function bar(label, value, target, unit) {
  const pct = target ? Math.round((value / target) * 100) : 0;
  const p = el('progress', { max: '100', 'aria-label': `${label}: ${pct} %` }); p.value = Math.min(100, pct);
  p.className = pct > 110 ? 'over' : pct >= 90 ? 'ok' : '';
  return el('div', { class: 'bar-row' }, el('div', { class: 'row between' }, el('strong', { text: label }), el('span', { class: 'muted small', text: `${fmtNum(value, unit === 'kcal' ? 0 : 1)} / ${fmtNum(target)} ${unit} · ${pct} %` })), p);
}

export async function render(ctx, root) {
  st.date ||= today();
  const targets = targetsOf(ctx);
  let favP = await favoritePowder(ctx);
  root.append(pageHead('Alimentación', 'Tus metas del día y lo que has comido, comida por comida.'));
  const tabs = el('div', { class: 'seg', role: 'group', 'aria-label': 'Sección' });
  const host = el('div');
  [['dia', 'Día'], ['proteinas', 'Proteínas'], ['plan', 'Plan']].forEach(([id, label]) => tabs.append(el('button', { class: `seg-btn${st.tab === id ? ' on' : ''}`, type: 'button', 'aria-pressed': String(st.tab === id), on: { click: () => { st.tab = id; [...tabs.children].forEach((b, i) => { const on = ['dia', 'proteinas', 'plan'][i] === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }); draw(); } } }, label)));
  root.append(tabs, host);
  if (!targets) { root.append(el('p', { class: 'banner warn', text: 'Completa tu perfil (estatura, edad, peso) en Cuenta para calcular tus metas.' })); }
  const draw = async () => { favP = await favoritePowder(ctx); clear(host); (st.tab === 'dia' ? dia : st.tab === 'proteinas' ? proteinas : plan)(ctx, host, targets, draw, favP); };
  draw();
}

function formulaDetails(ctx, t) {
  const p = ctx.profile;
  return el('details', { class: 'formula' }, el('summary', { text: '¿Cómo se calcula?' }), el('div', { class: 'small' },
    el('p', { text: `Meta: ${GOAL_LABEL[t.goal]}.` }),
    el('p', { text: `TMB (Mifflin-St Jeor) = 10×peso + 6.25×estatura − 5×edad ${p.sex === 'F' ? '− 161' : '+ 5'} = ${t.bmr} kcal.` }),
    el('p', { text: `Gasto total = TMB × ${t.factor} (por ${p.days_per_week} días de entreno) = ${t.tdee} kcal.` }),
    el('p', { text: t.goal === 'gain' ? 'Para subir: +10 % (máx. +300 kcal).' : t.goal === 'lose' ? 'Para bajar: −20 % (mínimo TMB × 1.1).' : 'Mantenimiento: sin ajuste.' }),
    el('p', { text: `Proteína ${t.goal === 'lose' ? '2.2' : '2.0'} g/kg, grasa 0.9 g/kg (mín. 20 % de las kcal), carbohidratos el resto, fibra 14 g por 1 000 kcal. Se recalcula al cambiar tu peso o perfil.` })));
}

function dia(ctx, host, targets, redraw, favP) {
  const date = st.date, plan = mealPlanOf(ctx.profile);
  const logs = ctx.foodLogs;
  const nav = el('div', { class: 'date-nav' },
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Día anterior', on: { click: () => { st.date = addDays(date, -1); redraw(); } } }, '‹'),
    el('div', { class: 'grow center' }, el('strong', { text: dayLabel(date) }), el('input', { class: 'input date-small', type: 'date', value: date, max: '2100-01-01', 'aria-label': 'Fecha', on: { change: (e) => { if (e.target.value) { st.date = e.target.value; redraw(); } } } })),
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Día siguiente', on: { click: () => { st.date = addDays(date, 1); redraw(); } } }, '›'));
  host.append(nav);
  const tot = dayTotals(logs, date);
  if (targets) {
    host.append(el('section', { class: 'card' }, el('h2', { text: 'Metas del día' }),
      bar('Calorías', tot.kcal, targets.kcal, 'kcal'), bar('Proteína', tot.p, targets.p, 'g'), bar('Carbohidratos', tot.c, targets.c, 'g'), bar('Grasa', tot.f, targets.f, 'g'), bar('Fibra', tot.fiber, targets.fiber, 'g'),
      formulaDetails(ctx, targets)));
  }
  if (!logs.some((e) => e.logged_on === date)) host.append(emptyState('Aún no registras comida este día', 'Toca "+ Agregar" en una comida para buscar alimentos, recetas o tu proteína en polvo.'));
  const split = targets ? splitMeals(targets, plan) : plan;
  split.forEach((m) => {
    const entries = mealEntries(logs, date, m.slot), t = sumEntries(entries);
    const card = el('section', { class: 'card meal' }, el('div', { class: 'row between' }, el('h2', { text: m.name }), el('span', { class: 'muted small', text: m.time })));
    card.append(el('p', { class: 'muted small', text: targets ? `${fmtNum(t.kcal)} / ${m.kcal} kcal · P ${fmtNum(t.p, 1)} / ${m.p} g` : `${fmtNum(t.kcal)} kcal · P ${fmtNum(t.p, 1)} g` }));
    if (targets) { const pr = el('progress', { max: '100', 'aria-label': `${m.name}: avance de calorías` }); pr.value = Math.min(100, Math.round((t.kcal / m.kcal) * 100)); card.append(pr); }
    if (entries.length) card.append(el('ul', { class: 'list' }, entries.map((e) => el('li', { class: 'list-item' },
      el('div', { class: 'grow' }, el('strong', { text: e.label || e.ref_id }),
        el('div', { class: 'muted small', text: `${e.source === 'recipe' ? `${fmtNum(e.servings, 2)} porc.` : e.source === 'powder' ? `${fmtNum(e.servings, 2)} scoop` : `${fmtNum(e.grams, 1)} g`} · ${fmtNum(e.kcal)} kcal · P ${fmtNum(e.p, 1)} g` })),
      el('button', { class: 'btn small', type: 'button', 'aria-label': `Editar ${e.label}`, on: { click: () => openEditEntry(ctx, e, redraw) } }, 'Editar'),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': `Quitar ${e.label}`, on: { click: async () => { try { await ctx.api.deleteFoodLog(e.id); await ctx.refreshFood(); redraw(); } catch { toast('No se pudo quitar', 'bad'); } } } }, icon('borrar')))))); 
    const prev = mealEntries(logs, addDays(date, -1), m.slot);
    card.append(el('div', { class: 'row gap' },
      el('button', { class: 'btn small grow primary', type: 'button', on: { click: () => openPicker(ctx, { date, slot: m.slot, onSaved: redraw }) } }, '+ Agregar'),
      favP ? el('button', { class: 'btn small', type: 'button', 'aria-label': `Agregar 1 scoop de ${powderTitle(favP)} a ${m.name}`, on: { click: () => quickAddScoop(ctx, favP, date, m.slot, redraw) } }, '+1 scoop') : null,
      prev.length ? el('button', { class: 'btn small grow', type: 'button', on: { click: async () => {
        if (entries.length && !(await confirmDialog('Copiar de ayer', `Se agregarán ${prev.length} renglones a ${m.name}.`, 'Copiar'))) return;
        try { for (const e of prev) await ctx.api.saveFoodLog({ ...e, id: newId(), logged_on: date }); await ctx.refreshFood(); toast('Comida copiada'); redraw(); } catch { toast('No se pudo copiar', 'bad'); }
      } } }, 'Copiar de ayer') : null));
    host.append(card);
  });
}

// ---- Selector para agregar: recetas / alimentos / proteínas ----
export async function openPicker(ctx, { date, slot, onSaved, initialTab = 'alimentos' }) {
  const [{ foods }, rd, powders] = await Promise.all([loadFoods(), loadRecipes(), allPowders(ctx)]);
  let tab = initialTab, query = '';
  // Recientes: lo último que registraste (sin repetir), resuelto contra los catálogos
  const recents = (() => {
    const seen = new Set(), out = [];
    for (const e of [...(ctx.foodLogs || [])].sort((a, b) => b.logged_on.localeCompare(a.logged_on))) {
      const k = `${e.source}:${e.ref_id}`; if (seen.has(k)) continue; seen.add(k);
      let item = null, kind = e.source;
      if (e.source === 'recipe') item = rd.recipeById?.[e.ref_id];
      else if (e.source === 'powder') { item = powders.find((x) => x.id === e.ref_id); }
      else item = foods.find((f) => f.id === e.ref_id);
      if (item) out.push({ kind, item });
      if (out.length >= 6) break;
    }
    return out;
  })();
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar', maxlength: 60, autocomplete: 'off' });
  const list = el('ul', { class: 'list' });
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Origen' });
  const tabs = [['alimentos', 'Alimentos'], ['recetas', 'Recetas'], ['proteinas', 'Proteínas']];
  tabs.forEach(([id, label]) => seg.append(el('button', { class: 'seg-btn', type: 'button', on: { click: () => { tab = id; fill(); } } }, label)));
  const match = (name, kws, q) => { if (!q) return true; const h = normalize(`${name} ${(kws || []).join(' ')}`); return q.split(' ').every((t) => h.includes(t)); };
  function fill() {
    [...seg.children].forEach((b, i) => { const on = tabs[i][0] === tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    clear(list);
    const q = normalize(query);
    if (!q && recents.length) {
      list.append(el('h3', { class: 'sub', text: 'Recientes' }));
      recents.forEach(({ kind, item }) => {
        const go = kind === 'recipe' ? () => openLogEntry(ctx, { kind: 'recipe', item, date, slot, onSaved: (e) => { box.close(); onSaved?.(e); } })
          : kind === 'powder' ? () => openPowder(ctx, item, { date, slot, onChange: () => { box.close(); onSaved?.(); } })
          : () => openLogEntry(ctx, { kind: 'food', item, date, slot, onSaved: (e) => { box.close(); onSaved?.(e); } });
        list.append(el('li', {}, el('button', { class: 'pick', type: 'button', on: { click: go } }, el('span', { class: 'grow' }, el('strong', { text: kind === 'powder' ? powderTitle(item) : item.name }), el('span', { class: 'muted small block', text: kind === 'recipe' ? 'Receta' : kind === 'powder' ? 'Proteína en polvo' : 'Alimento' })), el('span', { class: 'plus', 'aria-hidden': 'true', text: '+' }))));
      });
      list.append(el('h3', { class: 'sub', text: 'Todo el catálogo' }));
    }
    let rows;
    if (tab === 'recetas') rows = rd.recipes.filter((r) => match(r.name, r.tags, q)).slice(0, 40).map((r) => ({ t: r.name, s: `${r.per_serving.kcal} kcal · P ${r.per_serving.p} g por porción`, go: () => openLogEntry(ctx, { kind: 'recipe', item: r, date, slot, onSaved: (e) => { box.close(); onSaved?.(e); } }) }));
    else {
      const src = tab === 'proteinas' ? foods.filter((f) => f.protein_pick).sort((a, b) => b.p - a.p) : foods;
      const prow = powders.filter((x) => matchPowder(x, query)).slice(0, tab === 'alimentos' && !q ? 5 : 20).map((x) => ({ t: powderTitle(x), s: `Proteína en polvo · P ${x.p} g · ${x.kcal} kcal por scoop`, go: () => openPowder(ctx, x, { date, slot, onChange: () => { box.close(); onSaved?.(); } }) }));
      const frows = src.filter((f) => match(f.name, f.keywords, q)).slice(0, 40).map((f) => ({ t: f.name, s: `${f.kcal} kcal · P ${f.p} g por 100 g`, go: () => openLogEntry(ctx, { kind: 'food', item: f, date, slot, onSaved: (e) => { box.close(); onSaved?.(e); } }) }));
      rows = tab === 'proteinas' ? [...prow, ...frows] : [...(q ? prow : []), ...frows, ...(q ? [] : prow)];
    }
    if (!rows.length) list.append(el('li', { class: 'muted pad', text: tab === 'recetas' && !rd.recipes.length ? 'Las recetas aún no están disponibles.' : 'Sin resultados.' }));
    rows.forEach((r) => list.append(el('li', {}, el('button', { class: 'pick', type: 'button', on: { click: r.go } }, el('span', { class: 'grow' }, el('strong', { text: r.t }), el('span', { class: 'muted small block', text: r.s })), el('span', { class: 'plus', 'aria-hidden': 'true', text: '+' })))));
  }
  search.addEventListener('input', () => { query = search.value; fill(); });
  const box = openSheet('Agregar a la comida');
  box.body.append(el('div', { class: 'sheet-top' }, seg, el('div', { class: 'search' }, icon('buscar'), search)), list);
  fill(); search.focus();
}

// ---- Proteínas: proteína en polvo (marcas) y alimentos ----
async function proteinas(ctx, host, targets, redraw) {
  const sub = el('div', { class: 'seg', role: 'group', 'aria-label': 'Tipo de proteína' });
  const body = el('div');
  const tabs = [['polvo', 'Proteína en polvo'], ['alimentos', 'Alimentos']];
  tabs.forEach(([id, label]) => sub.append(el('button', { class: 'seg-btn', type: 'button', on: { click: () => { st.ptab = id; show(); } } }, label)));
  host.append(sub, body);
  function show() {
    st.ptab ||= 'polvo';
    [...sub.children].forEach((b, i) => { const on = tabs[i][0] === st.ptab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    clear(body);
    if (st.ptab === 'polvo') renderPowders(ctx, body, redraw); else proteinFoods(ctx, body);
  }
  show();
}

async function proteinFoods(ctx, host) {
  const { foods } = await loadFoods();
  const picks = foods.filter((f) => f.protein_pick).sort((a, b) => b.p - a.p);
  let q = '';
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Buscar proteína…', 'aria-label': 'Buscar proteína', maxlength: 60, autocomplete: 'off' });
  const list = el('ul', { class: 'list' });
  const fill = () => {
    clear(list);
    const nq = normalize(q);
    const rows = picks.filter((f) => !nq || nq.split(' ').every((t) => normalize(`${f.name} ${(f.keywords || []).join(' ')}`).includes(t)));
    if (!rows.length) list.append(el('li', { class: 'muted pad', text: picks.length ? 'Sin resultados.' : 'El catálogo de alimentos aún no está disponible.' }));
    rows.forEach((f) => list.append(el('li', { class: 'list-item' },
      el('div', { class: 'grow' }, el('strong', { text: f.name }),
        el('div', { class: 'muted small', text: `${fmtNum(f.p, 1)} g de proteína por 100 g · ${f.kcal} kcal` }),
        f.unit ? el('div', { class: 'muted small', text: `${f.unit.name} (${f.unit.g} g): ${fmtNum((f.p * f.unit.g) / 100, 1)} g de proteína` }) : null),
      el('button', { class: 'btn small', type: 'button', on: { click: () => openLogEntry(ctx, { kind: 'food', item: f, defaultDate: st.date }) } }, 'Agregar a comida'))));
  };
  search.addEventListener('input', () => { q = search.value; fill(); });
  host.append(el('section', { class: 'card' }, el('h2', { text: 'Proteínas populares' }), el('p', { class: 'muted small', text: 'Ordenadas por proteína por 100 g.' }), el('div', { class: 'search' }, icon('buscar'), search), list));
  fill();
}

// ---- Plan de comidas ----
function plan(ctx, host, targets) {
  const cur = mealPlanOf(ctx.profile);
  const n = el('select', { class: 'input', 'aria-label': 'Comidas por día' }, [3, 4, 5, 6].map((k) => el('option', { value: String(k), text: `${k} comidas` })));
  n.value = String(cur.length);
  const rowsHost = el('div');
  let draftPlan = cur.map((m) => ({ name: m.name, time: m.time }));
  const drawRows = () => {
    clear(rowsHost);
    const shares = MEAL_DEFAULTS[draftPlan.length].shares;
    draftPlan.forEach((m, i) => {
      const name = el('input', { class: 'input', type: 'text', value: m.name, maxlength: 30, 'aria-label': `Nombre de la comida ${i + 1}` });
      const time = el('input', { class: 'input', type: 'time', value: m.time, 'aria-label': `Hora de la comida ${i + 1}` });
      name.addEventListener('input', () => { m.name = name.value.slice(0, 30); }); time.addEventListener('change', () => { m.time = time.value; });
      rowsHost.append(el('div', { class: 'meal-edit' }, name, time, el('span', { class: 'muted small', text: targets ? `${Math.round(targets.kcal * shares[i])} kcal · ${Math.round(targets.p * shares[i])} g P` : `${Math.round(shares[i] * 100)} %` })));
    });
  };
  n.addEventListener('change', () => { const k = clampMeals(Number(n.value)); const d = MEAL_DEFAULTS[k]; draftPlan = d.names.map((nm, i) => ({ name: nm, time: d.times[i] })); drawRows(); });
  const save = el('button', { class: 'btn primary block', type: 'button' }, 'Guardar plan de comidas');
  save.addEventListener('click', async () => {
    const clean = draftPlan.map((m) => ({ name: (m.name || '').trim().slice(0, 30) || 'Comida', time: /^\d{2}:\d{2}$/.test(m.time) ? m.time : '12:00' }));
    ctx.profile = { ...ctx.profile, meals_per_day: clean.length, meal_plan: clean };
    try { await ctx.api.saveProfile(ctx.profile); toast('Plan de comidas guardado'); } catch { toast('No se pudo guardar', 'bad'); }
  });
  host.append(el('section', { class: 'card' }, el('h2', { text: 'Plan de comidas' }), el('p', { class: 'muted small', text: 'Elige cuántas comidas haces al día (3 a 6), sus nombres y horarios. Las calorías y la proteína se reparten entre ellas.' }),
    el('label', { class: 'field' }, el('span', { text: 'Comidas por día' }), n), rowsHost, save));
  drawRows();
  if (targets) host.append(el('section', { class: 'card' }, el('h2', { text: 'Metas diarias' }), el('p', {}, `${targets.kcal} kcal · P ${targets.p} g · C ${targets.c} g · G ${targets.f} g · fibra ${targets.fiber} g`), formulaDetails(ctx, targets)));
}

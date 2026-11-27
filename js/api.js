// Capa de datos. Dos implementaciones con la misma interfaz:
//  - createRemoteApi: Supabase (con cola local si no hay conexión)
//  - createDemoApi: datos falsos en localStorage (modo ?demo=1; NO toca Supabase)
import { getClient } from './supabase.js';
import { APP_URL } from './config.js';

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
export const newId = uuid;

const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };

// Normaliza un entrenamiento (de BD o del formulario) a la forma interna.
export function normalizeWorkout(w) {
  return {
    id: w.id, performed_on: w.performed_on, plan_day: w.plan_day ?? null, notes: w.notes ?? '', created_at: w.created_at || null,
    exercises: (w.workout_exercises || w.exercises || []).map((e) => ({
      id: e.id, exercise_id: e.exercise_id, position: e.position ?? 0,
      sets: (e.sets || []).map((s) => ({ id: s.id, set_no: s.set_no, weight_kg: Number(s.weight_kg), reps: Number(s.reps), rir: s.rir === null || s.rir === undefined ? null : Number(s.rir) }))
        .sort((a, b) => a.set_no - b.set_no),
    })).sort((a, b) => a.position - b.position),
  };
}

// Prepara ids para un entrenamiento nuevo (idempotente al reintentar la subida).
export function buildWorkout({ performed_on, plan_day, notes, exercises }) {
  return normalizeWorkout({
    id: uuid(), performed_on, plan_day: plan_day || null, notes: (notes || '').slice(0, 1000), created_at: new Date().toISOString(),
    exercises: exercises.map((e, i) => ({ id: uuid(), exercise_id: e.exercise_id, position: i,
      sets: e.sets.map((s, j) => ({ id: uuid(), set_no: j + 1, weight_kg: s.weight_kg, reps: s.reps, rir: s.rir ?? null })) })),
  });
}

const FOOD_COLS = 'id,logged_on,meal_slot,source,ref_id,label,servings,grams,kcal,p,c,f,fiber';
const normFood = (r) => ({ id: r.id, logged_on: r.logged_on, meal_slot: r.meal_slot, source: r.source, ref_id: r.ref_id, label: r.label || r.ref_id,
  servings: r.servings == null ? null : Number(r.servings), grams: r.grams == null ? null : Number(r.grams),
  kcal: Number(r.kcal), p: Number(r.p), c: Number(r.c), f: Number(r.f), fiber: Number(r.fiber) });
const foodRow = (e) => ({ id: e.id, logged_on: e.logged_on, meal_slot: e.meal_slot, source: e.source, ref_id: e.ref_id, label: e.label || null,
  servings: e.servings, grams: e.grams, kcal: e.kcal, p: e.p, c: e.c, f: e.f, fiber: e.fiber });
const PROFILE_COLS = 'display_name,unit,bodyweight,birth_year,sex,height_cm,goal_weight_kg,days_per_week,meals_per_day,meal_plan';
const isNetworkError = (err) => !navigator.onLine || err instanceof TypeError || /failed to fetch|network|load failed/i.test(String(err?.message || err));

// ============================== Supabase ==============================
export function createRemoteApi() {
  const sb = getClient();
  let userId = null;
  const qKey = () => `gt_queue_${userId}`;
  const cKey = () => `gt_cache_${userId}`;
  const fKey = () => `gt_fqueue_${userId}`;
  const api = {
    mode: 'remote', user: null,
    async init() {
      const { data } = await sb.auth.getSession();
      api.user = data.session?.user || null; userId = api.user?.id || null;
      if (new URLSearchParams(location.search).has('code')) history.replaceState(null, '', location.pathname + location.hash);
      return api.user;
    },
    onAuthChange(cb) {
      return sb.auth.onAuthStateChange((event, session) => { api.user = session?.user || null; userId = api.user?.id || null; cb(event, api.user); });
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: APP_URL } });
      if (error) throw error; return data;
    },
    async signIn(email, password) { const { error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; },
    async magicLink(email) { const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: APP_URL, shouldCreateUser: true } }); if (error) throw error; },
    async resetPassword(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: APP_URL }); if (error) throw error; },
    async updatePassword(password) { const { error } = await sb.auth.updateUser({ password }); if (error) throw error; },
    async phoneOtp(phone) { const { error } = await sb.auth.signInWithOtp({ phone }); if (error) throw error; },
    async verifyPhone(phone, token) { const { error } = await sb.auth.verifyOtp({ phone, token, type: 'sms' }); if (error) throw error; },
    async signOut() {
      const uid = userId;
      try { await sb.auth.signOut(); } finally {
        if (uid) { for (const k of ['cache', 'profile', 'weights', 'plan', 'food']) lsDel(`gt_${k}_${uid}`); }
        lsDel('gt_draft'); // la cola pendiente se conserva por si había datos sin subir
      }
    },
    async getProfile() {
      const { data, error } = await sb.from('profiles').select(PROFILE_COLS).maybeSingle();
      if (error) return lsGet(`gt_profile_${userId}`, { unit: 'kg' });
      const p = data || { unit: 'kg' };
      lsSet(`gt_profile_${userId}`, p); return p;
    },
    async saveProfile(p) {
      const row = { user_id: userId, unit: p.unit === 'lb' ? 'lb' : 'kg', display_name: p.display_name || null, bodyweight: p.bodyweight || null,
        birth_year: p.birth_year ?? null, sex: p.sex ?? null, height_cm: p.height_cm ?? null, goal_weight_kg: p.goal_weight_kg ?? null, days_per_week: p.days_per_week ?? null,
        meals_per_day: p.meals_per_day ?? null, meal_plan: p.meal_plan ?? null };
      lsSet(`gt_profile_${userId}`, row);
      const { error } = await sb.from('profiles').upsert(row, { onConflict: 'user_id' });
      if (error) throw error;
    },
    async listBodyWeights() {
      try {
        const { data, error } = await sb.from('body_weights').select('measured_on,weight_kg').order('measured_on', { ascending: true }).limit(2000);
        if (error) throw error;
        const rows = data.map((r) => ({ measured_on: r.measured_on, weight_kg: Number(r.weight_kg) }));
        lsSet(`gt_weights_${userId}`, rows); return rows;
      } catch (err) { if (!isNetworkError(err)) throw err; return lsGet(`gt_weights_${userId}`, []); }
    },
    async addBodyWeight(measured_on, weight_kg) {
      const { error } = await sb.from('body_weights').upsert({ user_id: userId, measured_on, weight_kg }, { onConflict: 'user_id,measured_on' });
      if (error) throw error;
    },
    async getPlan() {
      try {
        const { data, error } = await sb.from('user_plans').select('plan,source').maybeSingle();
        if (error) throw error;
        const r = data ? { plan: data.plan, source: data.source } : null;
        lsSet(`gt_plan_${userId}`, r); return r;
      } catch (err) { if (!isNetworkError(err)) throw err; return lsGet(`gt_plan_${userId}`, null); }
    },
    async savePlan(plan, source) {
      const { error } = await sb.from('user_plans').upsert({ user_id: userId, plan, source }, { onConflict: 'user_id' });
      if (error) throw error;
      lsSet(`gt_plan_${userId}`, { plan, source });
    },
    // ---- Registro de comidas (con cola sin conexión) ----
    async listFoodLogs(from) {
      let remote;
      try {
        const { data, error } = await sb.from('food_logs').select(FOOD_COLS).gte('logged_on', from).order('logged_on', { ascending: true }).limit(5000);
        if (error) throw error;
        remote = data.map(normFood); lsSet(`gt_food_${userId}`, remote);
      } catch (err) { if (!isNetworkError(err)) throw err; remote = lsGet(`gt_food_${userId}`, []).filter((e) => e.logged_on >= from); }
      const have = new Set(remote.map((e) => e.id));
      const q = lsGet(fKey(), []).filter((e) => !have.has(e.id) && e.logged_on >= from);
      const del = new Set(lsGet(`gt_fdel_${userId}`, []));
      return [...remote.filter((e) => !del.has(e.id)), ...q];
    },
    async saveFoodLog(e) {
      try { const { error } = await sb.from('food_logs').upsert(foodRow(e), { onConflict: 'id' }); if (error) throw error; return { queued: false }; }
      catch (err) {
        if (!isNetworkError(err)) throw err;
        const q = lsGet(fKey(), []).filter((x) => x.id !== e.id); q.push(e); lsSet(fKey(), q); return { queued: true };
      }
    },
    async deleteFoodLog(id) {
      const q = lsGet(fKey(), []); if (q.some((x) => x.id === id)) { lsSet(fKey(), q.filter((x) => x.id !== id)); return; }
      try { const { error } = await sb.from('food_logs').delete().eq('id', id); if (error) throw error; }
      catch (err) { if (!isNetworkError(err)) throw err; lsSet(`gt_fdel_${userId}`, [...lsGet(`gt_fdel_${userId}`, []), id]); }
    },
    pendingCount() { return userId ? lsGet(qKey(), []).length + lsGet(fKey(), []).length : 0; },
    pendingList() { return userId ? lsGet(qKey(), []) : []; },
    async listWorkouts() {
      let remote = null;
      try {
        const { data, error } = await sb.from('workouts')
          .select('id,performed_on,plan_day,notes,created_at,workout_exercises(id,exercise_id,position,sets(id,set_no,weight_kg,reps,rir))')
          .order('performed_on', { ascending: false }).limit(1000);
        if (error) throw error;
        remote = data.map(normalizeWorkout);
        lsSet(cKey(), remote);
      } catch (err) {
        if (!isNetworkError(err)) throw err;
        remote = lsGet(cKey(), []);
      }
      const have = new Set(remote.map((w) => w.id));
      const pend = lsGet(qKey(), []).filter((w) => !have.has(w.id)).map((w) => ({ ...w, pending: true }));
      return [...pend, ...remote].sort((a, b) => b.performed_on.localeCompare(a.performed_on));
    },
    async saveWorkout(w) {
      try { await pushWorkout(sb, w); return { queued: false }; }
      catch (err) {
        if (!isNetworkError(err)) throw err;
        const q = lsGet(qKey(), []); q.push(w); if (!lsSet(qKey(), q)) throw new Error('Sin conexión y sin espacio local para guardar.');
        return { queued: true };
      }
    },
    async flush() {
      if (!userId) return 0;
      let ok = 0;
      const fq = lsGet(fKey(), []), frest = [];
      for (const e of fq) { try { const { error } = await sb.from('food_logs').upsert(foodRow(e), { onConflict: 'id' }); if (error) throw error; ok++; } catch (err) { if (isNetworkError(err)) frest.push(e); } }
      lsSet(fKey(), frest);
      const dels = lsGet(`gt_fdel_${userId}`, []), drest = [];
      for (const id of dels) { try { const { error } = await sb.from('food_logs').delete().eq('id', id); if (error) throw error; } catch (err) { if (isNetworkError(err)) drest.push(id); } }
      lsSet(`gt_fdel_${userId}`, drest);
      const q = lsGet(qKey(), []); if (!q.length) return ok;
      const rest = [];
      for (const w of q) {
        try { await pushWorkout(sb, w); ok++; }
        catch (err) { if (isNetworkError(err)) rest.push(w); else console.warn('Entrenamiento descartado de la cola:', err.message); }
      }
      lsSet(qKey(), rest); return ok;
    },
    async exportAll() {
      const [workouts, profile, body_weights, plan, food_logs] = await Promise.all([api.listWorkouts(), api.getProfile(), api.listBodyWeights(), api.getPlan(), api.listFoodLogs('2000-01-01')]);
      return { exported_at: new Date().toISOString(), app: 'gym_tracker', email: api.user?.email || null, profile, body_weights, plan, food_logs, workouts };
    },
    async deleteAccount() {
      const { error } = await sb.rpc('delete_my_account'); if (error) throw error;
      const uid = userId; for (const k of ['cache', 'profile', 'weights', 'plan', 'queue', 'fqueue', 'fdel', 'food']) lsDel(`gt_${k}_${uid}`); lsDel('gt_draft');
      try { await sb.auth.signOut(); } catch { /* la cuenta ya no existe */ }
    },
  };
  return api;
}

async function pushWorkout(sb, w) {
  let r = await sb.from('workouts').upsert({ id: w.id, performed_on: w.performed_on, plan_day: w.plan_day, notes: w.notes || null }, { onConflict: 'id' });
  if (r.error) throw r.error;
  const wes = w.exercises.map((e) => ({ id: e.id, workout_id: w.id, exercise_id: e.exercise_id, position: e.position }));
  if (wes.length) { r = await sb.from('workout_exercises').upsert(wes, { onConflict: 'id' }); if (r.error) throw r.error; }
  const sets = w.exercises.flatMap((e) => e.sets.map((s) => ({ id: s.id, workout_exercise_id: e.id, set_no: s.set_no, weight_kg: s.weight_kg, reps: s.reps, rir: s.rir })));
  if (sets.length) { r = await sb.from('sets').upsert(sets, { onConflict: 'id' }); if (r.error) throw r.error; }
}

// ============================== Demo ==============================
export function createDemoApi(seed) {
  const K = { w: 'gt_demo_workouts', p: 'gt_demo_profile', b: 'gt_demo_weights', l: 'gt_demo_plan', f: 'gt_demo_food' };
  const plant = () => { const d = seed(); lsSet(K.w, d.workouts); lsSet(K.p, d.profile); lsSet(K.b, d.weights); lsSet(K.l, d.plan); lsSet(K.f, d.food || []); };
  const api = {
    mode: 'demo', user: { id: 'demo', email: 'demo@local' },
    async init() { if (!lsGet(K.w, null) || !lsGet(K.l, null) || !lsGet(K.f, null)) plant(); return api.user; },
    onAuthChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    async getProfile() { return lsGet(K.p, { unit: 'kg' }); },
    async saveProfile(p) { lsSet(K.p, p); },
    async listBodyWeights() { return lsGet(K.b, []).sort((a, b) => a.measured_on.localeCompare(b.measured_on)); },
    async addBodyWeight(d, kg) { const l = lsGet(K.b, []).filter((r) => r.measured_on !== d); l.push({ measured_on: d, weight_kg: kg }); lsSet(K.b, l); },
    async listFoodLogs(from) { return lsGet(K.f, []).filter((e) => e.logged_on >= from); },
    async saveFoodLog(e) { const l = lsGet(K.f, []).filter((x) => x.id !== e.id); l.push(e); lsSet(K.f, l); return { queued: false }; },
    async deleteFoodLog(id) { lsSet(K.f, lsGet(K.f, []).filter((x) => x.id !== id)); },
    async getPlan() { return lsGet(K.l, null); },
    async savePlan(plan, source) { lsSet(K.l, { plan, source }); },
    pendingCount: () => 0, pendingList: () => [],
    async listWorkouts() { return lsGet(K.w, []).sort((a, b) => b.performed_on.localeCompare(a.performed_on)); },
    async saveWorkout(w) { const l = lsGet(K.w, []); l.push(w); lsSet(K.w, l); return { queued: false }; },
    async flush() { return 0; },
    async exportAll() { return { exported_at: new Date().toISOString(), app: 'gym_tracker', demo: true, profile: await api.getProfile(), body_weights: await api.listBodyWeights(), food_logs: await api.listFoodLogs('2000-01-01'), workouts: await api.listWorkouts() }; },
    async signOut() { Object.values(K).forEach(lsDel); lsDel('gt_draft'); },
    async deleteAccount() { await api.signOut(); },
    resetDemo() { plant(); lsDel('gt_draft'); },
  };
  return api;
}
export { lsGet, lsSet, lsDel };

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

const isNetworkError = (err) => !navigator.onLine || err instanceof TypeError || /failed to fetch|network|load failed/i.test(String(err?.message || err));

// ============================== Supabase ==============================
export function createRemoteApi() {
  const sb = getClient();
  let userId = null;
  const qKey = () => `gt_queue_${userId}`;
  const cKey = () => `gt_cache_${userId}`;
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
        if (uid) { lsDel(`gt_cache_${uid}`); lsDel(`gt_profile_${uid}`); }
        lsDel('gt_draft'); // la cola pendiente se conserva por si había datos sin subir
      }
    },
    async getProfile() {
      const { data, error } = await sb.from('profiles').select('display_name,unit,bodyweight').maybeSingle();
      if (error) return lsGet(`gt_profile_${userId}`, { unit: 'kg' });
      const p = data || { unit: 'kg', display_name: null, bodyweight: null };
      lsSet(`gt_profile_${userId}`, p); return p;
    },
    async saveProfile(p) {
      const row = { user_id: userId, unit: p.unit === 'lb' ? 'lb' : 'kg', display_name: p.display_name || null, bodyweight: p.bodyweight || null };
      lsSet(`gt_profile_${userId}`, row);
      const { error } = await sb.from('profiles').upsert(row, { onConflict: 'user_id' });
      if (error) throw error;
    },
    pendingCount() { return userId ? lsGet(qKey(), []).length : 0; },
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
      const q = lsGet(qKey(), []); if (!q.length) return 0;
      const rest = []; let ok = 0;
      for (const w of q) {
        try { await pushWorkout(sb, w); ok++; }
        catch (err) { if (isNetworkError(err)) rest.push(w); else console.warn('Entrenamiento descartado de la cola:', err.message); }
      }
      lsSet(qKey(), rest); return ok;
    },
    async exportAll() {
      const [workouts, profile] = await Promise.all([api.listWorkouts(), api.getProfile()]);
      return { exported_at: new Date().toISOString(), app: 'gym_tracker', email: api.user?.email || null, profile, workouts };
    },
    async deleteAccount() {
      const { error } = await sb.rpc('delete_my_account'); if (error) throw error;
      const uid = userId; lsDel(`gt_cache_${uid}`); lsDel(`gt_profile_${uid}`); lsDel(`gt_queue_${uid}`); lsDel('gt_draft');
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
  const WK = 'gt_demo_workouts', PK = 'gt_demo_profile';
  const api = {
    mode: 'demo', user: { id: 'demo', email: 'demo@local' },
    async init() { if (!lsGet(WK, null)) lsSet(WK, seed()); return api.user; },
    onAuthChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    async getProfile() { return lsGet(PK, { unit: 'kg', display_name: 'Demo', bodyweight: null }); },
    async saveProfile(p) { lsSet(PK, p); },
    pendingCount: () => 0, pendingList: () => [],
    async listWorkouts() { return lsGet(WK, []).sort((a, b) => b.performed_on.localeCompare(a.performed_on)); },
    async saveWorkout(w) { const l = lsGet(WK, []); l.push(w); lsSet(WK, l); return { queued: false }; },
    async flush() { return 0; },
    async exportAll() { return { exported_at: new Date().toISOString(), app: 'gym_tracker', demo: true, profile: await api.getProfile(), workouts: await api.listWorkouts() }; },
    async signOut() { lsDel(WK); lsDel(PK); lsDel('gt_draft'); },
    async deleteAccount() { await api.signOut(); },
    resetDemo() { lsSet(WK, seed()); lsDel('gt_draft'); },
  };
  return api;
}
export { lsGet, lsSet, lsDel };

// Playwright: app real con un Supabase simulado que rechaza columnas/tablas nuevas como PostgREST.
// Uso (servidor en :8765): node tests/e2e/schema-faltante.cjs chromium|webkit [tablas_ausentes] [perfil_en_cache]
const pw = require('playwright');
const SP = require('os').tmpdir();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const fake = `(()=>{
window.__calls=[];
const OLD={profiles:'user_id,display_name,unit,bodyweight,birth_year,sex,height_cm,goal_weight_kg,days_per_week,updated_at',sets:'id,workout_exercise_id,set_no,weight_kg,reps,rir'};
const MISSING=new Set((new URLSearchParams(location.search).get('missing')||'').split(',').filter(Boolean)); // tablas ausentes
const store={profiles:[{user_id:'u1',unit:'kg',birth_year:1990,sex:'F',height_cm:165,goal_weight_kg:58,days_per_week:4,bodyweight:60}],workouts:[]};
function colErr(t,c){return {code:'42703',message:'column '+t+'.'+c+' does not exist'}}
function q(t){ const st={cols:'*',op:'select'}; const o={
  select(c){st.cols=c||'*';return o}, order(){return o}, limit(){return o}, gte(){return o}, eq(){return o},
  maybeSingle(){st.single=true;return o}, 
  upsert(r){st.op='upsert';st.rows=[].concat(r);return o}, delete(){st.op='delete';return o},
  then(res,rej){ return Promise.resolve(run()).then(res,rej) } };
 function run(){
  if(MISSING.has(t)) return {data:null,error:{code:'PGRST205',message:"Could not find the table 'public."+t+"' in the schema cache"}};
  if(st.op==='upsert'){ if(OLD[t]) for(const r of st.rows) for(const k of Object.keys(r)) if(!OLD[t].split(',').includes(k)) return {error:colErr(t,k)}; st.rows.forEach(r=>{ if(t==='profiles') store.profiles=[{...store.profiles[0],...r}]; }); return {error:null}; }
  if(st.op==='delete') return {error:null};
  if(OLD[t] && st.cols!=='*'){ for(const k of st.cols.split(',')){ if(!OLD[t].split(',').includes(k)) return {data:null,error:colErr(t,k)}; } }
  if(t==='workouts'&&st.cols!=='*'&&/unit/.test(st.cols)) return {data:null,error:colErr('sets','unit')};
  const d=store[t]||[]; return {data:st.single?(d[0]||null):d,error:null}; }
 return o }
window.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'u1',email:'a@b.mx'}}}}),onAuthStateChange:()=>({data:{subscription:{}}}),signOut:async()=>{}},from:q,rpc:async()=>({error:null})})};})();`;
(async () => {
  const kind = process.argv[2] || 'chromium';
  const b = await pw[kind].launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.route('**/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "export const SUPABASE_URL='https://x.supabase.co';export const SUPABASE_ANON_KEY='k';export const PHONE_AUTH_ENABLED=true;export const MIN_PASSWORD=10;export const APP_URL='http://localhost:8765/';export const isConfigured=()=>true;" }));
  await page.route('**/index.html*', async (r) => { const res = await r.fetch(); let t = await res.text(); t = t.replace(/<script src="https:\/\/cdn[^>]*><\/script>/g, '<script src="/fake-sb.js"></script>'); r.fulfill({ response: res, body: t }); });
  await page.route('**/fake-sb.js', (r) => r.fulfill({ contentType: 'text/javascript', body: fake }));
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  const missing = process.argv[3] || ''; if (process.argv[4]) await page.addInitScript(() => localStorage.setItem('gt_profile_u1', JSON.stringify({unit:'kg',birth_year:1990,sex:'F',height_cm:165,goal_weight_kg:58,days_per_week:4,bodyweight:60})));
  await page.goto('http://localhost:8765/index.html?missing=' + missing + '#/track');
  await page.waitForTimeout(2500); console.log((await page.textContent('body')).slice(0,300).replace(/\s+/g,' '));
  for (const r of ['track', 'comida', 'recetas', 'summary', 'biblioteca', 'cuenta']) {
    await page.evaluate((h) => { location.hash = '#/' + h; }, r); await page.waitForTimeout(900);
    const bad = await page.locator('#view .banner.bad').allTextContents(); const warn = await page.locator('.banner.warn').allTextContents();
    console.log(kind, r, bad.length ? 'FALLA ' + bad.join('|') + ' ' + (await page.locator('#view .muted.small').first().textContent().catch(()=>'')) : 'ok', warn.length ? 'warn:' + warn[0].slice(0,60) : '');
  }
  await page.evaluate(() => { location.hash = '#/comida'; }); await page.waitForTimeout(500); await page.screenshot({ path: SP + '/f_' + kind + '.png' });
  console.log('pageerrors', errs); await b.close();
})();

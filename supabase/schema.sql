-- Gym Tracker · esquema de Supabase (Postgres + RLS)
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run. Es idempotente.

-- ============ Tablas ============
create table if not exists public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 60),
  unit         text not null default 'kg' check (unit in ('kg', 'lb')),
  bodyweight   numeric(5,1) check (bodyweight is null or (bodyweight > 0 and bodyweight <= 700)),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_on date not null check (performed_on between date '2000-01-01' and date '2100-01-01'),
  plan_day     text check (plan_day is null or char_length(plan_day) <= 80),
  notes        text check (notes is null or char_length(notes) <= 1000),
  created_at   timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null check (char_length(exercise_id) between 1 and 64 and exercise_id ~ '^[a-zA-Z0-9_-]+$'),
  position    int  not null default 0 check (position between 0 and 100)
);

create table if not exists public.sets (
  id                  uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_no              int  not null check (set_no between 1 and 50),   -- máx. 50 series por ejercicio
  weight_kg           numeric(7,2) not null default 0 check (weight_kg between 0 and 1000),
  reps                int  not null default 0 check (reps between 0 and 1000),
  rir                 int  check (rir is null or rir between 0 and 10),
  unique (workout_exercise_id, set_no)
);

-- ---- Versión 2: perfil completo, peso corporal y plan personalizado (migración segura: ADD ... IF NOT EXISTS) ----
alter table public.profiles add column if not exists birth_year     int;
alter table public.profiles add column if not exists sex            text;
alter table public.profiles add column if not exists height_cm      numeric(4,1);
alter table public.profiles add column if not exists goal_weight_kg numeric(4,1);
alter table public.profiles add column if not exists days_per_week  int;
alter table public.profiles drop constraint if exists profiles_birth_year_chk;
alter table public.profiles add constraint profiles_birth_year_chk check (birth_year is null or birth_year between 1900 and 2100);
alter table public.profiles drop constraint if exists profiles_sex_chk;
alter table public.profiles add constraint profiles_sex_chk check (sex is null or sex in ('M', 'F'));
alter table public.profiles drop constraint if exists profiles_height_chk;
alter table public.profiles add constraint profiles_height_chk check (height_cm is null or height_cm between 120 and 230);
alter table public.profiles drop constraint if exists profiles_goal_weight_chk;
alter table public.profiles add constraint profiles_goal_weight_chk check (goal_weight_kg is null or goal_weight_kg between 30 and 300);
alter table public.profiles drop constraint if exists profiles_days_chk;
alter table public.profiles add constraint profiles_days_chk check (days_per_week is null or days_per_week between 2 and 6);

-- Edad 13–100 (depende de la fecha actual, por eso va en un trigger y no en un CHECK).
create or replace function public.validate_profile()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.birth_year is not null then
    if extract(year from now())::int - new.birth_year not between 13 and 100 then
      raise exception 'Edad fuera de rango (13–100)' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_validate on public.profiles;
create trigger profiles_validate before insert or update on public.profiles for each row execute function public.validate_profile();

create table if not exists public.body_weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null check (measured_on between date '2000-01-01' and date '2100-01-01'),
  weight_kg   numeric(5,1) not null check (weight_kg between 30 and 300),
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- Un plan por usuario (el activo). jsonb acotado en tamaño y tipo.
create table if not exists public.user_plans (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  plan       jsonb not null check (jsonb_typeof(plan) = 'object' and pg_column_size(plan) < 200000),
  source     text not null default 'generated' check (source in ('generated', 'preset')),
  updated_at timestamptz not null default now()
);

-- ---- Versión 3: alimentación (plan de comidas y registro de comidas) ----
alter table public.profiles add column if not exists meals_per_day smallint;
alter table public.profiles add column if not exists meal_plan jsonb;
alter table public.profiles drop constraint if exists profiles_meals_chk;
alter table public.profiles add constraint profiles_meals_chk check (meals_per_day is null or meals_per_day between 3 and 6);
alter table public.profiles drop constraint if exists profiles_meal_plan_chk;
alter table public.profiles add constraint profiles_meal_plan_chk check (meal_plan is null or (jsonb_typeof(meal_plan) = 'array' and jsonb_array_length(meal_plan) <= 6 and pg_column_size(meal_plan) < 2000));

-- Cada renglón guarda un "snapshot" de macros para no depender del catálogo (que es estático).
create table if not exists public.food_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on  date not null check (logged_on between date '2000-01-01' and date '2100-01-01'),
  meal_slot  smallint not null check (meal_slot between 1 and 6),
  source     text not null,
  ref_id     text not null check (char_length(ref_id) between 1 and 64 and ref_id ~ '^[a-zA-Z0-9_-]+$'),
  label      text check (label is null or char_length(label) <= 80),
  servings   numeric(7,2) check (servings is null or (servings > 0 and servings <= 100)),
  grams      numeric(7,1) check (grams is null or (grams > 0 and grams <= 10000)),
  kcal       numeric(7,1) not null check (kcal between 0 and 20000),
  p          numeric(6,1) not null check (p between 0 and 2000),
  c          numeric(6,1) not null check (c between 0 and 3000),
  f          numeric(6,1) not null check (f between 0 and 2000),
  fiber      numeric(6,1) not null default 0 check (fiber between 0 and 500),
  created_at timestamptz not null default now(),
  constraint food_logs_source_check check (source in ('recipe', 'food', 'powder')),
  constraint food_logs_shape_check check ((source in ('recipe', 'powder') and servings is not null) or (source = 'food' and grams is not null))
);

-- Versión 4: proteína en polvo ('powder': servings = scoops) y "mi proteína" favorita. Migración segura.
alter table public.food_logs drop constraint if exists food_logs_check;
alter table public.food_logs drop constraint if exists food_logs_source_check;
alter table public.food_logs drop constraint if exists food_logs_shape_check;
alter table public.food_logs add constraint food_logs_source_check check (source in ('recipe', 'food', 'powder'));
alter table public.food_logs add constraint food_logs_shape_check check ((source in ('recipe', 'powder') and servings is not null) or (source = 'food' and grams is not null));
alter table public.profiles add column if not exists favorite_powder text;
alter table public.profiles drop constraint if exists profiles_fav_powder_chk;
alter table public.profiles add constraint profiles_fav_powder_chk check (favorite_powder is null or (char_length(favorite_powder) <= 64 and favorite_powder ~ '^[a-zA-Z0-9_-]+$'));

-- Versión 5: unidad original (kg/lb) de cada serie; weight_kg sigue siendo la fuente de verdad. Migración segura.
alter table public.sets add column if not exists unit text not null default 'kg';
alter table public.sets drop constraint if exists sets_unit_chk;
alter table public.sets add constraint sets_unit_chk check (unit in ('kg', 'lb'));

-- Versión 6: proteínas en polvo personalizadas del usuario (máx. 10, tamaño acotado). Migración segura.
alter table public.profiles add column if not exists custom_powders jsonb;
alter table public.profiles drop constraint if exists profiles_custom_powders_chk;
alter table public.profiles add constraint profiles_custom_powders_chk check (custom_powders is null or (jsonb_typeof(custom_powders) = 'array' and jsonb_array_length(custom_powders) <= 10 and pg_column_size(custom_powders) < 8000));

-- ============ Índices ============
create index if not exists workouts_user_date_idx on public.workouts (user_id, performed_on desc);
create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index if not exists workout_exercises_user_idx on public.workout_exercises (user_id);
create index if not exists sets_we_idx on public.sets (workout_exercise_id);
create index if not exists sets_user_idx on public.sets (user_id);
create index if not exists food_logs_user_date_idx on public.food_logs (user_id, logged_on desc);
create index if not exists body_weights_user_date_idx on public.body_weights (user_id, measured_on desc);

-- ============ Row Level Security ============
alter table public.profiles          enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets              enable row level security;
alter table public.body_weights      enable row level security;
alter table public.user_plans        enable row level security;
alter table public.food_logs         enable row level security;

-- Sin acceso para anon; solo usuarios autenticados y solo a sus filas.
revoke all on public.profiles, public.workouts, public.workout_exercises, public.sets, public.body_weights, public.user_plans, public.food_logs from anon;
grant select, insert, update, delete on public.profiles, public.workouts, public.workout_exercises, public.sets, public.body_weights, public.user_plans, public.food_logs to authenticated;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy profiles_delete on public.profiles for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists workouts_select on public.workouts;
drop policy if exists workouts_insert on public.workouts;
drop policy if exists workouts_update on public.workouts;
drop policy if exists workouts_delete on public.workouts;
create policy workouts_select on public.workouts for select to authenticated using (user_id = (select auth.uid()));
create policy workouts_insert on public.workouts for insert to authenticated with check (user_id = (select auth.uid()));
create policy workouts_update on public.workouts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy workouts_delete on public.workouts for delete to authenticated using (user_id = (select auth.uid()));

-- Las filas hijas además deben colgar de una fila padre del mismo usuario.
drop policy if exists we_select on public.workout_exercises;
drop policy if exists we_insert on public.workout_exercises;
drop policy if exists we_update on public.workout_exercises;
drop policy if exists we_delete on public.workout_exercises;
create policy we_select on public.workout_exercises for select to authenticated using (user_id = (select auth.uid()));
create policy we_insert on public.workout_exercises for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy we_update on public.workout_exercises for update to authenticated using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = (select auth.uid())));
create policy we_delete on public.workout_exercises for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists sets_select on public.sets;
drop policy if exists sets_insert on public.sets;
drop policy if exists sets_update on public.sets;
drop policy if exists sets_delete on public.sets;
create policy sets_select on public.sets for select to authenticated using (user_id = (select auth.uid()));
create policy sets_insert on public.sets for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.workout_exercises e where e.id = workout_exercise_id and e.user_id = (select auth.uid())));
create policy sets_update on public.sets for update to authenticated using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and exists (select 1 from public.workout_exercises e where e.id = workout_exercise_id and e.user_id = (select auth.uid())));
create policy sets_delete on public.sets for delete to authenticated using (user_id = (select auth.uid()));

-- Peso corporal y plan: solo las filas propias.
drop policy if exists bw_select on public.body_weights;
drop policy if exists bw_insert on public.body_weights;
drop policy if exists bw_update on public.body_weights;
drop policy if exists bw_delete on public.body_weights;
create policy bw_select on public.body_weights for select to authenticated using (user_id = (select auth.uid()));
create policy bw_insert on public.body_weights for insert to authenticated with check (user_id = (select auth.uid()));
create policy bw_update on public.body_weights for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bw_delete on public.body_weights for delete to authenticated using (user_id = (select auth.uid()));
drop policy if exists up_select on public.user_plans;
drop policy if exists up_insert on public.user_plans;
drop policy if exists up_update on public.user_plans;
drop policy if exists up_delete on public.user_plans;
create policy up_select on public.user_plans for select to authenticated using (user_id = (select auth.uid()));
create policy up_insert on public.user_plans for insert to authenticated with check (user_id = (select auth.uid()));
create policy up_update on public.user_plans for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy up_delete on public.user_plans for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists fl_select on public.food_logs;
drop policy if exists fl_insert on public.food_logs;
drop policy if exists fl_update on public.food_logs;
drop policy if exists fl_delete on public.food_logs;
create policy fl_select on public.food_logs for select to authenticated using (user_id = (select auth.uid()));
create policy fl_insert on public.food_logs for insert to authenticated with check (user_id = (select auth.uid()));
create policy fl_update on public.food_logs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy fl_delete on public.food_logs for delete to authenticated using (user_id = (select auth.uid()));

-- ============ Triggers: updated_at del perfil ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists user_plans_touch on public.user_plans;
create trigger user_plans_touch before update on public.user_plans for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- ============ Borrar mi cuenta y mis datos ============
-- SECURITY DEFINER con search_path fijo: solo borra al usuario de la sesión (auth.uid()).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;
  delete from public.sets where user_id = uid;
  delete from public.workout_exercises where user_id = uid;
  delete from public.workouts where user_id = uid;
  delete from public.food_logs where user_id = uid;
  delete from public.body_weights where user_id = uid;
  delete from public.user_plans where user_id = uid;
  delete from public.profiles where user_id = uid;
  delete from auth.users where id = uid;   -- cascada a cualquier otra fila ligada al usuario
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

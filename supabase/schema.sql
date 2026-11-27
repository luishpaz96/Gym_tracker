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

-- ============ Índices ============
create index if not exists workouts_user_date_idx on public.workouts (user_id, performed_on desc);
create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index if not exists workout_exercises_user_idx on public.workout_exercises (user_id);
create index if not exists sets_we_idx on public.sets (workout_exercise_id);
create index if not exists sets_user_idx on public.sets (user_id);

-- ============ Row Level Security ============
alter table public.profiles          enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets              enable row level security;

-- Sin acceso para anon; solo usuarios autenticados y solo a sus filas.
revoke all on public.profiles, public.workouts, public.workout_exercises, public.sets from anon;
grant select, insert, update, delete on public.profiles, public.workouts, public.workout_exercises, public.sets to authenticated;

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

-- ============ Triggers: updated_at del perfil ============
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
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
  delete from public.profiles where user_id = uid;
  delete from auth.users where id = uid;   -- cascada a cualquier otra fila ligada al usuario
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

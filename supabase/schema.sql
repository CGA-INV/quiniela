-- =====================================================================
-- Quiniela Mundial 2026 - Esquema de base de datos
-- Pegar TODO este archivo en Supabase Dashboard -> SQL Editor -> Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. profiles: perfil público del usuario (1:1 con auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- Crea perfil automáticamente cuando se registra un usuario nuevo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 2. pools: salas/grupos de quiniela (cada uno con su código)
-- ---------------------------------------------------------------------
create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists pools_owner_idx on public.pools(owner_id);

-- ---------------------------------------------------------------------
-- 3. pool_members: membresía usuario <-> sala
-- ---------------------------------------------------------------------
create table if not exists public.pool_members (
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (pool_id, user_id)
);

create index if not exists pool_members_user_idx on public.pool_members(user_id);

-- ---------------------------------------------------------------------
-- 4. matches: partidos del Mundial (globales, una sola tabla)
-- ---------------------------------------------------------------------
create type match_stage as enum ('group','round_of_32','round_of_16','quarter','semi','third_place','final');

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  stage match_stage not null,
  group_label text,                    -- 'A'..'L' en fase de grupos, null en eliminatorias
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  home_score int,                      -- null hasta que termina
  away_score int,
  finished boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists matches_kickoff_idx on public.matches(kickoff_at);

-- ---------------------------------------------------------------------
-- 5. predictions: predicciones de cada usuario por sala y partido
-- ---------------------------------------------------------------------
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  pred_home int not null check (pred_home >= 0),
  pred_away int not null check (pred_away >= 0),
  points int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pool_id, match_id)
);

create index if not exists predictions_pool_idx on public.predictions(pool_id);
create index if not exists predictions_match_idx on public.predictions(match_id);

-- ---------------------------------------------------------------------
-- 6. Cálculo de puntos: 3 = marcador exacto, 1 = acertar ganador/empate
-- ---------------------------------------------------------------------
create or replace function public.calc_points(
  ph int, pa int, rh int, ra int
) returns int
language sql immutable as $$
  select case
    when rh is null or ra is null then 0
    when ph = rh and pa = ra then 3
    when sign(ph - pa) = sign(rh - ra) then 1
    else 0
  end;
$$;

-- Recalcula puntos de todas las predicciones cuando se cierra un partido.
create or replace function public.recalc_predictions_for_match()
returns trigger
language plpgsql as $$
begin
  if new.finished and (old.finished is distinct from new.finished
       or old.home_score is distinct from new.home_score
       or old.away_score is distinct from new.away_score) then
    update public.predictions
      set points = public.calc_points(pred_home, pred_away, new.home_score, new.away_score),
          updated_at = now()
      where match_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_match_finished on public.matches;
create trigger on_match_finished
  after update on public.matches
  for each row execute function public.recalc_predictions_for_match();

-- ---------------------------------------------------------------------
-- 7. Función para unirse a una sala con código de invitación
-- ---------------------------------------------------------------------
create or replace function public.join_pool_by_code(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  target_pool uuid;
begin
  select id into target_pool from public.pools where invite_code = upper(trim(code));
  if target_pool is null then
    raise exception 'Código de invitación inválido';
  end if;
  insert into public.pool_members (pool_id, user_id)
    values (target_pool, auth.uid())
    on conflict do nothing;
  return target_pool;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.pools         enable row level security;
alter table public.pool_members  enable row level security;
alter table public.matches       enable row level security;
alter table public.predictions   enable row level security;

-- profiles: cualquier usuario logueado los puede leer (para mostrar nombres en ranking)
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid());

-- pools: solo miembros pueden ver la sala
create policy "pools_select_member" on public.pools
  for select to authenticated using (
    exists (select 1 from public.pool_members pm
            where pm.pool_id = pools.id and pm.user_id = auth.uid())
  );

create policy "pools_insert_owner" on public.pools
  for insert to authenticated with check (owner_id = auth.uid());

create policy "pools_update_owner" on public.pools
  for update to authenticated using (owner_id = auth.uid());

create policy "pools_delete_owner" on public.pools
  for delete to authenticated using (owner_id = auth.uid());

-- pool_members: cada quien ve los miembros de las salas a las que pertenece
create policy "pool_members_select" on public.pool_members
  for select to authenticated using (
    user_id = auth.uid() or
    exists (select 1 from public.pool_members pm2
            where pm2.pool_id = pool_members.pool_id and pm2.user_id = auth.uid())
  );
-- Nota: el insert se hace SIEMPRE vía la función join_pool_by_code (security definer).
-- El usuario también puede salirse de una sala:
create policy "pool_members_delete_self" on public.pool_members
  for delete to authenticated using (user_id = auth.uid());

-- matches: lectura abierta para todo usuario logueado, escritura solo service_role
create policy "matches_select" on public.matches
  for select to authenticated using (true);

-- predictions: usuario ve y edita las propias; los demás miembros las ven solo después del kickoff
create policy "predictions_select_own_or_after_kickoff" on public.predictions
  for select to authenticated using (
    user_id = auth.uid() or
    exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.kickoff_at <= now()
        and exists (
          select 1 from public.pool_members pm
          where pm.pool_id = predictions.pool_id and pm.user_id = auth.uid()
        )
    )
  );

create policy "predictions_insert_own_before_kickoff" on public.predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.pool_members pm
                where pm.pool_id = predictions.pool_id and pm.user_id = auth.uid())
    and exists (select 1 from public.matches m
                where m.id = predictions.match_id and m.kickoff_at > now())
  );

create policy "predictions_update_own_before_kickoff" on public.predictions
  for update to authenticated using (
    user_id = auth.uid()
    and exists (select 1 from public.matches m
                where m.id = predictions.match_id and m.kickoff_at > now())
  );

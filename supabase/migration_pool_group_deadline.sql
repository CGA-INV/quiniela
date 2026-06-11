-- =====================================================================
-- Cierre de la FASE DE GRUPOS por sala (override opcional).
--
-- Cada sala puede tener su propio cierre de grupos en pools.group_deadline.
-- Si está NULL, usa el cierre global por defecto (2026-06-11 03:59:00+00,
-- = 10 jun 11:59 PM hora VE). Las fases eliminatorias no cambian: cierran
-- cuando arranca cada fase (primer kickoff).
--
-- Pegar en Supabase SQL Editor -> Run. Idempotente.
-- =====================================================================

-- 1) Columna de cierre de grupos por sala.
alter table public.pools add column if not exists group_deadline timestamptz;

-- 2) prediction_phase_open ahora considera la sala (pool) para el cierre de grupos.
create or replace function public.prediction_phase_open(p_match_id uuid, p_pool_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when m.stage = 'group'
      then now() < coalesce(
        (select group_deadline from public.pools where id = p_pool_id),
        timestamptz '2026-06-11 03:59:00+00'
      )
    else now() < coalesce((
      select min(m2.kickoff_at)
      from public.matches m2
      where m2.stage = m.stage
        and m2.pool_id is not distinct from m.pool_id
    ), timestamptz '2026-06-11 03:59:00+00')
  end
  from public.matches m
  where m.id = p_match_id;
$$;

-- 3) Políticas: ahora pasan pool_id a la función.
drop policy if exists "predictions_insert_own_before_kickoff" on public.predictions;
create policy "predictions_insert_own_before_kickoff" on public.predictions
  for insert to authenticated with check (
    user_id = auth.uid()
    and public.is_pool_member(pool_id)
    and public.prediction_phase_open(match_id, pool_id)
  );

drop policy if exists "predictions_update_own_before_kickoff" on public.predictions;
create policy "predictions_update_own_before_kickoff" on public.predictions
  for update to authenticated using (
    user_id = auth.uid()
    and public.prediction_phase_open(match_id, pool_id)
  );

drop policy if exists "predictions_delete_own_before_lock" on public.predictions;
create policy "predictions_delete_own_before_lock" on public.predictions
  for delete to authenticated using (
    user_id = auth.uid()
    and public.prediction_phase_open(match_id, pool_id)
  );

drop policy if exists "predictions_select_own_or_after_kickoff" on public.predictions;
create policy "predictions_select_own_or_after_kickoff" on public.predictions
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or (
      public.is_pool_member(pool_id)
      and not public.prediction_phase_open(match_id, pool_id)
    )
  );

-- 4) Quita la versión vieja de 1 argumento (ya nadie la referencia).
drop function if exists public.prediction_phase_open(uuid);

-- 5) Cierre específico de "La vinotinto 2030": 11 jun 2026, 2:00 PM hora VE
--    (= 2026-06-11 18:00:00+00). Cambiar/repetir para otras salas.
update public.pools
  set group_deadline = timestamptz '2026-06-11 18:00:00+00'
  where id = 'a38e2675-0750-4cf9-aebd-961b69b817c9';
